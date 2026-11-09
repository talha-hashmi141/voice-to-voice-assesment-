import type OpenAI from 'openai';
import { toFile } from 'openai';
import {
  type SttProvider,
  type SynthesizedAudio,
  type SynthesizedChunk,
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
/** OpenAI's PCM output: 24 kHz, 16-bit, little-endian, mono. */
export const OPENAI_PCM_SAMPLE_RATE = 24_000;
const BYTES_PER_SAMPLE = 2;
/** First chunk after ~100 ms of audio (fast start), later chunks every ~200 ms. */
const FIRST_CHUNK_BYTES = (OPENAI_PCM_SAMPLE_RATE * BYTES_PER_SAMPLE) / 10;
const CHUNK_BYTES = (OPENAI_PCM_SAMPLE_RATE * BYTES_PER_SAMPLE) / 5;

export class OpenAiTtsProvider implements TtsProvider {
  readonly model: string;

  constructor(
    private readonly client: OpenAI,
    modelName: string,
    private readonly defaultVoice: string,
  ) {
    this.model = `openai:${modelName}`;
  }

  private get modelName(): string {
    return this.model.slice('openai:'.length);
  }

  private request(input: SynthesizeInput, format: 'mp3' | 'pcm') {
    return this.client.audio.speech.create(
      {
        model: this.modelName,
        voice: (input.voice ?? this.defaultVoice) as 'alloy',
        input: input.text,
        response_format: format,
        ...(input.instructions && INSTRUCTABLE_TTS.test(this.modelName)
          ? { instructions: input.instructions }
          : {}),
      },
      { signal: input.signal },
    );
  }

  async synthesize(input: SynthesizeInput): Promise<SynthesizedAudio> {
    const response = await this.request(input, 'mp3');
    return { data: Buffer.from(await response.arrayBuffer()), mimeType: 'audio/mpeg' };
  }

  /** Streams raw PCM as OpenAI generates it; chunks are cut on sample boundaries. */
  async *synthesizeStream(input: SynthesizeInput): AsyncIterable<SynthesizedChunk> {
    const response = await this.request(input, 'pcm');
    if (!response.body) {
      yield {
        data: Buffer.from(await response.arrayBuffer()),
        mimeType: 'audio/pcm',
        sampleRate: OPENAI_PCM_SAMPLE_RATE,
      };
      return;
    }
    let pending = Buffer.alloc(0);
    let emitted = 0;
    for await (const piece of response.body as AsyncIterable<Uint8Array>) {
      pending = pending.length ? Buffer.concat([pending, Buffer.from(piece)]) : Buffer.from(piece);
      const threshold = emitted === 0 ? FIRST_CHUNK_BYTES : CHUNK_BYTES;
      while (pending.length >= threshold) {
        const cut = pending.length - (pending.length % BYTES_PER_SAMPLE);
        const take = Math.min(cut, Math.max(threshold, cut - (cut % threshold)));
        yield {
          data: pending.subarray(0, take),
          mimeType: 'audio/pcm',
          sampleRate: OPENAI_PCM_SAMPLE_RATE,
        };
        pending = pending.subarray(take);
        emitted += 1;
      }
    }
    const rest = pending.subarray(0, pending.length - (pending.length % BYTES_PER_SAMPLE));
    if (rest.length)
      yield { data: rest, mimeType: 'audio/pcm', sampleRate: OPENAI_PCM_SAMPLE_RATE };
  }
}
