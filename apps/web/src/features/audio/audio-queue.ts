export interface AudioQueueCallbacks {
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
  onError?: (error: unknown) => void;
}

export interface AudioClipMeta {
  mimeType: string;
  sampleRate?: number;
}

interface Clip {
  index: number;
  decoded: Promise<AudioBuffer>;
}

/** Initial lead before the first chunk plays, absorbing network jitter for streamed speech. */
const START_LEAD_SECONDS = 0.08;

/**
 * Gapless, ordered playback on the Web Audio clock. Clips arrive in server order (sentence by
 * sentence, chunk by chunk) and are scheduled back to back; raw PCM chunks from streamed speech
 * need no decoding and start playing as soon as they arrive, container formats (WAV/MP3) are
 * decoded first. `stop()` cuts playback immediately – used for barge-in and reset.
 */
export class AudioQueue {
  private context: AudioContext | null = null;
  private readonly clips = new Map<number, Clip>();
  private nextIndex = 0;
  private expectedIndex = 0;
  private nextStartTime = 0;
  private playing = false;
  private draining = false;
  private generation = 0;
  private readonly activeSources = new Set<AudioBufferSourceNode>();

  constructor(private readonly callbacks: AudioQueueCallbacks = {}) {}

  /** Must be called from a user gesture at least once so the AudioContext may start. */
  async unlock(): Promise<void> {
    const context = this.ensureContext();
    if (context.state === 'suspended') await context.resume();
  }

  enqueue(data: ArrayBuffer, meta: AudioClipMeta): void {
    const context = this.ensureContext();
    const generation = this.generation;
    const index = this.nextIndex;
    this.nextIndex += 1;
    const decoded = isPcm(meta.mimeType)
      ? Promise.resolve(pcmToAudioBuffer(context, data, meta.sampleRate ?? 24_000))
      : context.decodeAudioData(data.slice(0));
    this.clips.set(index, { index, decoded });
    decoded.catch((error) => {
      if (generation === this.generation) this.callbacks.onError?.(error);
    });
    void this.drain();
  }

  /** Resets sequencing for a new turn (call before the first clip of a turn). */
  beginTurn(): void {
    this.stop();
  }

  stop(): void {
    this.generation += 1;
    this.clips.clear();
    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
    this.activeSources.clear();
    this.nextStartTime = 0;
    this.nextIndex = 0;
    this.expectedIndex = 0;
    if (this.playing) {
      this.playing = false;
      this.callbacks.onPlaybackEnd?.();
    }
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  private ensureContext(): AudioContext {
    if (!this.context) this.context = new AudioContext();
    return this.context;
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.clips.has(this.expectedIndex)) {
        const generation = this.generation;
        const clip = this.clips.get(this.expectedIndex)!;
        let buffer: AudioBuffer;
        try {
          buffer = await clip.decoded;
        } catch {
          this.clips.delete(clip.index);
          this.expectedIndex += 1;
          continue;
        }
        if (generation !== this.generation) return;
        this.clips.delete(clip.index);
        this.expectedIndex += 1;
        this.schedule(buffer);
      }
    } finally {
      this.draining = false;
    }
  }

  private schedule(buffer: AudioBuffer): void {
    const context = this.ensureContext();
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const startAt = Math.max(
      context.currentTime + (this.playing ? 0.005 : START_LEAD_SECONDS),
      this.nextStartTime,
    );
    source.start(startAt);
    this.nextStartTime = startAt + buffer.duration;
    this.activeSources.add(source);
    if (!this.playing) {
      this.playing = true;
      this.callbacks.onPlaybackStart?.();
    }
    source.onended = () => {
      this.activeSources.delete(source);
      if (this.activeSources.size === 0 && !this.clips.size && this.playing) {
        this.playing = false;
        this.callbacks.onPlaybackEnd?.();
      }
    };
  }
}

export const isPcm = (mimeType: string): boolean => /^audio\/(pcm|l16)\b/iu.test(mimeType);

/** 16-bit little-endian mono PCM → AudioBuffer (no decoding round-trip). */
export function pcmToAudioBuffer(
  context: AudioContext,
  data: ArrayBuffer,
  sampleRate: number,
): AudioBuffer {
  const usable = data.byteLength - (data.byteLength % 2);
  const samples = new Int16Array(data, 0, usable / 2);
  const buffer = context.createBuffer(1, Math.max(1, samples.length), sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i += 1) channel[i] = (samples[i] ?? 0) / 32768;
  return buffer;
}
