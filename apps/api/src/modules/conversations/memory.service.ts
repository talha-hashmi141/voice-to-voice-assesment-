import { Injectable } from '@nestjs/common';
import { countTokens } from '../knowledge';
import { type LlmMessage } from '../llm';
import { ConversationRepository, MessageRepository } from './repositories';

export interface ConversationMemory {
  /** Most recent user/assistant turns that fit the token budget, oldest first. */
  history: LlmMessage[];
  /** Rolling summary of older turns, when one exists. */
  summary: string | null;
  /** Number of older messages that did not fit the budget. */
  dropped: number;
}

export const DEFAULT_HISTORY_TOKEN_BUDGET = 6_000;

/**
 * Conversation memory = sliding window over the transcript (token-budgeted, newest first)
 * plus an optional rolling summary. Tool traces are not replayed: the assistant's final
 * answers already carry the resolved facts, which keeps follow-up prompts compact.
 */
@Injectable()
export class MemoryService {
  constructor(
    private readonly messages: MessageRepository,
    private readonly conversations: ConversationRepository,
  ) {}

  async buildHistory(
    conversationId: string,
    budgetTokens = DEFAULT_HISTORY_TOKEN_BUDGET,
  ): Promise<ConversationMemory> {
    const [rows, conversation] = await Promise.all([
      this.messages.listByConversation(conversationId),
      this.conversations.findById(conversationId),
    ]);
    const transcript = rows.filter(
      (row) => (row.role === 'user' || row.role === 'assistant') && row.content.trim(),
    );

    const kept: LlmMessage[] = [];
    let used = 0;
    for (let i = transcript.length - 1; i >= 0; i -= 1) {
      const row = transcript[i]!;
      const cost = countTokens(row.content) + 4;
      if (used + cost > budgetTokens && kept.length) break;
      used += cost;
      kept.unshift({ role: row.role as 'user' | 'assistant', content: row.content });
    }
    return {
      history: kept,
      summary: conversation?.summary ?? null,
      dropped: transcript.length - kept.length,
    };
  }
}
