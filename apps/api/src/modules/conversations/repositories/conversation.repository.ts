import { Inject, Injectable } from '@nestjs/common';
import { type UserContext } from '@voice-agent/contracts';
import { desc, eq, sql } from 'drizzle-orm';
import { type ConversationRow, conversations, DATABASE, type Database } from '../../../common';

export interface ConversationWithCount extends ConversationRow {
  messageCount: number;
}

const messageCountSql = sql<number>`(select count(*)::int from messages m where m.conversation_id = conversations.id and m.role in ('user', 'assistant'))`;

@Injectable()
export class ConversationRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(input: {
    userContext?: UserContext | null;
    title?: string | null;
  }): Promise<ConversationRow> {
    const [row] = await this.db
      .insert(conversations)
      .values({ userContext: input.userContext ?? null, title: input.title ?? null })
      .returning();
    return row!;
  }

  async findById(id: string): Promise<ConversationWithCount | null> {
    const [row] = await this.db
      .select({ ...columns(), messageCount: messageCountSql })
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);
    return row ?? null;
  }

  async list(limit = 50): Promise<ConversationWithCount[]> {
    return this.db
      .select({ ...columns(), messageCount: messageCountSql })
      .from(conversations)
      .orderBy(desc(conversations.updatedAt))
      .limit(limit);
  }

  /** Bumps updatedAt and sets the title / user context when they are still empty. */
  async touch(
    id: string,
    patch: { titleIfEmpty?: string; userContext?: UserContext | null } = {},
  ): Promise<void> {
    await this.db
      .update(conversations)
      .set({
        updatedAt: new Date(),
        ...(patch.titleIfEmpty
          ? { title: sql`coalesce(${conversations.title}, ${patch.titleIfEmpty})` }
          : {}),
        ...(patch.userContext !== undefined ? { userContext: patch.userContext } : {}),
      })
      .where(eq(conversations.id, id));
  }

  async updateSummary(id: string, summary: string | null): Promise<void> {
    await this.db.update(conversations).set({ summary }).where(eq(conversations.id, id));
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(conversations)
      .where(eq(conversations.id, id))
      .returning({ id: conversations.id });
    return deleted.length > 0;
  }
}

function columns() {
  return {
    id: conversations.id,
    title: conversations.title,
    userContext: conversations.userContext,
    summary: conversations.summary,
    createdAt: conversations.createdAt,
    updatedAt: conversations.updatedAt,
  };
}
