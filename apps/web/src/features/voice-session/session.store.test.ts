import type { Message } from '@voice-agent/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSessionStore } from './session.store';

const message = (id: string, role: 'user' | 'assistant', content: string): Message => ({
  id,
  conversationId: 'c',
  role,
  content,
  sources: [],
  steps: [],
  metrics: role === 'assistant' ? { sttMs: 300, firstTokenMs: 900, firstAudioMs: 1400, ttsMs: 350, totalMs: 2100, llmCalls: 2, toolCalls: 2 } : null,
  createdAt: new Date().toISOString(),
});

describe('session store', () => {
  beforeEach(() => useSessionStore.getState().resetConversation());

  it('tracks a full turn: transcript → streaming → trace → completion', () => {
    const store = useSessionStore.getState();
    store.sessionReady({ conversationId: 'c', userContext: store.persona, provider: 'mock' });
    store.transcriptReceived('t1', 'How many days?');
    expect(useSessionStore.getState().messages.map((m) => m.id)).toEqual(['pending-user-t1']);

    store.turnStateChanged('t1', 'thinking');
    store.textDelta('t1', 'Let me ');
    store.textDelta('t1', 'check.');
    expect(useSessionStore.getState().streaming?.text).toBe('Let me check.');

    store.toolCalled({ turnId: 't1', callId: '1', name: 'search_knowledge_base', args: { queries: ['days'] } });
    expect(useSessionStore.getState().streaming).toBeNull();
    store.toolResult({ turnId: 't1', callId: '1', name: 'search_knowledge_base', ok: true, durationMs: 12, summary: '5 passages' });
    store.retrievalEvaluated({ turnId: 't1', callId: '1', assessment: 'strong', topScore: 0.61, hits: 5, queries: ['days'] });
    store.textDelta('t1', 'Twenty days.');
    store.turnStateChanged('t1', 'speaking');
    expect(useSessionStore.getState().phase).toBe('speaking');

    store.turnCompleted('t1', message('u1', 'user', 'How many days?'), message('a1', 'assistant', 'Twenty days [1].'));
    store.turnStateChanged('t1', 'idle');
    const state = useSessionStore.getState();
    expect(state.messages.map((m) => m.id)).toEqual(['u1', 'a1']);
    expect(state.streaming).toBeNull();
    expect(state.lastMetrics?.totalMs).toBe(2100);
    expect(state.trace.map((t) => t.kind)).toEqual(['tool_call', 'tool_result', 'retrieval', 'state']);
    expect(state.phase).toBe('idle');
    expect(state.activeTurnId).toBeNull();
  });

  it('returns to listening after a turn when the mic is active and clears pending input on failure', () => {
    const store = useSessionStore.getState();
    store.setMicActive(true);
    expect(useSessionStore.getState().phase).toBe('listening');
    store.transcriptReceived('t2', 'hello');
    store.turnStateChanged('t2', 'thinking');
    store.turnFailed('t2', 'TURN_FAILED', 'boom');
    const state = useSessionStore.getState();
    expect(state.error).toBe('boom');
    expect(state.messages).toEqual([]);
    expect(state.phase).toBe('listening');
  });

  it('treats cancellation as non-error and keeps the transcript', () => {
    const store = useSessionStore.getState();
    store.transcriptReceived('t3', 'stop');
    store.turnFailed('t3', 'CANCELLED', 'Turn cancelled');
    expect(useSessionStore.getState().error).toBeNull();
    expect(useSessionStore.getState().messages).toHaveLength(1);
  });
});
