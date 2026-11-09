import { Global, Module } from '@nestjs/common';
import type OpenAI from 'openai';
import { AppConfigService } from '../../common';
import { OPENAI_CLIENT } from '../openai';
import { MockSttProvider, MockTtsProvider, OpenAiSttProvider, OpenAiTtsProvider } from './adapters';
import {
  STT_PROVIDER,
  type SttProvider,
  TTS_PROVIDER,
  type TtsProvider,
} from './speech-provider.ports';

@Global()
@Module({
  providers: [
    {
      provide: STT_PROVIDER,
      inject: [AppConfigService, OPENAI_CLIENT],
      useFactory: (config: AppConfigService, client: OpenAI | null): SttProvider =>
        config.aiProvider === 'openai' && client
          ? new OpenAiSttProvider(client, config.openai.sttModel)
          : new MockSttProvider(),
    },
    {
      provide: TTS_PROVIDER,
      inject: [AppConfigService, OPENAI_CLIENT],
      useFactory: (config: AppConfigService, client: OpenAI | null): TtsProvider =>
        config.aiProvider === 'openai' && client
          ? new OpenAiTtsProvider(client, config.openai.ttsModel, config.openai.ttsVoice)
          : new MockTtsProvider(),
    },
  ],
  exports: [STT_PROVIDER, TTS_PROVIDER],
})
export class SpeechModule {}
