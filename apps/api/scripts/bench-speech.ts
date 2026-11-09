import { loadEnv } from './_env';
loadEnv();

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import OpenAI, { toFile } from 'openai';

/** Latency micro-benchmark for the speech stages (costs a few tenths of a cent). `pnpm bench:speech` */
const client = new OpenAI();
const text =
  'The core working hours for remote employees are from ten in the morning to four in the afternoon local time.';

async function time(label: string, fn: () => Promise<string>): Promise<void> {
  const started = performance.now();
  try {
    const detail = await fn();
    console.log(label.padEnd(46), `${Math.round(performance.now() - started)} ms`.padStart(8), detail);
  } catch (error) {
    console.log(label.padEnd(46), 'ERROR', error instanceof Error ? error.message.slice(0, 100) : String(error));
  }
}

async function main(): Promise<void> {
  const ttsVariants: [string, 'mp3' | 'wav' | 'pcm' | 'opus', boolean][] = [
    ['gpt-4o-mini-tts', 'mp3', true],
    ['gpt-4o-mini-tts', 'mp3', false],
    ['gpt-4o-mini-tts', 'wav', false],
    ['gpt-4o-mini-tts', 'pcm', false],
    ['gpt-4o-mini-tts', 'opus', false],
    ['tts-1', 'mp3', false],
  ];
  for (let round = 1; round <= 2; round += 1) {
    for (const [model, format, instructions] of ttsVariants) {
      await time(`tts r${round} ${model} ${format} instructions=${instructions}`, async () => {
        const response = await client.audio.speech.create({
          model,
          voice: 'coral',
          input: text,
          response_format: format,
          ...(instructions ? { instructions: 'Speak like a friendly colleague.' } : {}),
        });
        const bytes = Buffer.from(await response.arrayBuffer());
        return `${Math.round(bytes.length / 1024)} KB`;
      });
    }
  }

  const wav48 = readFileSync(resolve(__dirname, '..', '..', 'web', 'e2e', 'fixtures', 'utterance.wav'));
  for (let round = 1; round <= 2; round += 1) {
    for (const model of ['gpt-4o-mini-transcribe', 'whisper-1', 'gpt-4o-transcribe']) {
      await time(`stt r${round} ${model} (${Math.round(wav48.length / 1024)} KB wav)`, async () => {
        const result = await client.audio.transcriptions.create({
          model,
          file: await toFile(wav48, 'utterance.wav', { type: 'audio/wav' }),
          response_format: 'json',
        });
        return JSON.stringify(result.text).slice(0, 70);
      });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
