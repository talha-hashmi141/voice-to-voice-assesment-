import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 200 }).notNull().unique(),
    title: varchar('title', { length: 300 }).notNull(),
    category: varchar('category', { length: 100 }).notNull().default('general'),
    tags: jsonb('tags').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    sourcePath: text('source_path'),
    content: text('content').notNull(),
    checksum: varchar('checksum', { length: 64 }).notNull(),
    /** Which embedding provider/model produced this document's chunks (so a provider switch triggers reindexing). */
    embeddingModel: varchar('embedding_model', { length: 100 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('documents_category_idx').on(table.category)],
);

export type DocumentRow = typeof documents.$inferSelect;
export type NewDocumentRow = typeof documents.$inferInsert;
