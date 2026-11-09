import { stripForSpeech } from '../agent';
import { type SynthesizedAudio, type TtsProvider } from '../speech';
import { type AsyncQueue } from './async-queue';
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
 * (bounded concurrency), while clips are emitted strictly in sentence order so the client
 * can play them back to back. Sentence N+1 is synthesised while sentence N is playing.
 */
export class SpeechScheduler {
  private seq = 0;
  private active = 0;
  private readonly waiting: (() => void)[] = [];
  private chain: Promise<void> = Promise.resolve();
  private cancelled = false;
  /** Latency of the first synthesis call (ms), reported as `ttsMs`. */
  firstSynthesisMs: number | null = null;

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
    const job = this.withSlot(() => this.synthesize(spoken));
    this.chain = this.chain.then(async () => {
      try {
        const audio = await job;
        if (this.cancelled) return;
        if (seq === 0) this.options.onFirstAudio?.();
        this.queue.push({ type: 'audio', seq, mimeType: audio.mimeType, data: audio.data, text: spoken });
      } catch (error) {
        if (this.cancelled || this.options.signal.aborted) return;
        this.queue.push({ type: 'error', code: 'TTS_FAILED', message: error instanceof Error ? error.message : String(error), fatal: false });
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

  private async synthesize(text: string): Promise<SynthesizedAudio> {
    const started = performance.now();
    const audio = await this.tts.synthesize({
      text,
      voice: this.options.voice,
      instructions: this.options.instructions,
      signal: this.options.signal,
    });
    if (this.firstSynthesisMs === null) this.firstSynthesisMs = Math.round(performance.now() - started);
    return audio;
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
