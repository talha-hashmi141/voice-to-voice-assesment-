import type OpenAI from 'openai';
import { EMBEDDING_DIMENSIONS } from '../../../common';
import { type EmbeddingProvider, type SimilarityThresholds } from '../embedding-provider.port';

const BATCH_SIZE = 96;

export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions = EMBEDDING_DIMENSIONS;
  readonly model: string;
  readonly thresholds: SimilarityThresholds = { strong: 0.5, weak: 0.4 };

  constructor(
    private readonly client: OpenAI,
    modelName: string,
  ) {
    this.model = `openai:${modelName}`;
  }

  private get modelName(): string {
    return this.model.slice('openai:'.length);
  }

  async embed(texts: string[], signal?: AbortSignal): Promise<number[][]> {
    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE).map((text) => text.replace(/\s+/g, ' ').trim());
      const response = await this.client.embeddings.create(
        { model: this.modelName, input: batch, dimensions: this.dimensions },
        { signal },
      );
      const ordered = [...response.data].sort((a, b) => a.index - b.index);
      vectors.push(...ordered.map((item) => item.embedding));
    }
    return vectors;
  }
}
