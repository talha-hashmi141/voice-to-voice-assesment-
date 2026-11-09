import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EMBEDDING_PROVIDER, type EmbeddingProvider } from '../../embeddings';
import { DocumentChunker } from '../chunking';
import { type DocumentInput } from '../entities';
import { ChunkRepository, DocumentRepository } from '../repositories';
import { checksumOf, DocumentLoader } from './document-loader';

export interface IndexResult {
  documentId: string;
  slug: string;
  title: string;
  chunks: number;
  skipped: boolean;
}

export type ProgressReporter = (percent: number, stage: string) => Promise<void> | void;

/**
 * Ingestion pipeline: load → chunk → embed → store. `saveDocument` persists the raw document;
 * `indexDocument` (re)builds its chunks and embeddings when the content or embedding model changed.
 */
@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly documents: DocumentRepository,
    private readonly chunks: ChunkRepository,
    private readonly chunker: DocumentChunker,
    private readonly loader: DocumentLoader,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddings: EmbeddingProvider,
  ) {}

  async saveDocument(
    input: DocumentInput,
  ): Promise<{ id: string; slug: string; changed: boolean }> {
    const { row, changed } = await this.documents.upsert(input, checksumOf(input));
    return { id: row.id, slug: row.slug, changed };
  }

  async indexDocument(
    slug: string,
    options: { force?: boolean; onProgress?: ProgressReporter } = {},
  ): Promise<IndexResult> {
    const document = await this.documents.findBySlug(slug);
    if (!document) throw new NotFoundException(`Document "${slug}" not found`);

    const upToDate = document.embeddingModel === this.embeddings.model;
    if (upToDate && !options.force) {
      const existing = await this.chunks.findByDocument(document.id);
      if (existing.length) {
        return {
          documentId: document.id,
          slug,
          title: document.title,
          chunks: existing.length,
          skipped: true,
        };
      }
    }

    await options.onProgress?.(10, 'chunking');
    const pieces = this.chunker.chunk(document.title, document.content);

    await options.onProgress?.(30, 'embedding');
    const vectors = await this.embeddings.embed(pieces.map((piece) => piece.embeddedText));

    await options.onProgress?.(85, 'storing');
    await this.chunks.replaceForDocument(
      document.id,
      pieces.map((piece, i) => ({
        ordinal: piece.ordinal,
        sectionPath: piece.sectionPath,
        content: piece.content,
        embeddedText: piece.embeddedText,
        tokenCount: piece.tokenCount,
        embedding: vectors[i] ?? null,
        metadata: {},
      })),
    );
    await this.documents.markIndexed(document.id, this.embeddings.model);
    await options.onProgress?.(100, 'done');

    this.logger.log(
      `Indexed "${document.title}" → ${pieces.length} chunks (${this.embeddings.model})`,
    );
    return {
      documentId: document.id,
      slug,
      title: document.title,
      chunks: pieces.length,
      skipped: false,
    };
  }

  /** Inline (synchronous) ingestion of a directory – used by the seed script and tests. */
  async ingestDirectory(
    directory: string,
    options: { force?: boolean } = {},
  ): Promise<IndexResult[]> {
    const inputs = await this.loader.loadDirectory(directory);
    const results: IndexResult[] = [];
    for (const input of inputs) {
      const saved = await this.saveDocument(input);
      results.push(await this.indexDocument(saved.slug, { force: options.force || saved.changed }));
    }
    return results;
  }

  async loadDirectory(directory: string): Promise<DocumentInput[]> {
    return this.loader.loadDirectory(directory);
  }

  async removeDocument(slug: string): Promise<void> {
    const removed = await this.documents.deleteBySlug(slug);
    if (!removed) throw new NotFoundException(`Document "${slug}" not found`);
  }
}
