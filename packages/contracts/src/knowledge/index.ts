import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from '../common';

export const RetrievalModeSchema = z.enum(['hybrid', 'dense', 'sparse']);
export type RetrievalMode = z.infer<typeof RetrievalModeSchema>;

export const SearchRequestSchema = z.object({
  query: z.string().trim().min(1).max(500),
  topK: z.number().int().min(1).max(20).default(5),
  mode: RetrievalModeSchema.default('hybrid'),
});
export type SearchRequest = z.infer<typeof SearchRequestSchema>;

export const SearchScoresSchema = z.object({
  /** Reciprocal-rank-fused score in [0, 1] (1 = top of every channel). */
  fused: z.number(),
  /** Cosine similarity from the embedding channel, null if not retrieved there. */
  dense: z.number().nullable(),
  /** Normalised full-text rank from the sparse channel, null if not retrieved there. */
  sparse: z.number().nullable(),
});
export type SearchScores = z.infer<typeof SearchScoresSchema>;

export const SearchHitSchema = z.object({
  chunkId: IdSchema,
  documentId: IdSchema,
  documentSlug: z.string(),
  documentTitle: z.string(),
  sectionPath: z.string(),
  content: z.string(),
  rank: z.number().int().min(1),
  scores: SearchScoresSchema,
});
export type SearchHit = z.infer<typeof SearchHitSchema>;

export const SearchResponseSchema = z.object({
  query: z.string(),
  mode: RetrievalModeSchema,
  hits: z.array(SearchHitSchema),
  tookMs: z.number(),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;

export const DocumentSummarySchema = z.object({
  id: IdSchema,
  slug: z.string(),
  title: z.string(),
  category: z.string(),
  tags: z.array(z.string()),
  chunkCount: z.number().int(),
  tokenCount: z.number().int(),
  updatedAt: IsoDateTimeSchema,
});
export type DocumentSummary = z.infer<typeof DocumentSummarySchema>;

export const DocumentSectionSchema = z.object({
  path: z.string(),
  chunkCount: z.number().int(),
});
export type DocumentSection = z.infer<typeof DocumentSectionSchema>;

export const DocumentDetailSchema = DocumentSummarySchema.extend({
  content: z.string(),
  sections: z.array(DocumentSectionSchema),
});
export type DocumentDetail = z.infer<typeof DocumentDetailSchema>;

export const IngestionJobStatusSchema = z.enum(['queued', 'active', 'completed', 'failed']);
export type IngestionJobStatus = z.infer<typeof IngestionJobStatusSchema>;

export const IngestionJobSchema = z.object({
  id: z.string(),
  documentSlug: z.string(),
  status: IngestionJobStatusSchema,
  progress: z.number().min(0).max(100),
  error: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
  finishedAt: IsoDateTimeSchema.nullable(),
});
export type IngestionJob = z.infer<typeof IngestionJobSchema>;

export const ReindexResponseSchema = z.object({
  jobs: z.array(IngestionJobSchema),
});
export type ReindexResponse = z.infer<typeof ReindexResponseSchema>;

export const UploadDocumentRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100).default('uploaded'),
  tags: z.array(z.string().trim().min(1)).max(10).default([]),
  content: z.string().min(1).max(200_000),
});
export type UploadDocumentRequest = z.infer<typeof UploadDocumentRequestSchema>;

export const DocumentListResponseSchema = z.object({
  documents: z.array(DocumentSummarySchema),
});
export type DocumentListResponse = z.infer<typeof DocumentListResponseSchema>;

export const IngestionJobListResponseSchema = z.object({
  jobs: z.array(IngestionJobSchema),
});
export type IngestionJobListResponse = z.infer<typeof IngestionJobListResponseSchema>;

export const UploadDocumentResponseSchema = z.object({
  document: DocumentSummarySchema,
  job: IngestionJobSchema,
});
export type UploadDocumentResponse = z.infer<typeof UploadDocumentResponseSchema>;

export const ReindexQuerySchema = z.object({
  force: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});
export type ReindexQuery = z.infer<typeof ReindexQuerySchema>;
