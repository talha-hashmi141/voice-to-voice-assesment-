import type OpenAI from 'openai';
import { toFile } from 'openai';
import {
  type SttProvider,
  type SynthesizedAudio,
  type SynthesizeInput,
  type TranscribeInput,
  type Transcript,
  type TtsProvider,
} from '../speech-provider.ports';

const EXTENSIONS: Record<string, string> = {
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'mp4',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/flac': 'flac',
};

export const extensionFor = (mimeType: string): string =>
  EXTENSIONS[mimeType.split(';')[0]!.trim().toLowerCase()] ?? 'wav';

export class OpenAiSttProvider implements SttProvider {
  readonly model: string;

  constructor(
    private readonly client: OpenAI,
    modelName: string,
  ) {
    this.model = `openai:${modelName}`;
  }

  async transcribe(input: TranscribeInput): Promise<Transcript> {
    const file = await toFile(input.audio, `utterance.${extensionFor(input.mimeType)}`, {
      type: input.mimeType,
    });
    const response = await this.client.audio.transcriptions.create(
      {
        file,
        model: this.model.slice('openai:'.length),
        language: input.language,
        prompt: input.prompt,
        response_format: 'json',
      },
      { signal: input.signal },
    );
    return { text: response.text.trim() };
  }
}

const INSTRUCTABLE_TTS = /^gpt-/u;

export class OpenAiTtsProvider implements TtsProvider {
  readonly model: string;

  constructor(
    private readonly client: OpenAI,
    modelName: string,
    private readonly defaultVoice: string,
  ) {
    this.model = `openai:${modelName}`;
  }

  async synthesize(input: SynthesizeInput): Promise<SynthesizedAudio> {
    const modelName = this.model.slice('openai:'.length);
    const response = await this.client.audio.speech.create(
      {
        model: modelName,
        voice: (input.voice ?? this.defaultVoice) as 'alloy',
        input: input.text,
        response_format: 'mp3',
        ...(input.instructions && INSTRUCTABLE_TTS.test(modelName)
          ? { instructions: input.instructions }
          : {}),
      },
      { signal: input.signal },
    );
    return { data: Buffer.from(await response.arrayBuffer()), mimeType: 'audio/mpeg' };
  }
}
