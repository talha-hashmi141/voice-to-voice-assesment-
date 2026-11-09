export interface AudioQueueCallbacks {
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
  onError?: (error: unknown) => void;
}

interface Clip {
  seq: number;
  decoded: Promise<AudioBuffer>;
}

/**
 * Plays audio clips strictly in sequence order with gapless scheduling on the Web Audio clock.
 * Clips can arrive (and decode) out of order; playback waits for the next expected `seq`.
 * `stop()` cuts playback immediately – used for barge-in and reset.
 */
export class AudioQueue {
  private context: AudioContext | null = null;
  private readonly clips = new Map<number, Clip>();
  private expectedSeq = 0;
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

  enqueue(seq: number, data: ArrayBuffer, _mimeType: string): void {
    const context = this.ensureContext();
    const generation = this.generation;
    const decoded = context.decodeAudioData(data.slice(0));
    this.clips.set(seq, { seq, decoded });
    decoded.catch((error) => {
      if (generation === this.generation) this.callbacks.onError?.(error);
    });
    void this.drain();
  }

  /** Resets sequencing for a new turn (call before the first clip of a turn). */
  beginTurn(): void {
    this.stop();
    this.expectedSeq = 0;
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
    this.expectedSeq = 0;
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
      while (this.clips.has(this.expectedSeq)) {
        const generation = this.generation;
        const clip = this.clips.get(this.expectedSeq)!;
        let buffer: AudioBuffer;
        try {
          buffer = await clip.decoded;
        } catch {
          this.clips.delete(clip.seq);
          this.expectedSeq += 1;
          continue;
        }
        if (generation !== this.generation) return;
        this.clips.delete(clip.seq);
        this.expectedSeq += 1;
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
    const startAt = Math.max(context.currentTime + 0.02, this.nextStartTime);
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
