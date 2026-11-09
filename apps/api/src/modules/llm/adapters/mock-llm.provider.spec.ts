import { type LlmMessage, type LlmStreamEvent } from '../llm-provider.port';
import { MockLlmProvider } from './mock-llm.provider';

const tools = ['search_knowledge_base', 'get_current_datetime', 'get_leave_balance', 'create_support_ticket'].map(
  (name) => ({ name, description: '', parameters: {} }),
);

async function collect(iterable: AsyncIterable<LlmStreamEvent>): Promise<LlmStreamEvent[]> {
  const events: LlmStreamEvent[] = [];
  for await (const event of iterable) events.push(event);
  return events;
}

describe('MockLlmProvider', () => {
  const llm = new MockLlmProvider();

  it('plans parallel tool calls from the user text on the first step', async () => {
    const events = await collect(
      llm.streamChat({ messages: [{ role: 'user', content: 'How many PTO days do I have left this year?' }], tools }),
    );
    const names = events.filter((e) => e.type === 'tool_call').map((e) => (e.type === 'tool_call' ? e.call.name : ''));
    expect(names).toEqual(['search_knowledge_base', 'get_current_datetime', 'get_leave_balance']);
    expect(events[events.length - 1]).toEqual({ type: 'done', finishReason: 'tool_calls' });
  });

  it('answers from tool results with a citation marker', async () => {
    const messages: LlmMessage[] = [
      { role: 'user', content: 'What is the receipt rule?' },
      { role: 'assistant', content: null, toolCalls: [{ id: 'c1', name: 'search_knowledge_base', arguments: '{}' }] },
      {
        role: 'tool',
        toolCallId: 'c1',
        name: 'search_knowledge_base',
        content: JSON.stringify({
          ok: true,
          data: {
            assessment: 'strong',
            passages: [{ ref: 1, document: 'Expense Policy', section: 'Receipts', text: 'A receipt is required above $25. Statements are not accepted.' }],
          },
        }),
      },
    ];
    const events = await collect(llm.streamChat({ messages, tools }));
    const text = events.map((e) => (e.type === 'text_delta' ? e.delta : '')).join('');
    expect(text).toContain('A receipt is required above $25.');
    expect(text).toContain('[1]');
  });

  it('abstains when retrieval found nothing', async () => {
    const messages: LlmMessage[] = [
      { role: 'user', content: 'Can I bring my dog?' },
      { role: 'assistant', content: null, toolCalls: [{ id: 'c1', name: 'search_knowledge_base', arguments: '{}' }] },
      { role: 'tool', toolCallId: 'c1', name: 'search_knowledge_base', content: JSON.stringify({ ok: true, data: { assessment: 'none', passages: [] } }) },
    ];
    const events = await collect(llm.streamChat({ messages, tools }));
    const text = events.map((e) => (e.type === 'text_delta' ? e.delta : '')).join('');
    expect(text).toMatch(/couldn't find anything/u);
  });

  it('creates a ticket when the user confirms a previous offer', async () => {
    const messages: LlmMessage[] = [
      { role: 'user', content: 'My laptop screen is cracked' },
      { role: 'assistant', content: 'Would you like me to open a support ticket about: "My laptop screen is cracked"?' },
      { role: 'user', content: 'Yes please, high priority' },
    ];
    const events = await collect(llm.streamChat({ messages, tools }));
    const call = events.find((e) => e.type === 'tool_call');
    expect(call?.type === 'tool_call' && call.call.name).toBe('create_support_ticket');
    expect(call?.type === 'tool_call' && JSON.parse(call.call.arguments)).toMatchObject({ priority: 'high', title: 'My laptop screen is cracked' });
  });
});
