import { DEFAULT_PERSONA, type Source } from '@voice-agent/contracts';
import { z } from 'zod';
import { type AppConfigService, type MessageRow, Stopwatch } from '../../common';
import { type ConversationRepository, type MemoryService, type MessageRepository } from '../conversations';
import { type LlmChatOptions, type LlmProvider, type LlmStreamEvent } from '../llm';
import { type Tool, ToolExecutor, ToolRegistry } from '../tools';
import { type AgentEvent } from './agent-events';
import { AgentRuntime } from './agent-runtime';
import { PromptBuilder } from './prompt-builder';

/** Replays a scripted list of model steps; records what it was asked. */
class ScriptedLlm implements LlmProvider {
  readonly model = 'scripted';
  readonly requests: LlmChatOptions[] = [];
  constructor(private readonly script: LlmStreamEvent[][]) {}
  async *streamChat(options: LlmChatOptions): AsyncIterable<LlmStreamEvent> {
    this.requests.push(options);
    const events = this.script.shift() ?? [{ type: 'done', finishReason: 'stop' }];
    for (const event of events) {
      if (options.signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      yield event;
    }
  }
  async complete(): Promise<string> {
    return '';
  }
}

const text = (value: string): LlmStreamEvent[] => [
  ...value.split(' ').map((word, i): LlmStreamEvent => ({ type: 'text_delta', delta: i ? ` ${word}` : word })),
  { type: 'done', finishReason: 'stop' },
];
const toolCalls = (...calls: [string, string, object][]): LlmStreamEvent[] => [
  ...calls.map(([id, name, args]): LlmStreamEvent => ({ type: 'tool_call', call: { id, name, arguments: JSON.stringify(args) } })),
  { type: 'done', finishReason: 'tool_calls' },
];

const source = (n: number): Omit<Source, 'index'> => ({
  chunkId: `chunk-${n}`,
  documentId: 'doc',
  documentSlug: 'pto-and-leave-policy',
  documentTitle: 'PTO and Leave Policy',
  sectionPath: 'Carryover',
  excerpt: 'Up to 5 days carry over.',
  score: 0.8,
});

function makeSearchTool(assessments: ('strong' | 'weak' | 'none')[]): Tool {
  return {
    name: 'search_knowledge_base',
    description: 'search',
    schema: z.object({ queries: z.array(z.string()) }),
    timeoutMs: 1000,
    mutating: false,
    execute: async (_args, context) => {
      const assessment = assessments.shift() ?? 'strong';
      const registered = assessment === 'none' ? [] : [context.citations.register(source(context.citations.all().length + 1))];
      return {
        data: { assessment, passages: registered.map((s) => ({ ref: s.index, text: s.excerpt })) },
        summary: `${registered.length} passages (${assessment})`,
        retrieval: { assessment, topScore: assessment === 'none' ? null : 0.7, hits: registered.length, queries: ['q'], reason: 'test' },
      };
    },
  } as Tool;
}

const calculateTool: Tool = {
  name: 'calculate',
  description: 'calc',
  schema: z.object({ expression: z.string() }),
  timeoutMs: 1000,
  mutating: false,
  execute: async (args) => {
    const { expression } = args as { expression: string };
    if (expression === 'boom') throw new Error('division by zero');
    await new Promise((r) => setTimeout(r, 20));
    return { data: { result: '8' }, summary: `${expression} = 8` };
  },
};

function makeRuntime(llm: LlmProvider, tools: Tool[], maxSteps = 6) {
  const rows: MessageRow[] = [];
  const messages = {
    append: jest.fn(async (input: { role: string; content: string }) => {
      const row = { id: `m${rows.length + 1}`, conversationId: 'conv', role: input.role, content: input.content, sources: (input as { sources?: unknown[] }).sources ?? [], steps: (input as { steps?: unknown[] }).steps ?? [], metrics: (input as { metrics?: unknown }).metrics ?? null, createdAt: new Date() } as unknown as MessageRow;
      rows.push(row);
      return row;
    }),
  } as unknown as MessageRepository;
  const conversations = { touch: jest.fn() } as unknown as ConversationRepository;
  const memory = { buildHistory: jest.fn().mockResolvedValue({ history: [{ role: 'user', content: 'earlier' }, { role: 'assistant', content: 'earlier answer' }], summary: null, dropped: 0 }) } as unknown as MemoryService;
  const config = { agent: { maxSteps, retrievalTopK: 5, rerankEnabled: false } } as unknown as AppConfigService;
  const registry = new ToolRegistry(tools);
  const runtime = new AgentRuntime(llm, registry, new ToolExecutor(registry), new PromptBuilder(), memory, messages, conversations, config);
  return { runtime, rows, messages, conversations };
}

async function collect(runtime: AgentRuntime, userText: string, signal = new AbortController().signal): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of runtime.run({ turnId: 't1', conversationId: 'conv', userText, userContext: DEFAULT_PERSONA, signal, stopwatch: new Stopwatch() })) {
    events.push(event);
  }
  return events;
}

const completedOf = (events: AgentEvent[]) => {
  const event = events.find((e) => e.type === 'completed');
  if (!event || event.type !== 'completed') throw new Error('no completed event');
  return event.result;
};

describe('AgentRuntime', () => {
  it('answers directly in a single step and persists both messages with history in the prompt', async () => {
    const llm = new ScriptedLlm([text('Hello there.')]);
    const { runtime, rows } = makeRuntime(llm, [calculateTool]);
    const events = await collect(runtime, 'Hi');
    const result = completedOf(events);

    expect(result.text).toBe('Hello there.');
    expect(result.sources).toEqual([]);
    expect(result.metrics).toMatchObject({ llmCalls: 1, toolCalls: 0, sttMs: null });
    expect(result.metrics.firstTokenMs).not.toBeNull();
    expect(rows.map((r) => r.role)).toEqual(['user', 'assistant']);
    expect(llm.requests[0]?.messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(events.filter((e) => e.type === 'text_delta')).toHaveLength(2);
  });

  it('runs several tool calls concurrently, evaluates retrieval and cites sources', async () => {
    const llm = new ScriptedLlm([
      toolCalls(['c1', 'search_knowledge_base', { queries: ['carryover'] }], ['c2', 'calculate', { expression: '20 - 12' }]),
      text('You can carry over five days [1], leaving 8 days.'),
    ]);
    const { runtime } = makeRuntime(llm, [makeSearchTool(['strong']), calculateTool]);
    const events = await collect(runtime, 'How many days carry over and how many do I have left?');

    expect(events.filter((e) => e.type === 'tool_call').map((e) => e.type === 'tool_call' && e.name)).toEqual(['search_knowledge_base', 'calculate']);
    expect(events.filter((e) => e.type === 'tool_result')).toHaveLength(2);
    expect(events.find((e) => e.type === 'retrieval_evaluated')).toMatchObject({ assessment: 'strong', hits: 1 });
    expect(events.filter((e) => e.type === 'state').map((e) => e.type === 'state' && e.state)).toEqual(['thinking', 'executing_tools', 'thinking']);

    const result = completedOf(events);
    expect(result.sources).toHaveLength(1);
    expect(result.text).toContain('[1]');
    expect(result.spokenText).toBe('You can carry over five days, leaving 8 days.');
    expect(result.metrics).toMatchObject({ llmCalls: 2, toolCalls: 2 });
    expect(result.steps.map((s) => s.type)).toEqual(['thinking', 'tool_call', 'tool_call', 'tool_result', 'retrieval_evaluated', 'tool_result', 'thinking', 'answer']);

    const second = llm.requests[1]!;
    const toolMessages = second.messages.filter((m) => m.role === 'tool');
    expect(toolMessages).toHaveLength(2);
    expect(JSON.parse((toolMessages[1] as { content: string }).content)).toEqual({ ok: true, data: { result: '8' } });
  });

  it('reformulates when retrieval is weak and abstains when it is empty', async () => {
    const llm = new ScriptedLlm([
      toolCalls(['c1', 'search_knowledge_base', { queries: ['dogs'] }]),
      toolCalls(['c2', 'search_knowledge_base', { queries: ['pets in the office'] }]),
      text("The knowledge base doesn't cover pets, so I can't confirm that."),
    ]);
    const { runtime } = makeRuntime(llm, [makeSearchTool(['weak', 'none'])]);
    const events = await collect(runtime, 'Can I bring my dog?');
    const assessments = events.filter((e) => e.type === 'retrieval_evaluated').map((e) => e.type === 'retrieval_evaluated' && e.assessment);
    expect(assessments).toEqual(['weak', 'none']);
    const result = completedOf(events);
    expect(result.metrics.llmCalls).toBe(3);
    expect(result.sources).toEqual([]);
  });

  it('feeds tool failures back to the model instead of aborting the turn', async () => {
    const llm = new ScriptedLlm([toolCalls(['c1', 'calculate', { expression: 'boom' }]), text('Sorry, the calculation failed.')]);
    const { runtime } = makeRuntime(llm, [calculateTool]);
    const events = await collect(runtime, 'divide by zero');
    const failure = events.find((e) => e.type === 'tool_result');
    expect(failure).toMatchObject({ ok: false, summary: 'division by zero' });
    const toolMessage = llm.requests[1]!.messages.find((m) => m.role === 'tool') as { content: string };
    expect(JSON.parse(toolMessage.content)).toEqual({ ok: false, error: 'division by zero' });
    expect(completedOf(events).text).toBe('Sorry, the calculation failed.');
  });

  it('stops at the step budget with a graceful fallback answer', async () => {
    const llm = new ScriptedLlm(Array.from({ length: 5 }, () => toolCalls(['c', 'calculate', { expression: '1+1' }])));
    const { runtime } = makeRuntime(llm, [calculateTool], 2);
    const result = completedOf(await collect(runtime, 'loop forever'));
    expect(result.metrics.llmCalls).toBe(2);
    expect(result.text).toMatch(/rephrase/u);
  });

  it('emits a cancelled event and does not persist an answer when aborted', async () => {
    const controller = new AbortController();
    const llm = new ScriptedLlm([toolCalls(['c1', 'calculate', { expression: '2+2' }]), text('never')]);
    const slowTool: Tool = { ...calculateTool, execute: async () => { controller.abort(); await new Promise((r) => setTimeout(r, 5)); return { data: 4, summary: '4' }; } };
    const { runtime, rows } = makeRuntime(llm, [slowTool]);
    const events = await collect(runtime, 'cancel me', controller.signal);
    expect(events[events.length - 1]).toMatchObject({ type: 'cancelled' });
    expect(events.some((e) => e.type === 'completed')).toBe(false);
    expect(rows.map((r) => r.role)).toEqual(['user']);
  });
});
