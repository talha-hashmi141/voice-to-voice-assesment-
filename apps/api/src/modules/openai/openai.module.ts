import { Global, Module } from '@nestjs/common';
import OpenAI from 'openai';
import { AppConfigService } from '../../common';

export const OPENAI_CLIENT = Symbol('OPENAI_CLIENT');

/** One configured OpenAI client shared by the LLM, speech and embedding adapters. Null in mock mode. */
@Global()
@Module({
  providers: [
    {
      provide: OPENAI_CLIENT,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): OpenAI | null =>
        config.aiProvider === 'openai'
          ? new OpenAI({ apiKey: config.openai.apiKey, maxRetries: 2, timeout: 60_000 })
          : null,
    },
  ],
  exports: [OPENAI_CLIENT],
})
export class OpenAiModule {}
