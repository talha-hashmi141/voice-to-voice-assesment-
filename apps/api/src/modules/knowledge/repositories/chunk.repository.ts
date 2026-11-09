import { Inject, Injectable } from '@nestjs/common';
import { and, asc, cosineDistance, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { DATABASE, type Database, chunks, documents, type NewChunkRow } from '../../../common';
import { type DenseHit, type RetrievedChunk, type SparseHit } from '../entities';
import { type Bm25Stats, rankBm25, toBm25Document } from '../retrieval/bm25';

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

const SPARSE_CANDIDATE_LIMIT = 500;
const STATS_TTL_MS = 60_000;

@Injectable()
export class ChunkRepository {
  private statsCache: { stats: Bm25Stats; at: number } | null = null;

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Atomically replaces a document's chunks (delete + insert in one transaction). */
  async replaceForDocument(
    documentId: string,
    rows: Omit<NewChunkRow, 'documentId'>[],
  ): Promise<void> {
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

  /**
   * Keyword search: candidates come from the GIN-indexed tsvector match on the query's lexemes;
   * ranking is BM25 (IDF + length normalisation) computed over the stored lexeme positions,
   * because Postgres' ts_rank has no notion of term rarity.
   */
  async searchSparse(query: string, limit: number): Promise<SparseHit[]> {
    const lexemes = await this.queryLexemes(query);
    if (!lexemes.length) return [];
    const matcher = sql`to_tsquery('simple', ${lexemes.map((lexeme) => `'${lexeme.replace(/'/gu, "''")}'`).join(' | ')})`;
    const [candidates, stats] = await Promise.all([
      this.db
        .select({ ...joinedColumns, tsv: sql<string>`${chunks.tsv}::text` })
        .from(chunks)
        .innerJoin(documents, eq(chunks.documentId, documents.id))
        .where(sql`${chunks.tsv} @@ ${matcher}`)
        .limit(SPARSE_CANDIDATE_LIMIT),
      this.lexemeStats(),
    ]);
    const ranked = rankBm25(
      lexemes,
      candidates.map((row) => toBm25Document(row.chunkId, row.tsv)),
      stats,
    ).slice(0, limit);
    const byId = new Map(candidates.map((row) => [row.chunkId, row]));
    return ranked.flatMap(({ id, score }) => {
      const { tsv: _tsv, ...row } = byId.get(id)!;
      return [{ ...row, rank: score }];
    });
  }

  /** Lexemes of a free-text query under the same English configuration used for the index. */
  private async queryLexemes(query: string): Promise<string[]> {
    const [row] = await this.db.execute<{ tsv: string }>(
      sql`select to_tsvector('english', ${query})::text as tsv`,
    );
    if (!row) return [];
    return Array.from(toBm25Document('q', row.tsv).termFrequencies.keys());
  }

  /** Corpus statistics for BM25 (document frequency per lexeme); cached until the index changes. */
  private async lexemeStats(): Promise<Bm25Stats> {
    const cached = this.statsCache;
    if (cached && Date.now() - cached.at < STATS_TTL_MS) return cached.stats;
    const [rows, [totals]] = await Promise.all([
      this.db.execute<{ word: string; ndoc: number }>(
        sql`select word, ndoc from ts_stat('select tsv from chunks')`,
      ),
      this.db.execute<{ total: number; avg: number }>(
        sql`select count(*)::int as total, coalesce(avg(length(tsv)), 0)::float as avg from chunks`,
      ),
    ]);
    const stats: Bm25Stats = {
      totalDocuments: Number(totals?.total ?? 0),
      averageLength: Number(totals?.avg ?? 0),
      documentFrequency: new Map(rows.map((row) => [row.word, Number(row.ndoc)])),
    };
    this.statsCache = { stats, at: Date.now() };
    return stats;
  }

  invalidateStats(): void {
    this.statsCache = null;
  }

  /** Adjacent chunks of the same section, used for small-to-big context expansion. */
  async findNeighbours(
    documentId: string,
    sectionPath: string,
    ordinal: number,
    radius = 1,
  ): Promise<RetrievedChunk[]> {
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
