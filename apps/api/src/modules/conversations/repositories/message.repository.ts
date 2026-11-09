import { Inject, Injectable } from '@nestjs/common';
import { type AgentStep, type Source, type TurnMetrics } from '@voice-agent/contracts';
import { asc, eq } from 'drizzle-orm';
import { DATABASE, type Database, type MessageRow, messages } from '../../../common';

export interface AppendMessageInput {
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  steps?: AgentStep[];
  metrics?: TurnMetrics | null;
}

@Injectable()
export class MessageRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async append(input: AppendMessageInput): Promise<MessageRow> {
    const [row] = await this.db
      .insert(messages)
      .values({
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        sources: input.sources ?? [],
        steps: input.steps ?? [],
        metrics: input.metrics ?? null,
      })
      .returning();
    return row!;
  }

  async listByConversation(conversationId: string): Promise<MessageRow[]> {
    return this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt), asc(messages.id));
  }

  async updateMetrics(id: string, metrics: TurnMetrics): Promise<void> {
    await this.db.update(messages).set({ metrics }).where(eq(messages.id, id));
  }
}
