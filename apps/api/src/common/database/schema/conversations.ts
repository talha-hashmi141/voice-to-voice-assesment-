import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { type UserContext } from '@voice-agent/contracts';

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: varchar('title', { length: 200 }),
    userContext: jsonb('user_context').$type<UserContext>(),
    /** Rolling summary of older turns that fell outside the context window. */
    summary: text('summary'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('conversations_updated_idx').on(table.updatedAt)],
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    /** user | assistant | tool | system – tool/system rows are internal to the agent loop. */
    role: varchar('role', { length: 20 }).notNull(),
    content: text('content').notNull().default(''),
    toolCalls: jsonb('tool_calls').$type<unknown[]>(),
    toolCallId: varchar('tool_call_id', { length: 100 }),
    toolName: varchar('tool_name', { length: 100 }),
    sources: jsonb('sources').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
    steps: jsonb('steps').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
    metrics: jsonb('metrics').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('messages_conversation_idx').on(table.conversationId, table.createdAt)],
);

export type ConversationRow = typeof conversations.$inferSelect;
export type NewConversationRow = typeof conversations.$inferInsert;
export type MessageRow = typeof messages.$inferSelect;
export type NewMessageRow = typeof messages.$inferInsert;
