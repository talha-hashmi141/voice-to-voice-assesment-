import {
  type SttProvider,
  type SynthesizedAudio,
  type SynthesizeInput,
  type TranscribeInput,
  type Transcript,
  type TtsProvider,
} from '../speech-provider.ports';

/** Utterances replayed by the mock recogniser, covering the six assessment scenarios. */
export const MOCK_UTTERANCES = [
  'What are the core working hours for remote employees?',
  'How many vacation days do new employees get, and can I carry unused days over?',
  'How long do I have to claim back money I spent on a business trip?',
  'I want to take the last week of December off. Do I have enough PTO left?',
  'And what about sick days?',
  'What is the policy on bringing dogs to the office?',
];

/**
 * The mock recogniser cannot understand audio; it replays demo utterances in order so the
 * whole voice pipeline can be exercised without an API key. Near-empty clips transcribe to "".
 */
export class MockSttProvider implements SttProvider {
  readonly model = 'mock:replay-v1';
  private cursor = 0;

  async transcribe(input: TranscribeInput): Promise<Transcript> {
    if (input.audio.byteLength < 1_000) return { text: '' };
    const text = MOCK_UTTERANCES[this.cursor % MOCK_UTTERANCES.length]!;
    this.cursor += 1;
    return { text };
  }
}

const SAMPLE_RATE = 16_000;

/** Encodes mono 16-bit PCM into a WAV container. */
export function encodeWav(samples: Int16Array, sampleRate = SAMPLE_RATE): Buffer {
  const header = Buffer.alloc(44);
  const dataLength = samples.length * 2;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);
  return Buffer.concat([header, Buffer.from(samples.buffer, samples.byteOffset, dataLength)]);
}

/**
 * Produces a soft two-tone chime whose length scales with the text, so playback, ordering
 * and barge-in can be tested audibly without a real voice.
 */
export class MockTtsProvider implements TtsProvider {
  readonly model = 'mock:chime-v1';

  async synthesize(input: SynthesizeInput): Promise<SynthesizedAudio> {
    const words = input.text.trim().split(/\s+/u).filter(Boolean).length;
    const seconds = Math.min(3, Math.max(0.25, words * 0.11));
    const total = Math.round(seconds * SAMPLE_RATE);
    const samples = new Int16Array(total);
    for (let i = 0; i < total; i += 1) {
      const t = i / SAMPLE_RATE;
      const envelope = Math.min(1, t / 0.02, (seconds - t) / 0.05);
      const tone = 0.5 * Math.sin(2 * Math.PI * 440 * t) + 0.3 * Math.sin(2 * Math.PI * 660 * t);
      samples[i] = Math.round(tone * envelope * 0.25 * 32767);
    }
    return { data: encodeWav(samples), mimeType: 'audio/wav' };
  }
}
