'use client';

import type { MicVAD } from '@ricky0123/vad-web';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLatest } from '@/lib/hooks';
import { encodeWav, rmsLevel } from './wav-encoder';

export type MicStatus = 'idle' | 'loading' | 'ready' | 'listening' | 'error';

export interface UseMicrophoneOptions {
  /** A complete utterance (16 kHz mono WAV) detected by the VAD. */
  onUtterance: (wav: ArrayBuffer, durationMs: number) => void;
  /** Fired once the VAD is confident real speech started – used for barge-in. */
  onSpeechStart?: () => void;
  onLevel?: (level: number) => void;
  onError?: (message: string) => void;
}

const SAMPLE_RATE = 16_000;

const subscribeNoop = () => () => {};
/** Hydration-safe: the server (and the first client render) assume support, then the real value applies. */
const useMicrophoneSupported = () =>
  useSyncExternalStore(
    subscribeNoop,
    () => !!navigator.mediaDevices?.getUserMedia,
    () => true,
  );

/**
 * Microphone capture with on-device voice-activity detection (Silero VAD via ONNX runtime).
 * The model files are served same-origin from /vad (copied at install time), so there is no CDN
 * dependency. Hands-free mode: start() keeps listening and submits each utterance; push-to-talk:
 * start() on press, stop() on release (which submits whatever was captured).
 */
export function useMicrophone(options: UseMicrophoneOptions) {
  const latest = useLatest(options);
  const vadRef = useRef<MicVAD | null>(null);
  const loadingRef = useRef<Promise<MicVAD> | null>(null);
  const [status, setStatus] = useState<MicStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const ensure = useCallback(async (): Promise<MicVAD> => {
    if (vadRef.current) return vadRef.current;
    if (loadingRef.current) return loadingRef.current;
    setStatus('loading');
    loadingRef.current = (async () => {
      const { MicVAD } = await import('@ricky0123/vad-web');
      const vad = await MicVAD.new({
        model: 'v5',
        baseAssetPath: '/vad/',
        onnxWASMBasePath: '/vad/',
        startOnLoad: false,
        positiveSpeechThreshold: 0.6,
        negativeSpeechThreshold: 0.35,
        redemptionMs: 650,
        preSpeechPadMs: 350,
        minSpeechMs: 250,
        submitUserSpeechOnPause: true,
        onSpeechRealStart: () => latest.current.onSpeechStart?.(),
        onSpeechEnd: (audio) =>
          latest.current.onUtterance(
            encodeWav(audio, SAMPLE_RATE),
            Math.round((audio.length / SAMPLE_RATE) * 1000),
          ),
        onFrameProcessed: (_probabilities, frame) => latest.current.onLevel?.(rmsLevel(frame)),
        onVADMisfire: () => latest.current.onLevel?.(0),
      });
      vadRef.current = vad;
      setStatus('ready');
      return vad;
    })();
    try {
      return await loadingRef.current;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Microphone unavailable';
      setError(message);
      setStatus('error');
      latest.current.onError?.(message);
      throw err;
    } finally {
      loadingRef.current = null;
    }
  }, [latest]);

  const start = useCallback(async () => {
    try {
      const vad = await ensure();
      await vad.start();
      setStatus('listening');
    } catch {
      /* reported via onError */
    }
  }, [ensure]);

  const stop = useCallback(async () => {
    const vad = vadRef.current;
    if (!vad) return;
    await vad.pause();
    latest.current.onLevel?.(0);
    setStatus('ready');
  }, [latest]);

  useEffect(
    () => () => {
      void vadRef.current?.destroy();
      vadRef.current = null;
    },
    [],
  );

  const supported = useMicrophoneSupported();
  return { status, error, supported, start, stop };
}
