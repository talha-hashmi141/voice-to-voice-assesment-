import { Inject, Injectable, Logger } from '@nestjs/common';
import { type AgentStep, type AgentStepType, type TurnMetrics, type UserContext } from '@voice-agent/contracts';
import { AppConfigService, Stopwatch, truncate } from '../../common';
import { ConversationRepository, deriveTitle, MemoryService, MessageRepository, toMessage } from '../conversations';
import { LLM_PROVIDER, type LlmMessage, type LlmProvider, type LlmToolCall } from '../llm';
import { CitationRegistry, type ToolContext, ToolExecutor, ToolRegistry } from '../tools';
import { type AgentEvent } from './agent-events';
import { extractCitations } from './citation-extractor';
import { PromptBuilder } from './prompt-builder';

export interface AgentRunInput {
  turnId: string;
  conversationId: string;
  userText: string;
  userContext: UserContext;
  signal: AbortSignal;
  /** Shared with the voice pipeline so metrics include transcription time. */
  stopwatch?: Stopwatch;
}

const FALLBACK_ANSWER =
  "I wasn't able to finish working that out. Could you rephrase the question, or ask me one part at a time?";

const safeParseArgs = (raw: string): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return { raw };
  }
};

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && (error.name === 'AbortError' || /abort/iu.test(error.message));

/**
 * The agent loop (ReAct-style): stream a model step → execute all requested tools
 * concurrently → feed results back → repeat until the model answers or the step budget
 * is exhausted. Emits a typed event stream consumed by the REST endpoint and the voice gateway.
 */
@Injectable()
export class AgentRuntime {
  private readonly logger = new Logger(AgentRuntime.name);

  constructor(
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    private readonly tools: ToolRegistry,
    private readonly executor: ToolExecutor,
    private readonly prompts: PromptBuilder,
    private readonly memory: MemoryService,
    private readonly messages: MessageRepository,
    private readonly conversations: ConversationRepository,
    private readonly config: AppConfigService,
  ) {}

  async *run(input: AgentRunInput): AsyncGenerator<AgentEvent> {
    const { signal } = input;
    const stopwatch = input.stopwatch ?? new Stopwatch();
    const steps: AgentStep[] = [];
    let stepSeq = 0;
    const addStep = (type: AgentStepType, label: string, data?: Record<string, unknown>, durationMs?: number): AgentStep => {
      stepSeq += 1;
      const step: AgentStep = { id: `${input.turnId}-${stepSeq}`, type, at: stopwatch.elapsed(), label };
      if (data) step.data = data;
      if (durationMs !== undefined) step.durationMs = durationMs;
      steps.push(step);
      return step;
    };

    const metrics = { firstTokenMs: null as number | null, llmCalls: 0, toolCalls: 0 };
    const citations = new CitationRegistry();
    const context: ToolContext = {
      turnId: input.turnId,
      conversationId: input.conversationId,
      userContext: input.userContext,
      citations,
      signal,
    };

    const { history, summary } = await this.memory.buildHistory(input.conversationId);
    const userRow = await this.messages.append({ conversationId: input.conversationId, role: 'user', content: input.userText });
    await this.conversations.touch(input.conversationId, { titleIfEmpty: deriveTitle(input.userText) });

    const messages: LlmMessage[] = [
      { role: 'system', content: this.prompts.buildSystemPrompt({ userContext: input.userContext, summary }) },
      ...history,
      { role: 'user', content: input.userText },
    ];
    const toolDefinitions = this.tools.toLlmDefinitions();

    let text = '';
    let finalText: string | null = null;
    let cancelled = false;

    try {
      for (let step = 0; step < this.config.agent.maxSteps; step += 1) {
        if (signal.aborted) {
          cancelled = true;
          break;
        }
        yield { type: 'state', state: 'thinking' };
        const thinking = addStep('thinking', step === 0 ? 'Understanding the request' : 'Reviewing tool results');
        const llmStarted = stopwatch.elapsed();
        metrics.llmCalls += 1;
        text = '';
        const calls: LlmToolCall[] = [];

        for await (const event of this.llm.streamChat({ messages, tools: toolDefinitions, signal })) {
          if (event.type === 'text_delta') {
            if (metrics.firstTokenMs === null) metrics.firstTokenMs = stopwatch.elapsed();
            text += event.delta;
            yield { type: 'text_delta', delta: event.delta };
          } else if (event.type === 'tool_call') {
            calls.push(event.call);
            yield { type: 'tool_call', callId: event.call.id, name: event.call.name, args: safeParseArgs(event.call.arguments) };
          }
        }
        thinking.durationMs = stopwatch.elapsed() - llmStarted;

        if (!calls.length) {
          finalText = text;
          break;
        }
        if (text.trim()) thinking.label = truncate(text.trim(), 140);
        messages.push({ role: 'assistant', content: text || null, toolCalls: calls });

        yield { type: 'state', state: 'executing_tools' };
        for (const call of calls) {
          addStep('tool_call', call.name, { callId: call.id, name: call.name, args: safeParseArgs(call.arguments) });
        }
        const executions = await this.executor.executeAll(calls, context);
        metrics.toolCalls += executions.length;

        for (const execution of executions) {
          const summaryText = execution.ok ? (execution.result?.summary ?? 'done') : (execution.error ?? 'failed');
          yield {
            type: 'tool_result',
            callId: execution.call.id,
            name: execution.call.name,
            ok: execution.ok,
            summary: summaryText,
            durationMs: execution.durationMs,
            data: execution.ok ? execution.result?.data : undefined,
          };
          addStep(
            'tool_result',
            execution.ok ? summaryText : `${execution.call.name} failed: ${summaryText}`,
            { callId: execution.call.id, name: execution.call.name, ok: execution.ok },
            execution.durationMs,
          );
          const retrieval = execution.ok ? execution.result?.retrieval : undefined;
          if (retrieval) {
            yield { type: 'retrieval_evaluated', callId: execution.call.id, ...retrieval };
            addStep('retrieval_evaluated', `Retrieval ${retrieval.assessment}: ${retrieval.reason}`, {
              callId: execution.call.id,
              ...retrieval,
            });
          }
          messages.push({
            role: 'tool',
            toolCallId: execution.call.id,
            name: execution.call.name,
            content: ToolExecutor.toModelPayload(execution),
          });
        }
        if (signal.aborted) {
          cancelled = true;
          break;
        }
      }
    } catch (error) {
      if (signal.aborted || isAbortError(error)) {
        cancelled = true;
      } else {
        throw error;
      }
    }

    if (cancelled) {
      this.logger.log(`Turn ${input.turnId} cancelled`);
      yield { type: 'cancelled', partialText: text };
      return;
    }

    const answer = finalText && finalText.trim() ? finalText : FALLBACK_ANSWER;
    const extracted = extractCitations(answer, citations);
    addStep('answer', extracted.sources.length ? `Answered with ${extracted.sources.length} cited source(s)` : 'Answered');

    const fullMetrics: TurnMetrics = {
      sttMs: null,
      firstTokenMs: metrics.firstTokenMs,
      firstAudioMs: null,
      ttsMs: null,
      totalMs: stopwatch.elapsed(),
      llmCalls: metrics.llmCalls,
      toolCalls: metrics.toolCalls,
    };
    const assistantRow = await this.messages.append({
      conversationId: input.conversationId,
      role: 'assistant',
      content: extracted.text,
      sources: extracted.sources,
      steps,
      metrics: fullMetrics,
    });
    await this.conversations.touch(input.conversationId);

    yield {
      type: 'completed',
      result: {
        text: extracted.text,
        spokenText: extracted.spokenText,
        sources: extracted.sources,
        steps,
        metrics: fullMetrics,
        userMessage: toMessage(userRow),
        assistantMessage: toMessage(assistantRow),
      },
    };
  }
}
