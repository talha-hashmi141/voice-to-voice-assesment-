import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  type AgentStep,
  type AgentStepType,
  type TurnMetrics,
  type UserContext,
} from '@voice-agent/contracts';
import { AppConfigService, Stopwatch, truncate } from '../../common';
import {
  ConversationRepository,
  deriveTitle,
  MemoryService,
  MessageRepository,
  toMessage,
} from '../conversations';
import { countTokens, RetrievalEvaluator, RetrievalService } from '../knowledge';
import {
  estimateChatCost,
  LLM_PROVIDER,
  type LlmMessage,
  type LlmProvider,
  type LlmToolCall,
} from '../llm';
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

/** Confirmations and very short replies ("yes please, high priority") are not worth a retrieval round-trip. */
const CONFIRMATION =
  /^\s*(yes|yeah|yep|sure|ok|okay|please do|go ahead|do it|confirm|correct|that's right|no|nope)\b/iu;
const looksLikeQuestion = (text: string): boolean =>
  !CONFIRMATION.test(text) &&
  text
    .trim()
    .split(/\s+/u)
    .filter((word) => word.length > 2).length >= 4;

const messageText = (message: LlmMessage): string =>
  message.role === 'assistant'
    ? `${message.content ?? ''} ${(message.toolCalls ?? []).map((call) => `${call.name} ${call.arguments}`).join(' ')}`
    : message.content;

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
    private readonly retrieval: RetrievalService,
    private readonly evaluator: RetrievalEvaluator,
  ) {}

  /**
   * Eager retrieval: search the knowledge base for the raw message before the first model call.
   * Simple questions then finish in a single model round (one call and one prompt cheaper); the
   * model can still call search_knowledge_base when the pre-fetched passages do not answer.
   */
  private async *prefetchPassages(
    input: AgentRunInput,
    context: ToolContext,
    stopwatch: Stopwatch,
    addStep: (
      type: AgentStepType,
      label: string,
      data?: Record<string, unknown>,
      durationMs?: number,
    ) => AgentStep,
  ): AsyncGenerator<AgentEvent, string | null> {
    const callId = `${input.turnId}-prefetch`;
    const started = stopwatch.elapsed();
    const args = { queries: [input.userText], eager: true };
    yield { type: 'tool_call', callId, name: 'search_knowledge_base', args };
    addStep('tool_call', 'search_knowledge_base (pre-fetched)', {
      callId,
      name: 'search_knowledge_base',
      args,
    });

    let outcome: Awaited<ReturnType<RetrievalService['search']>>;
    try {
      outcome = await this.retrieval.search({
        queries: [input.userText],
        topK: Math.min(4, this.config.agent.retrievalTopK),
        mode: 'hybrid',
        signal: input.signal,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const durationMs = stopwatch.elapsed() - started;
      yield {
        type: 'tool_result',
        callId,
        name: 'search_knowledge_base',
        ok: false,
        summary: message,
        durationMs,
      };
      addStep('tool_result', `pre-fetch failed: ${message}`, { callId, ok: false }, durationMs);
      return null;
    }

    const evaluation = this.evaluator.evaluate(outcome.hits);
    const durationMs = stopwatch.elapsed() - started;
    const passages = outcome.hits.map((hit) => {
      const source = context.citations.register({
        chunkId: hit.chunkId,
        documentId: hit.documentId,
        documentSlug: hit.documentSlug,
        documentTitle: hit.documentTitle,
        sectionPath: hit.sectionPath,
        excerpt: truncate(hit.content, 400),
        score: hit.scores.fused,
      });
      return {
        ref: source.index,
        document: hit.documentTitle,
        section: hit.sectionPath,
        text: hit.content,
        score: hit.scores.dense,
      };
    });
    const documents = [...new Set(passages.map((p) => p.document))];
    const summary = passages.length
      ? `${passages.length} passages (${evaluation.assessment}) from ${documents.slice(0, 3).join(', ')}`
      : 'No passages found';
    yield {
      type: 'tool_result',
      callId,
      name: 'search_knowledge_base',
      ok: true,
      summary,
      durationMs,
      data: {
        assessment: evaluation.assessment,
        passages: passages.map(({ ref, document, section, score }) => ({
          ref,
          document,
          section,
          score,
        })),
      },
    };
    addStep(
      'tool_result',
      summary,
      { callId, name: 'search_knowledge_base', ok: true },
      durationMs,
    );
    const retrieval = {
      assessment: evaluation.assessment,
      topScore: evaluation.topScore,
      hits: passages.length,
      queries: outcome.queries,
      reason: evaluation.reason,
    };
    yield { type: 'retrieval_evaluated', callId, ...retrieval };
    addStep('retrieval_evaluated', `Retrieval ${retrieval.assessment}: ${retrieval.reason}`, {
      callId,
      ...retrieval,
    });

    if (evaluation.assessment === 'none' || !passages.length) {
      return 'Pre-fetched knowledge-base search for the latest message found nothing relevant. If the question is about company policies or processes, call search_knowledge_base with different, more specific phrasing before answering; otherwise answer from the conversation and tools.';
    }
    const block = passages
      .map((p) => `[${p.ref}] ${p.document} › ${p.section}\n${p.text}`)
      .join('\n\n');
    return `Pre-fetched knowledge-base passages for the latest message (relevance: ${evaluation.assessment}). Cite them with their [ref] numbers if you use them; call search_knowledge_base if they do not answer the question.\n\n${block}`;
  }

  async *run(input: AgentRunInput): AsyncGenerator<AgentEvent> {
    const { signal } = input;
    const stopwatch = input.stopwatch ?? new Stopwatch();
    const steps: AgentStep[] = [];
    let stepSeq = 0;
    const addStep = (
      type: AgentStepType,
      label: string,
      data?: Record<string, unknown>,
      durationMs?: number,
    ): AgentStep => {
      stepSeq += 1;
      const step: AgentStep = {
        id: `${input.turnId}-${stepSeq}`,
        type,
        at: stopwatch.elapsed(),
        label,
      };
      if (data) step.data = data;
      if (durationMs !== undefined) step.durationMs = durationMs;
      steps.push(step);
      return step;
    };

    const metrics = { firstTokenMs: null as number | null, llmCalls: 0, toolCalls: 0 };
    const usage = { promptTokens: 0, cachedPromptTokens: 0, completionTokens: 0, reported: false };
    const citations = new CitationRegistry();
    const context: ToolContext = {
      turnId: input.turnId,
      conversationId: input.conversationId,
      userContext: input.userContext,
      citations,
      signal,
    };

    const { history, summary } = await this.memory.buildHistory(input.conversationId);
    const userRow = await this.messages.append({
      conversationId: input.conversationId,
      role: 'user',
      content: input.userText,
    });
    await this.conversations.touch(input.conversationId, {
      titleIfEmpty: deriveTitle(input.userText),
    });

    const messages: LlmMessage[] = [
      {
        role: 'system',
        content: this.prompts.buildSystemPrompt({ userContext: input.userContext, summary }),
      },
      ...history,
    ];
    if (this.config.agent.eagerRetrieval && looksLikeQuestion(input.userText)) {
      const prefetch = yield* this.prefetchPassages(input, context, stopwatch, addStep);
      if (prefetch) messages.push({ role: 'system', content: prefetch });
    }
    messages.push({ role: 'user', content: input.userText });
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
        const thinking = addStep(
          'thinking',
          step === 0 ? 'Understanding the request' : 'Reviewing tool results',
        );
        const llmStarted = stopwatch.elapsed();
        metrics.llmCalls += 1;
        text = '';
        const calls: LlmToolCall[] = [];

        for await (const event of this.llm.streamChat({
          messages,
          tools: toolDefinitions,
          signal,
          maxTokens: this.config.agent.maxOutputTokens,
        })) {
          if (event.type === 'done' && event.usage) {
            usage.reported = true;
            usage.promptTokens += event.usage.promptTokens;
            usage.cachedPromptTokens += event.usage.cachedPromptTokens ?? 0;
            usage.completionTokens += event.usage.completionTokens;
          } else if (event.type === 'text_delta') {
            if (metrics.firstTokenMs === null) metrics.firstTokenMs = stopwatch.elapsed();
            text += event.delta;
            yield { type: 'text_delta', delta: event.delta };
          } else if (event.type === 'tool_call') {
            calls.push(event.call);
            yield {
              type: 'tool_call',
              callId: event.call.id,
              name: event.call.name,
              args: safeParseArgs(event.call.arguments),
            };
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
          addStep('tool_call', call.name, {
            callId: call.id,
            name: call.name,
            args: safeParseArgs(call.arguments),
          });
        }
        const executions = await this.executor.executeAll(calls, context);
        metrics.toolCalls += executions.length;

        for (const execution of executions) {
          const summaryText = execution.ok
            ? (execution.result?.summary ?? 'done')
            : (execution.error ?? 'failed');
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
            addStep(
              'retrieval_evaluated',
              `Retrieval ${retrieval.assessment}: ${retrieval.reason}`,
              {
                callId: execution.call.id,
                ...retrieval,
              },
            );
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
    addStep(
      'answer',
      extracted.sources.length
        ? `Answered with ${extracted.sources.length} cited source(s)`
        : 'Answered',
    );

    // When the provider reported no usage (e.g. the stream was interrupted before its usage frame),
    // estimate it locally so the cost stays visible; it is labelled an estimate in the UI anyway.
    if (!usage.reported && metrics.llmCalls > 0) {
      usage.promptTokens = messages.reduce(
        (sum, message) => sum + countTokens(messageText(message)) + 4,
        0,
      );
      usage.completionTokens = countTokens(answer);
      usage.reported = true;
    }
    const fullMetrics: TurnMetrics = {
      sttMs: null,
      firstTokenMs: metrics.firstTokenMs,
      firstAudioMs: null,
      ttsMs: null,
      totalMs: stopwatch.elapsed(),
      llmCalls: metrics.llmCalls,
      toolCalls: metrics.toolCalls,
      promptTokens: usage.promptTokens,
      cachedPromptTokens: usage.cachedPromptTokens,
      completionTokens: usage.completionTokens,
      estimatedCostUsd: estimateChatCost(this.llm.model, usage),
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
