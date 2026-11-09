import { Inject, Injectable } from '@nestjs/common';
import { and, asc, cosineDistance, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { DATABASE, type Database, chunks, documents, type NewChunkRow } from '../../../common';
import { type DenseHit, type RetrievedChunk, type SparseHit } from '../entities';

const joinedColumns = {
  chunkId: chunks.id,
  documentId: chunks.documentId,
  documentSlug: documents.slug,
  documentTitle: documents.title,
  sectionPath: chunks.sectionPath,
  ordinal: chunks.ordinal,
  content: chunks.content,
  tokenCount: chunks.tokenCount,
};

/** Builds an OR'ed English tsquery from free text so partial keyword overlap still matches. */
export function buildOrTsQuery(query: string): string | null {
  const terms = Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/u)
        .filter((term) => term.length > 1),
    ),
  );
  return terms.length ? terms.map((term) => `${term}:*`).join(' | ') : null;
}

@Injectable()
export class ChunkRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Atomically replaces a document's chunks (delete + insert in one transaction). */
  async replaceForDocument(documentId: string, rows: Omit<NewChunkRow, 'documentId'>[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(chunks).where(eq(chunks.documentId, documentId));
      if (rows.length) {
        await tx.insert(chunks).values(rows.map((row) => ({ ...row, documentId })));
      }
    });
  }

  async findByDocument(documentId: string): Promise<RetrievedChunk[]> {
    return this.db
      .select(joinedColumns)
      .from(chunks)
      .innerJoin(documents, eq(chunks.documentId, documents.id))
      .where(eq(chunks.documentId, documentId))
      .orderBy(asc(chunks.ordinal));
  }

  async findByIds(ids: string[]): Promise<RetrievedChunk[]> {
    if (!ids.length) return [];
    return this.db
      .select(joinedColumns)
      .from(chunks)
      .innerJoin(documents, eq(chunks.documentId, documents.id))
      .where(inArray(chunks.id, ids));
  }

  /** Vector search via pgvector cosine distance (HNSW index). */
  async searchDense(queryEmbedding: number[], limit: number): Promise<DenseHit[]> {
    const distance = cosineDistance(chunks.embedding, queryEmbedding);
    const rows = await this.db
      .select({ ...joinedColumns, distance: sql<number>`${distance}` })
      .from(chunks)
      .innerJoin(documents, eq(chunks.documentId, documents.id))
      .where(isNotNull(chunks.embedding))
      .orderBy(asc(distance))
      .limit(limit);
    return rows.map(({ distance: d, ...row }) => ({ ...row, similarity: 1 - Number(d) }));
  }

  /** Full-text search via the generated tsvector column (GIN index), ranked with ts_rank_cd. */
  async searchSparse(query: string, limit: number): Promise<SparseHit[]> {
    const tsQuery = buildOrTsQuery(query);
    if (!tsQuery) return [];
    const matcher = sql`to_tsquery('english', ${tsQuery})`;
    const rank = sql<number>`ts_rank_cd(${chunks.tsv}, ${matcher}, 32)`;
    const rows = await this.db
      .select({ ...joinedColumns, rank })
      .from(chunks)
      .innerJoin(documents, eq(chunks.documentId, documents.id))
      .where(and(sql`${chunks.tsv} @@ ${matcher}`))
      .orderBy(desc(rank))
      .limit(limit);
    return rows.map((row) => ({ ...row, rank: Number(row.rank) }));
  }

  /** Adjacent chunks of the same section, used for small-to-big context expansion. */
  async findNeighbours(documentId: string, sectionPath: string, ordinal: number, radius = 1): Promise<RetrievedChunk[]> {
    return this.db
      .select(joinedColumns)
      .from(chunks)
      .innerJoin(documents, eq(chunks.documentId, documents.id))
      .where(
        and(
          eq(chunks.documentId, documentId),
          eq(chunks.sectionPath, sectionPath),
          sql`${chunks.ordinal} between ${ordinal - radius} and ${ordinal + radius}`,
        ),
      )
      .orderBy(asc(chunks.ordinal));
  }

  async countAll(): Promise<number> {
    const [row] = await this.db.select({ count: sql<number>`count(*)::int` }).from(chunks);
    return row?.count ?? 0;
  }
}
