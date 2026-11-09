import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioQueue, pcmToAudioBuffer } from './audio-queue';

/** Minimal AudioContext double: decodes "clips" whose duration is encoded in the first byte. */
class FakeSource {
  buffer: { duration: number } | null = null;
  onended: (() => void) | null = null;
  started: number[] = [];
  connect() {}
  start(at: number) {
    this.started.push(at);
    setTimeout(() => this.onended?.(), 1);
  }
  stop() {}
}
class FakeAudioContext {
  currentTime = 0;
  state = 'running';
  destination = {};
  sources: FakeSource[] = [];
  decoded: number[] = [];
  async resume() {}
  async decodeAudioData(data: ArrayBuffer) {
    const duration = new Uint8Array(data)[0] ?? 1;
    await new Promise((r) => setTimeout(r, duration)); // longer clips decode slower
    this.decoded.push(duration);
    return { duration: duration / 10 };
  }
  createBufferSource() {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }
  createBuffer(_channels: number, length: number, sampleRate: number) {
    const channel = new Float32Array(length);
    return { duration: length / sampleRate, getChannelData: () => channel, length, sampleRate };
  }
}

describe('AudioQueue', () => {
  let context: FakeAudioContext;
  beforeEach(() => {
    context = new FakeAudioContext();
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          return context;
        }
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  const clip = (duration: number) => new Uint8Array([duration]).buffer;

  it('plays clips in sequence order even when later clips decode first, scheduled back to back', async () => {
    const started = vi.fn();
    const ended = vi.fn();
    const queue = new AudioQueue({ onPlaybackStart: started, onPlaybackEnd: ended });
    queue.beginTurn();
    queue.enqueue(clip(30), { mimeType: 'audio/wav' }); // slow decode
    queue.enqueue(clip(5), { mimeType: 'audio/wav' }); // fast decode
    queue.enqueue(clip(5), { mimeType: 'audio/wav' });
    await new Promise((r) => setTimeout(r, 80));

    expect(context.sources.map((s) => s.buffer?.duration)).toEqual([3, 0.5, 0.5]);
    const [a, b, c] = context.sources.map((s) => s.started[0]!);
    expect(b).toBeCloseTo(a! + 3, 5);
    expect(c).toBeCloseTo(b! + 0.5, 5);
    expect(started).toHaveBeenCalledTimes(1);
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('stop() drops queued clips and reports playback end', async () => {
    const ended = vi.fn();
    const queue = new AudioQueue({ onPlaybackEnd: ended });
    queue.beginTurn();
    queue.enqueue(clip(2), { mimeType: 'audio/wav' });
    await new Promise((r) => setTimeout(r, 5));
    queue.enqueue(clip(40), { mimeType: 'audio/wav' });
    queue.stop();
    await new Promise((r) => setTimeout(r, 60));
    expect(context.sources).toHaveLength(1);
    expect(queue.isPlaying).toBe(false);
  });

  it('plays raw PCM chunks without decoding, scheduled back to back', async () => {
    const queue = new AudioQueue();
    queue.beginTurn();
    const pcm = new Int16Array([0, 16384, -16384, 32767]).buffer;
    queue.enqueue(pcm, { mimeType: 'audio/pcm', sampleRate: 24_000 });
    queue.enqueue(pcm, { mimeType: 'audio/pcm', sampleRate: 24_000 });
    await new Promise((r) => setTimeout(r, 5));
    expect(context.decoded).toEqual([]);
    expect(context.sources).toHaveLength(2);
    const [a, b] = context.sources.map((s) => s.started[0]!);
    expect(b).toBeCloseTo(a! + 4 / 24_000, 6);
    const buffer = pcmToAudioBuffer(context as unknown as AudioContext, pcm, 24_000);
    expect(Array.from(buffer.getChannelData(0))).toEqual([0, 0.5, -0.5, 32767 / 32768]);
  });
});
