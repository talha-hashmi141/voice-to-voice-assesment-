import { type SearchHit } from '@voice-agent/contracts';

/** Optional second-stage reranking; the default implementation is a pass-through. */
export interface Reranker {
  readonly name: string;
  rerank(query: string, hits: SearchHit[], signal?: AbortSignal): Promise<SearchHit[]>;
}

export const RERANKER = Symbol('RERANKER');

export class NoopReranker implements Reranker {
  readonly name = 'none';
  async rerank(_query: string, hits: SearchHit[]): Promise<SearchHit[]> {
    return hits;
  }
}
