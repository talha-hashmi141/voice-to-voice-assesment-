export interface TranscribeInput {
  audio: Buffer;
  mimeType: string;
  language?: string;
  /** Domain vocabulary hint (product names, acronyms) to bias recognition. */
  prompt?: string;
  signal?: AbortSignal;
}

export interface Transcript {
  text: string;
  language?: string;
}

export interface SttProvider {
  readonly model: string;
  transcribe(input: TranscribeInput): Promise<Transcript>;
}

export interface SynthesizeInput {
  text: string;
  voice?: string;
  /** Style guidance for instructable TTS models (tone, pace). */
  instructions?: string;
  signal?: AbortSignal;
}

export interface SynthesizedAudio {
  data: Buffer;
  mimeType: string;
}

export interface SynthesizedChunk {
  data: Buffer;
  /** "audio/pcm" with `sampleRate`, or a container type for single-chunk providers. */
  mimeType: string;
  sampleRate?: number;
}

export interface TtsProvider {
  readonly model: string;
  synthesize(input: SynthesizeInput): Promise<SynthesizedAudio>;
  /**
   * Streams speech as it is generated so playback can start before synthesis finishes.
   * Providers without streaming omit it and the pipeline falls back to `synthesize`.
   */
  synthesizeStream?(input: SynthesizeInput): AsyncIterable<SynthesizedChunk>;
}

export const STT_PROVIDER = Symbol('STT_PROVIDER');
export const TTS_PROVIDER = Symbol('TTS_PROVIDER');

/** Vocabulary the recogniser would otherwise mishear; passed as the transcription prompt. */
export const DOMAIN_VOCABULARY_PROMPT =
  'Orbital Labs, OrbitHR, OrbitExpense, PTO, Launch Pad, Bupa, 401k, helpdesk ticket, P1, P2, P3, P4.';
