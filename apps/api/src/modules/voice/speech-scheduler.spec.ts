import { type SynthesizedChunk, type TtsProvider } from '../speech';
import { AsyncQueue } from './async-queue';
import { SpeechScheduler } from './speech-scheduler';
import { type VoiceEvent } from './voice-events';

const streamingTts = (delays: Record<string, number>): TtsProvider => ({
  model: 'openai:fake',
  synthesize: async ({ text }) => ({ data: Buffer.from(text), mimeType: 'audio/wav' }),
  async *synthesizeStream({ text }): AsyncIterable<SynthesizedChunk> {
    const words = text.split(' ');
    for (const word of words) {
      await new Promise((r) => setTimeout(r, delays[text] ?? 1));
      yield { data: Buffer.from(word), mimeType: 'audio/pcm', sampleRate: 24_000 };
    }
  },
});

async function run(tts: TtsProvider, sentences: string[]): Promise<VoiceEvent[]> {
  const queue = new AsyncQueue<VoiceEvent>();
  const scheduler = new SpeechScheduler(tts, queue, {
    concurrency: 2,
    signal: new AbortController().signal,
  });
  for (const sentence of sentences) scheduler.speak(sentence);
  await scheduler.drain();
  queue.close();
  const events: VoiceEvent[] = [];
  for await (const event of queue) events.push(event);
  return events;
}

describe('SpeechScheduler', () => {
  it('streams chunks per sentence in strict sentence order even when later sentences finish first', async () => {
    const events = await run(streamingTts({ 'Slow first sentence.': 8, 'Fast second one.': 1 }), [
      'Slow first sentence.',
      'Fast second one.',
    ]);
    const audio = events.filter(
      (e): e is Extract<VoiceEvent, { type: 'audio' }> => e.type === 'audio',
    );
    expect(audio.map((a) => `${a.seq}.${a.part}${a.final ? '*' : ''}`)).toEqual([
      '0.0',
      '0.1',
      '0.2*',
      '1.0',
      '1.1',
      '1.2*',
    ]);
    expect(audio.map((a) => a.data.toString())).toEqual([
      'Slow',
      'first',
      'sentence.',
      'Fast',
      'second',
      'one.',
    ]);
    expect(audio[0]?.sampleRate).toBe(24_000);
  });

  it('falls back to single-clip synthesis when the provider cannot stream', async () => {
    const tts: TtsProvider = {
      model: 'mock',
      synthesize: async ({ text }) => ({ data: Buffer.from(text), mimeType: 'audio/wav' }),
    };
    const events = await run(tts, ['Hello there friend.', 'Second sentence here.']);
    const audio = events.filter(
      (e): e is Extract<VoiceEvent, { type: 'audio' }> => e.type === 'audio',
    );
    expect(audio.map((a) => [a.seq, a.part, a.final, a.mimeType])).toEqual([
      [0, 0, true, 'audio/wav'],
      [1, 0, true, 'audio/wav'],
    ]);
  });

  it('reports a non-fatal error when one sentence fails and keeps the rest', async () => {
    const tts: TtsProvider = {
      model: 'mock',
      synthesize: async ({ text }) => {
        if (text.startsWith('Broken')) throw new Error('synthesis failed');
        return { data: Buffer.from(text), mimeType: 'audio/wav' };
      },
    };
    const events = await run(tts, ['Broken sentence here.', 'Working sentence here.']);
    expect(events.map((e) => e.type)).toEqual(['error', 'audio']);
    expect(events[0]).toMatchObject({ code: 'TTS_FAILED', fatal: false });
  });
});
