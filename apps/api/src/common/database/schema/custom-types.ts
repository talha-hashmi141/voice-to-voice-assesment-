import { customType } from 'drizzle-orm/pg-core';

/** Postgres full-text search vector; populated by a generated column (see migrations). */
export const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

export const EMBEDDING_DIMENSIONS = 1536;
