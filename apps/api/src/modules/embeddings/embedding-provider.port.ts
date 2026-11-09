export interface SimilarityThresholds {
  /** Cosine similarity at or above which a hit is considered clearly relevant. */
  strong: number;
  /** Cosine similarity below which a hit is considered noise. */
  weak: number;
}

/**
 * Port for turning text into vectors. Adapters: OpenAI (production) and a deterministic
 * feature-hashing mock (tests / no-API-key mode). `model` is persisted with each document
 * so that switching providers triggers re-indexing.
 */
export interface EmbeddingProvider {
  readonly model: string;
  readonly dimensions: number;
  /** Provider-specific calibration used by the retrieval evaluator. */
  readonly thresholds: SimilarityThresholds;
  embed(texts: string[], signal?: AbortSignal): Promise<number[][]>;
}

export const EMBEDDING_PROVIDER = Symbol('EMBEDDING_PROVIDER');
