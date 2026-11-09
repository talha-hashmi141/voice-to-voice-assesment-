import { Global, Module } from '@nestjs/common';
import type OpenAI from 'openai';
import { AppConfigService } from '../../common';
import { OPENAI_CLIENT } from '../openai';
import { MockLlmProvider, OpenAiLlmProvider } from './adapters';
import { LLM_PROVIDER, type LlmProvider } from './llm-provider.port';

@Global()
@Module({
  providers: [
    {
      provide: LLM_PROVIDER,
      inject: [AppConfigService, OPENAI_CLIENT],
      useFactory: (config: AppConfigService, client: OpenAI | null): LlmProvider =>
        config.aiProvider === 'openai' && client
          ? new OpenAiLlmProvider(client, config.openai.chatModel)
          : new MockLlmProvider(),
    },
  ],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
