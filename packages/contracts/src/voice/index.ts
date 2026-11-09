import { z } from 'zod';
import { IdSchema } from '../common';
import { type AgentStep, type Message, type Source } from '../conversations';
import { type RetrievalAssessment } from '../agent';
import { UserContextSchema, type UserContext } from '../user-context';

export const VOICE_NAMESPACE = '/voice';

export const TurnStateSchema = z.enum([
  'idle',
  'transcribing',
  'thinking',
  'executing_tools',
  'speaking',
]);
export type TurnState = z.infer<typeof TurnStateSchema>;

/* ─────────────── client → server payloads ─────────────── */

export const SessionStartSchema = z.object({
  conversationId: IdSchema.optional(),
  userContext: UserContextSchema,
});
export type SessionStartPayload = z.infer<typeof SessionStartSchema>;

export const AudioSubmitMetaSchema = z.object({
  mimeType: z.string().min(1),
  sampleRate: z.number().int().positive().optional(),
  durationMs: z.number().nonnegative().optional(),
});
export type AudioSubmitMeta = z.infer<typeof AudioSubmitMetaSchema>;
export type AudioSubmitPayload = AudioSubmitMeta & { audio: ArrayBuffer | Uint8Array };

export const TextSubmitSchema = z.object({
  text: z.string().trim().min(1).max(2000),
});
export type TextSubmitPayload = z.infer<typeof TextSubmitSchema>;

/* ─────────────── server → client payloads ─────────────── */

export interface SessionReadyPayload {
  conversationId: string;
  userContext: UserContext;
  provider: 'openai' | 'mock';
}

export interface TurnStatePayload {
  turnId: string;
  state: TurnState;
}

export interface TranscriptUserPayload {
  turnId: string;
  text: string;
  sttMs: number | null;
}

export interface AgentTextDeltaPayload {
  turnId: string;
  delta: string;
}

export interface AgentToolCallPayload {
  turnId: string;
  callId: string;
  name: string;
  args: Record<string, unknown>;
}

export interface AgentToolResultPayload {
  turnId: string;
  callId: string;
  name: string;
  ok: boolean;
  durationMs: number;
  /** Compact, UI-friendly summary of the result (never the raw tool payload). */
  summary: string;
  data?: Record<string, unknown>;
}

export interface AgentRetrievalEvaluatedPayload {
  turnId: string;
  callId: string;
  assessment: RetrievalAssessment;
  topScore: number | null;
  hits: number;
  queries: string[];
}

export interface AgentAudioPayload {
  turnId: string;
  /** Monotonic sequence number so the client can play clips in order. */
  seq: number;
  mimeType: string;
  data: ArrayBuffer | Uint8Array;
  /** The sentence this clip speaks. */
  text: string;
}

export interface TurnCompletedPayload {
  turnId: string;
  conversationId: string;
  userMessage: Message;
  assistantMessage: Message;
  sources: Source[];
  steps: AgentStep[];
}

export interface TurnErrorPayload {
  turnId: string | null;
  code: string;
  message: string;
}

/* ─────────────── event names ─────────────── */

export const ClientEvents = {
  SessionStart: 'session.start',
  AudioSubmit: 'audio.submit',
  TextSubmit: 'text.submit',
  TurnCancel: 'turn.cancel',
  ConversationReset: 'conversation.reset',
} as const;

export const ServerEvents = {
  SessionReady: 'session.ready',
  TurnState: 'turn.state',
  TranscriptUser: 'transcript.user',
  AgentTextDelta: 'agent.text.delta',
  AgentToolCall: 'agent.tool.call',
  AgentToolResult: 'agent.tool.result',
  AgentRetrievalEvaluated: 'agent.retrieval.evaluated',
  AgentAudio: 'agent.audio',
  TurnCompleted: 'turn.completed',
  TurnError: 'turn.error',
} as const;

/** Typed Socket.IO event maps, used as generics on both the server gateway and the client socket. */
export interface ClientToServerEvents {
  [ClientEvents.SessionStart]: (
    payload: SessionStartPayload,
    ack?: (response: SessionReadyPayload) => void,
  ) => void;
  [ClientEvents.AudioSubmit]: (payload: AudioSubmitPayload) => void;
  [ClientEvents.TextSubmit]: (payload: TextSubmitPayload) => void;
  [ClientEvents.TurnCancel]: () => void;
  [ClientEvents.ConversationReset]: (ack?: (response: SessionReadyPayload) => void) => void;
}

export interface ServerToClientEvents {
  [ServerEvents.SessionReady]: (payload: SessionReadyPayload) => void;
  [ServerEvents.TurnState]: (payload: TurnStatePayload) => void;
  [ServerEvents.TranscriptUser]: (payload: TranscriptUserPayload) => void;
  [ServerEvents.AgentTextDelta]: (payload: AgentTextDeltaPayload) => void;
  [ServerEvents.AgentToolCall]: (payload: AgentToolCallPayload) => void;
  [ServerEvents.AgentToolResult]: (payload: AgentToolResultPayload) => void;
  [ServerEvents.AgentRetrievalEvaluated]: (payload: AgentRetrievalEvaluatedPayload) => void;
  [ServerEvents.AgentAudio]: (payload: AgentAudioPayload) => void;
  [ServerEvents.TurnCompleted]: (payload: TurnCompletedPayload) => void;
  [ServerEvents.TurnError]: (payload: TurnErrorPayload) => void;
}
