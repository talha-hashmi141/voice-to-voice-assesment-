import { stripForSpeech } from '../agent';
import { type SynthesizedChunk, type TtsProvider } from '../speech';
import { AsyncQueue } from './async-queue';
import { type VoiceEvent } from './voice-events';

export interface SpeechSchedulerOptions {
  voice?: string;
  instructions?: string;
  concurrency: number;
  signal: AbortSignal;
  onFirstAudio?: () => void;
}

/**
 * Pipelines text-to-speech: every sentence starts synthesising as soon as it is complete
 * (bounded concurrency) and, when the provider streams, its audio chunks are forwarded while
 * they are still being generated. Chunks are emitted strictly in sentence order: sentence N+1
 * is synthesised (and buffered) while sentence N is still being delivered.
 */
export class SpeechScheduler {
  private seq = 0;
  private active = 0;
  private readonly waiting: (() => void)[] = [];
  private chain: Promise<void> = Promise.resolve();
  private cancelled = false;
  /** Time from the first synthesis request to its first audio chunk (ms), reported as `ttsMs`. */
  firstSynthesisMs: number | null = null;
  /** Words sent to TTS, used for the cost estimate. */
  spokenWords = 0;

  constructor(
    private readonly tts: TtsProvider,
    private readonly queue: AsyncQueue<VoiceEvent>,
    private readonly options: SpeechSchedulerOptions,
  ) {}

  speak(sentence: string): void {
    const spoken = stripForSpeech(sentence);
    if (!spoken || this.cancelled) return;
    const seq = this.seq;
    this.seq += 1;
    this.spokenWords += spoken.split(/\s+/u).filter(Boolean).length;

    // Producer: synthesise now (subject to the concurrency limit) into a per-sentence buffer.
    const chunks = new AsyncQueue<SynthesizedChunk>();
    void this.withSlot(async () => {
      const started = performance.now();
      try {
        for await (const chunk of this.synthesize(spoken)) {
          if (this.firstSynthesisMs === null)
            this.firstSynthesisMs = Math.round(performance.now() - started);
          chunks.push(chunk);
        }
        chunks.close();
      } catch (error) {
        chunks.fail(error);
      }
    });

    // Consumer: deliver this sentence's chunks only after every earlier sentence finished.
    this.chain = this.chain.then(async () => {
      let part = 0;
      let previous: SynthesizedChunk | null = null;
      const emit = (chunk: SynthesizedChunk, final: boolean) => {
        if (this.cancelled) return;
        if (seq === 0 && part === 0) this.options.onFirstAudio?.();
        this.queue.push({
          type: 'audio',
          seq,
          part,
          final,
          mimeType: chunk.mimeType,
          sampleRate: chunk.sampleRate,
          data: chunk.data,
          text: spoken,
        });
        part += 1;
      };
      try {
        for await (const chunk of chunks) {
          if (previous) emit(previous, false);
          previous = chunk;
        }
        if (previous) emit(previous, true);
      } catch (error) {
        if (this.cancelled || this.options.signal.aborted) return;
        this.queue.push({
          type: 'error',
          code: 'TTS_FAILED',
          message: error instanceof Error ? error.message : String(error),
          fatal: false,
        });
      }
    });
  }

  /** Resolves once every scheduled clip has been emitted (or dropped after cancel). */
  drain(): Promise<void> {
    return this.chain;
  }

  cancel(): void {
    this.cancelled = true;
  }

  get scheduled(): number {
    return this.seq;
  }

  private synthesize(text: string): AsyncIterable<SynthesizedChunk> {
    const input = {
      text,
      voice: this.options.voice,
      instructions: this.options.instructions,
      signal: this.options.signal,
    };
    if (this.tts.synthesizeStream) return this.tts.synthesizeStream(input);
    const single = this.tts.synthesize(input);
    return (async function* () {
      const audio = await single;
      yield { data: audio.data, mimeType: audio.mimeType };
    })();
  }

  private async withSlot<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.options.concurrency) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.active += 1;
    try {
      return await task();
    } finally {
      this.active -= 1;
      this.waiting.shift()?.();
    }
  }
}
