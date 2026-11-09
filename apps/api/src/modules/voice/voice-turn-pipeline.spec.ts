import { DEFAULT_PERSONA } from '@voice-agent/contracts';
import { type AppConfigService } from '../../common';
import { type AgentEvent, type AgentRuntime, type AgentTurnResult } from '../agent';
import { type MessageRepository } from '../conversations';
import { type SttProvider, type TtsProvider } from '../speech';
import { type VoiceEvent } from './voice-events';
import { VoiceTurnPipeline } from './voice-turn-pipeline';

const result = (): AgentTurnResult => ({
  text: 'Twenty days a year [1]. Five carry over.',
  spokenText: 'Twenty days a year. Five carry over.',
  sources: [],
  steps: [],
  metrics: { sttMs: null, firstTokenMs: 12, firstAudioMs: null, ttsMs: null, totalMs: 40, llmCalls: 1, toolCalls: 0 },
  userMessage: { id: 'u', conversationId: 'c', role: 'user', content: 'q', sources: [], steps: [], metrics: null, createdAt: new Date().toISOString() },
  assistantMessage: { id: 'a', conversationId: 'c', role: 'assistant', content: 'x', sources: [], steps: [], metrics: null, createdAt: new Date().toISOString() },
});

const scriptedAgent = (events: AgentEvent[], onRun?: () => void): AgentRuntime =>
  ({
    run: async function* () {
      onRun?.();
      for (const event of events) {
        await new Promise((r) => setTimeout(r, 1));
        yield event;
      }
    },
  }) as unknown as AgentRuntime;

const deltas = (text: string): AgentEvent[] => text.split(/(?<=\s)/u).map((delta) => ({ type: 'text_delta', delta }));

const tts: TtsProvider = {
  model: 'fake',
  synthesize: async ({ text }) => {
    await new Promise((r) => setTimeout(r, text.length % 7)); // variable latency: ordering must not depend on it
    return { data: Buffer.from(text), mimeType: 'audio/wav' };
  },
};
const stt: SttProvider = { model: 'fake', transcribe: async ({ audio }) => ({ text: audio.byteLength ? 'how many days' : '' }) };
const messages = { updateMetrics: jest.fn() } as unknown as MessageRepository;
const config = { openai: { ttsVoice: 'coral' } } as unknown as AppConfigService;

const collect = async (pipeline: VoiceTurnPipeline, input: Parameters<VoiceTurnPipeline['run']>[0]) => {
  const events: VoiceEvent[] = [];
  for await (const event of pipeline.run(input)) events.push(event);
  return events;
};

describe('VoiceTurnPipeline', () => {
  it('transcribes, streams the answer and emits audio clips per sentence in order', async () => {
    const agent = scriptedAgent([{ type: 'state', state: 'thinking' }, ...deltas('Twenty days a year [1]. Five carry over! That is all.'), { type: 'completed', result: result() }]);
    const pipeline = new VoiceTurnPipeline(agent, stt, tts, messages, config);
    const events = await collect(pipeline, { turnId: 't', conversationId: 'c', userContext: DEFAULT_PERSONA, audio: { data: Buffer.alloc(2000), mimeType: 'audio/wav' }, signal: new AbortController().signal });

    const types = events.map((e) => e.type);
    expect(types.slice(0, 3)).toEqual(['state', 'transcript', 'state']);
    expect(events[1]).toMatchObject({ type: 'transcript', text: 'how many days' });
    expect((events[1] as { sttMs: number }).sttMs).toBeGreaterThanOrEqual(0);

    const audio = events.filter((e) => e.type === 'audio') as Extract<VoiceEvent, { type: 'audio' }>[];
    // short sentences are merged with their neighbour to avoid choppy speech
    expect(audio.map((a) => a.seq)).toEqual([0, 1]);
    expect(audio.map((a) => a.text)).toEqual(['Twenty days a year.', 'Five carry over! That is all.']);
    expect(types.indexOf('state')).toBeLessThan(types.indexOf('audio'));
    expect(events.some((e) => e.type === 'state' && e.state === 'speaking')).toBe(true);

    const completed = events[events.length - 1];
    expect(completed?.type).toBe('completed');
    const metrics = completed?.type === 'completed' ? completed.result.metrics : null;
    expect(metrics?.firstAudioMs).not.toBeNull();
    expect(metrics?.ttsMs).not.toBeNull();
    expect(messages.updateMetrics).toHaveBeenCalledWith('a', expect.objectContaining({ sttMs: expect.any(Number) }));
  });

  it('skips transcription for text input and speaks narration emitted before tool calls', async () => {
    const agent = scriptedAgent([
      ...deltas('Let me check that for you.'),
      { type: 'tool_call', callId: '1', name: 'search_knowledge_base', args: {} },
      { type: 'tool_result', callId: '1', name: 'search_knowledge_base', ok: true, summary: '3 passages', durationMs: 5 },
      ...deltas('You get twenty days.'),
      { type: 'completed', result: result() },
    ]);
    const events = await collect(new VoiceTurnPipeline(agent, stt, tts, messages, config), { turnId: 't', conversationId: 'c', userContext: DEFAULT_PERSONA, text: 'hi there', signal: new AbortController().signal });
    expect(events[0]).toEqual({ type: 'transcript', text: 'hi there', sttMs: null });
    expect(events.some((e) => e.type === 'state' && e.state === 'transcribing')).toBe(false);
    const audio = events.filter((e) => e.type === 'audio') as Extract<VoiceEvent, { type: 'audio' }>[];
    expect(audio.map((a) => a.text)).toEqual(['Let me check that for you.', 'You get twenty days.']);
  });

  it('reports an empty transcript as a fatal error without running the agent', async () => {
    const runs = jest.fn();
    const events = await collect(new VoiceTurnPipeline(scriptedAgent([], runs), stt, tts, messages, config), { turnId: 't', conversationId: 'c', userContext: DEFAULT_PERSONA, audio: { data: Buffer.alloc(0), mimeType: 'audio/wav' }, signal: new AbortController().signal });
    expect(events[events.length - 1]).toMatchObject({ type: 'error', code: 'EMPTY_TRANSCRIPT', fatal: true });
    expect(runs).not.toHaveBeenCalled();
  });

  it('propagates cancellation and drops queued audio', async () => {
    const controller = new AbortController();
    const agent = scriptedAgent([...deltas('First sentence here. '), { type: 'cancelled', partialText: 'First sentence here.' }], () => setTimeout(() => controller.abort(), 2));
    const events = await collect(new VoiceTurnPipeline(agent, stt, tts, messages, config), { turnId: 't', conversationId: 'c', userContext: DEFAULT_PERSONA, text: 'go', signal: controller.signal });
    expect(events[events.length - 1]).toEqual({ type: 'cancelled' });
    expect(events.some((e) => e.type === 'completed')).toBe(false);
  });
});
