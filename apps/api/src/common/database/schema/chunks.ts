import { sql } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, uuid, vector } from 'drizzle-orm/pg-core';
import { EMBEDDING_DIMENSIONS, tsvector } from './custom-types';
import { documents } from './documents';

export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    ordinal: integer('ordinal').notNull(),
    sectionPath: text('section_path').notNull().default(''),
    /** Raw chunk text shown to users and cited as a source. */
    content: text('content').notNull(),
    /** Contextualised text that was embedded: "Document: … / Section: … / <content>". */
    embeddedText: text('embedded_text').notNull(),
    tokenCount: integer('token_count').notNull(),
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }),
    /** Generated column: to_tsvector('english', section_path || ' ' || content). */
    tsv: tsvector('tsv').generatedAlwaysAs(
      sql`to_tsvector('english', coalesce(section_path, '') || ' ' || content)`,
    ),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('chunks_document_idx').on(table.documentId, table.ordinal),
    index('chunks_embedding_hnsw_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
    index('chunks_tsv_gin_idx').using('gin', table.tsv),
  ],
);

export type ChunkRow = typeof chunks.$inferSelect;
export type NewChunkRow = typeof chunks.$inferInsert;
