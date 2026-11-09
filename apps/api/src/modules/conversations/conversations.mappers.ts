import {
  type AgentStep,
  type Conversation,
  type Message,
  type Source,
  type TurnMetrics,
} from '@voice-agent/contracts';
import { type ConversationRow, type MessageRow, toIso } from '../../common';

export const toMessage = (row: MessageRow): Message => ({
  id: row.id,
  conversationId: row.conversationId,
  role: row.role === 'assistant' ? 'assistant' : 'user',
  content: row.content,
  sources: (row.sources ?? []) as Source[],
  steps: (row.steps ?? []) as AgentStep[],
  metrics: (row.metrics as TurnMetrics | null) ?? null,
  createdAt: toIso(row.createdAt),
});

export const toConversation = (row: ConversationRow, messageCount: number): Conversation => ({
  id: row.id,
  title: row.title,
  userContext: row.userContext ?? null,
  messageCount,
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt),
});

/** First user utterance, trimmed to a readable title. */
export const deriveTitle = (text: string, max = 60): string => {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 20))}…`;
};
