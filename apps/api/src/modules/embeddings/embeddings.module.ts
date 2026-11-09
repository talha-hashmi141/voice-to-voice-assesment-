import { Global, Module } from '@nestjs/common';
import type OpenAI from 'openai';
import { AppConfigService } from '../../common';
import { OPENAI_CLIENT } from '../openai';
import { MockEmbeddingProvider, OpenAiEmbeddingProvider } from './adapters';
import { EMBEDDING_PROVIDER, type EmbeddingProvider } from './embedding-provider.port';

@Global()
@Module({
  providers: [
    {
      provide: EMBEDDING_PROVIDER,
      inject: [AppConfigService, OPENAI_CLIENT],
      useFactory: (config: AppConfigService, client: OpenAI | null): EmbeddingProvider =>
        config.aiProvider === 'openai' && client
          ? new OpenAiEmbeddingProvider(client, config.openai.embeddingModel)
          : new MockEmbeddingProvider(),
    },
  ],
  exports: [EMBEDDING_PROVIDER],
})
export class EmbeddingsModule {}
