import { encodeWav, MOCK_UTTERANCES, MockSttProvider, MockTtsProvider } from './mock-speech.providers';

describe('MockSttProvider', () => {
  it('replays demo utterances in order and ignores near-empty clips', async () => {
    const stt = new MockSttProvider();
    const clip = Buffer.alloc(5_000);
    expect((await stt.transcribe({ audio: clip, mimeType: 'audio/wav' })).text).toBe(MOCK_UTTERANCES[0]);
    expect((await stt.transcribe({ audio: clip, mimeType: 'audio/wav' })).text).toBe(MOCK_UTTERANCES[1]);
    expect((await stt.transcribe({ audio: Buffer.alloc(10), mimeType: 'audio/wav' })).text).toBe('');
  });
});

describe('MockTtsProvider', () => {
  it('produces a valid WAV whose length scales with the text', async () => {
    const tts = new MockTtsProvider();
    const short = await tts.synthesize({ text: 'Hi.' });
    const long = await tts.synthesize({ text: 'This sentence has quite a few more words in it than the other one.' });
    expect(short.mimeType).toBe('audio/wav');
    expect(short.data.subarray(0, 4).toString()).toBe('RIFF');
    expect(short.data.subarray(8, 12).toString()).toBe('WAVE');
    expect(long.data.byteLength).toBeGreaterThan(short.data.byteLength);
  });

  it('encodes WAV headers correctly', () => {
    const wav = encodeWav(new Int16Array([0, 1000, -1000]), 8000);
    expect(wav.readUInt32LE(24)).toBe(8000);
    expect(wav.readUInt32LE(40)).toBe(6);
    expect(wav.byteLength).toBe(44 + 6);
  });
});
