'use client';

import type { UserContext } from '@voice-agent/contracts';
import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { AudioQueue, useMicrophone } from '@/features/audio';
import { useLatest } from '@/lib/hooks';
import { useSessionStore } from './session.store';
import { VoiceClient } from './voice-client';

export interface UseVoiceSessionOptions {
  /** Resume an existing conversation instead of starting a new one. */
  conversationId?: string;
}

/**
 * Orchestrates the voice session: socket connection, microphone + VAD, ordered audio playback,
 * barge-in, and the session store that the UI renders from.
 */
export function useVoiceSession(options: UseVoiceSessionOptions = {}) {
  const store = useSessionStore();
  const clientRef = useRef<VoiceClient | null>(null);
  const queueRef = useRef<AudioQueue | null>(null);
  const pendingIdleRef = useRef<string | null>(null);
  const latestStore = useLatest(store);

  const stopSpeaking = useCallback(() => {
    queueRef.current?.stop();
  }, []);

  const interrupt = useCallback(() => {
    const current = latestStore.current;
    if (current.activeTurnId || current.phase === 'speaking') {
      stopSpeaking();
      clientRef.current?.cancelTurn();
    }
  }, [latestStore, stopSpeaking]);

  const mic = useMicrophone({
    onUtterance: (wav, durationMs) => {
      const current = latestStore.current;
      if (current.connection !== 'connected') {
        toast.error('Not connected to the voice service');
        return;
      }
      if (current.mode === 'handsfree' && current.phase !== 'idle' && current.phase !== 'listening')
        interrupt();
      clientRef.current?.sendAudio(wav, { mimeType: 'audio/wav', sampleRate: 16_000, durationMs });
      current.turnStarted(`pending-${Date.now()}`);
      current.setPhase('transcribing');
    },
    onSpeechStart: () => {
      // Barge-in: real speech while the agent is talking cancels the current turn.
      if (latestStore.current.mode === 'handsfree' && latestStore.current.phase === 'speaking')
        interrupt();
    },
    onLevel: (level) => useSessionStore.getState().setMicLevel(level),
    onError: (message) => toast.error(message),
  });

  // Socket + audio queue lifecycle. Reconnects when the persona changes (new conversation).
  const personaId = store.persona.personaId;
  const conversationId = options.conversationId;
  useEffect(() => {
    const actions = useSessionStore.getState();
    const queue = new AudioQueue({
      onPlaybackEnd: () => {
        const pending = pendingIdleRef.current;
        if (pending) {
          pendingIdleRef.current = null;
          useSessionStore.getState().turnStateChanged(pending, 'idle');
        }
      },
      onError: () => toast.error('Could not play a reply clip'),
    });
    queueRef.current = queue;

    const client = new VoiceClient({
      onConnectionChange: (state) => actions.setConnection(state),
      onSessionReady: (payload) => actions.sessionReady(payload),
      onTurnState: ({ turnId, state }) => {
        if (state === 'idle' && queue.isPlaying) {
          pendingIdleRef.current = turnId;
          return;
        }
        pendingIdleRef.current = null;
        actions.turnStateChanged(turnId, state);
      },
      onTranscript: ({ turnId, text }) => {
        queue.beginTurn();
        actions.transcriptReceived(turnId, text);
      },
      onTextDelta: ({ turnId, delta }) => actions.textDelta(turnId, delta),
      onToolCall: (payload) => actions.toolCalled(payload),
      onToolResult: (payload) => actions.toolResult(payload),
      onRetrievalEvaluated: (payload) => actions.retrievalEvaluated(payload),
      onAudio: ({ data, mimeType, sampleRate }) => {
        const bytes =
          data instanceof ArrayBuffer
            ? data
            : (data.buffer.slice(
                data.byteOffset,
                data.byteOffset + data.byteLength,
              ) as ArrayBuffer);
        queue.enqueue(bytes, { mimeType, sampleRate });
      },
      onTurnCompleted: ({ turnId, userMessage, assistantMessage }) =>
        actions.turnCompleted(turnId, userMessage, assistantMessage),
      onTurnError: ({ turnId, code, message, fatal }) => {
        if (fatal === false) {
          toast.warning(message);
          return;
        }
        if (code === 'CANCELLED') queue.stop();
        else toast.error(message);
        actions.turnFailed(turnId, code, message);
      },
    });
    clientRef.current = client;
    // Deferred by a tick so React StrictMode's immediate effect cleanup cancels the connect instead of
    // tearing down a half-open socket.
    const timer = setTimeout(
      () => client.connect(useSessionStore.getState().persona, conversationId),
      0,
    );

    return () => {
      clearTimeout(timer);
      client.disconnect();
      queue.stop();
      clientRef.current = null;
      queueRef.current = null;
    };
  }, [personaId, conversationId]);

  const sendText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !clientRef.current) return;
      void queueRef.current?.unlock();
      interrupt();
      clientRef.current.sendText(trimmed);
      useSessionStore.getState().turnStarted(`pending-${Date.now()}`);
      useSessionStore.getState().setPhase('thinking');
    },
    [interrupt],
  );

  const startListening = useCallback(async () => {
    await queueRef.current?.unlock();
    await mic.start();
    useSessionStore.getState().setMicActive(true);
  }, [mic]);

  const stopListening = useCallback(async () => {
    await mic.stop();
    useSessionStore.getState().setMicActive(false);
  }, [mic]);

  const toggleListening = useCallback(async () => {
    if (useSessionStore.getState().micActive) await stopListening();
    else await startListening();
  }, [startListening, stopListening]);

  const reset = useCallback(() => {
    interrupt();
    stopSpeaking();
    clientRef.current?.resetConversation();
    useSessionStore.getState().resetConversation();
  }, [interrupt, stopSpeaking]);

  const changePersona = useCallback(
    async (persona: UserContext) => {
      interrupt();
      await stopListening();
      useSessionStore.getState().resetConversation();
      useSessionStore.getState().setPersona(persona);
    },
    [interrupt, stopListening],
  );

  return {
    ...store,
    mic,
    sendText,
    startListening,
    stopListening,
    toggleListening,
    interrupt,
    reset,
    changePersona,
  };
}
