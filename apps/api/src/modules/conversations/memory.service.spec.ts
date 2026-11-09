import { type MessageRow } from '../../common';
import { MemoryService } from './memory.service';
import { type ConversationRepository, type MessageRepository } from './repositories';

const row = (role: string, content: string, i: number): MessageRow =>
  ({ id: `m${i}`, conversationId: 'c', role, content, createdAt: new Date(2026, 0, 1, 0, i) }) as unknown as MessageRow;

describe('MemoryService', () => {
  const rows = [
    row('user', 'How many PTO days do I get?', 1),
    row('assistant', 'You get 20 days a year [1].', 2),
    row('tool', '{"ignored":true}', 3),
    row('user', 'And sick days?', 4),
    row('assistant', 'Ten per year.', 5),
  ];
  const messages = { listByConversation: jest.fn().mockResolvedValue(rows) } as unknown as MessageRepository;
  const conversations = { findById: jest.fn().mockResolvedValue({ summary: 'Earlier: asked about holidays.' }) } as unknown as ConversationRepository;
  const memory = new MemoryService(messages, conversations);

  it('returns user/assistant turns in order, skipping tool rows, with the summary', async () => {
    const result = await memory.buildHistory('c');
    expect(result.history.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
    expect(result.summary).toBe('Earlier: asked about holidays.');
    expect(result.dropped).toBe(0);
  });

  it('keeps the most recent turns when the token budget is small', async () => {
    const result = await memory.buildHistory('c', 20);
    expect(result.history.length).toBeLessThan(4);
    expect(result.history[result.history.length - 1]?.content).toBe('Ten per year.');
    expect(result.dropped).toBeGreaterThan(0);
  });
});
