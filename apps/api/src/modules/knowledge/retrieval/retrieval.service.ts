import { Inject, Injectable, Logger } from '@nestjs/common';
import { type RetrievalMode, type SearchHit } from '@voice-agent/contracts';
import { AppConfigService, normaliseWhitespace } from '../../../common';
import { EMBEDDING_PROVIDER, type EmbeddingProvider } from '../../embeddings';
import { type RetrievedChunk } from '../entities';
import { ChunkRepository } from '../repositories';
import { RERANKER, type Reranker } from './reranker.port';
import { type RankedList, reciprocalRankFusion } from './rrf';

export interface SearchOptions {
  /** One to three phrasings; results are fused across all of them. */
  queries: string[];
  topK: number;
  mode?: RetrievalMode;
  /** Candidates fetched per channel per query before fusion. */
  candidateLimit?: number;
  rerank?: boolean;
  signal?: AbortSignal;
}

export interface SearchOutcome {
  hits: SearchHit[];
  tookMs: number;
  queries: string[];
  channels: { dense: number; sparse: number };
}

/**
 * Hybrid retrieval: dense (pgvector cosine) + sparse (Postgres full-text) for every query
 * phrasing, run concurrently and fused with Reciprocal Rank Fusion, then optionally reranked.
 */
@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    private readonly chunks: ChunkRepository,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddings: EmbeddingProvider,
    @Inject(RERANKER) private readonly reranker: Reranker,
    private readonly config: AppConfigService,
  ) {}

  async search(options: SearchOptions): Promise<SearchOutcome> {
    const started = performance.now();
    const mode = options.mode ?? 'hybrid';
    const queries = Array.from(
      new Set(options.queries.map(normaliseWhitespace).filter(Boolean)),
    ).slice(0, 3);
    if (!queries.length) return { hits: [], tookMs: 0, queries, channels: { dense: 0, sparse: 0 } };

    const limit = options.candidateLimit ?? Math.max(20, options.topK * 4);
    const useDense = mode !== 'sparse';
    const useSparse = mode !== 'dense';

    const vectors = useDense ? await this.embeddings.embed(queries, options.signal) : [];
    const registry = new Map<string, RetrievedChunk>();
    const remember = (rows: RetrievedChunk[]) =>
      rows.forEach((row) => registry.set(row.chunkId, row));

    const denseLists = useDense
      ? queries.map(async (_, i): Promise<RankedList> => {
          const rows = await this.chunks.searchDense(vectors[i]!, limit);
          remember(rows);
          return {
            channel: 'dense',
            items: rows.map((row) => ({ id: row.chunkId, score: row.similarity })),
          };
        })
      : [];
    const sparseLists = useSparse
      ? queries.map(async (query): Promise<RankedList> => {
          const rows = await this.chunks.searchSparse(query, limit);
          remember(rows);
          const max = rows[0]?.rank || 1;
          return {
            channel: 'sparse',
            weight: this.config.agent.sparseWeight,
            items: rows.map((row) => ({ id: row.chunkId, score: row.rank / max })),
          };
        })
      : [];

    const lists = await Promise.all([...denseLists, ...sparseLists]);
    const fused = reciprocalRankFusion(lists).slice(0, options.topK);

    let hits: SearchHit[] = fused.flatMap((entry, index) => {
      const chunk = registry.get(entry.id);
      if (!chunk) return [];
      return [
        {
          chunkId: chunk.chunkId,
          documentId: chunk.documentId,
          documentSlug: chunk.documentSlug,
          documentTitle: chunk.documentTitle,
          sectionPath: chunk.sectionPath,
          content: chunk.content,
          rank: index + 1,
          scores: {
            fused: entry.fused,
            dense: entry.dense === null ? null : Number(entry.dense.toFixed(4)),
            sparse: entry.sparse === null ? null : Number(entry.sparse.toFixed(4)),
          },
        },
      ];
    });

    if (options.rerank && hits.length > 1) {
      hits = (await this.reranker.rerank(queries[0]!, hits, options.signal)).map((hit, index) => ({
        ...hit,
        rank: index + 1,
      }));
    }

    const tookMs = Math.round(performance.now() - started);
    this.logger.debug(
      `search ${JSON.stringify(queries)} mode=${mode} → ${hits.length} hits in ${tookMs}ms`,
    );
    return {
      hits,
      tookMs,
      queries,
      channels: {
        dense: lists.filter((l) => l.channel === 'dense').reduce((n, l) => n + l.items.length, 0),
        sparse: lists.filter((l) => l.channel === 'sparse').reduce((n, l) => n + l.items.length, 0),
      },
    };
  }
}
