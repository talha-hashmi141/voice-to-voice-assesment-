/** Input for creating/updating a document (from disk or upload). */
export interface DocumentInput {
  slug: string;
  title: string;
  category: string;
  tags: string[];
  content: string;
  sourcePath?: string | null;
  metadata?: Record<string, unknown>;
}

/** A chunk joined with its document, as returned by retrieval queries. */
export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  documentSlug: string;
  documentTitle: string;
  sectionPath: string;
  ordinal: number;
  content: string;
  tokenCount: number;
}

export interface DenseHit extends RetrievedChunk {
  similarity: number;
}

export interface SparseHit extends RetrievedChunk {
  rank: number;
}
