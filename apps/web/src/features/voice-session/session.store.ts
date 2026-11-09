import type {
  AgentRetrievalEvaluatedPayload,
  AgentToolCallPayload,
  AgentToolResultPayload,
  Message,
  SessionReadyPayload,
  TurnMetrics,
  TurnState,
  UserContext,
} from '@voice-agent/contracts';
import { DEFAULT_PERSONA } from '@voice-agent/contracts';
import { create } from 'zustand';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
export type InputMode = 'handsfree' | 'push';
/** Client-side extension of the server turn state with the "listening" phase. */
export type SessionPhase = TurnState | 'listening';

export interface TraceEntry {
  id: string;
  turnId: string;
  kind: 'tool_call' | 'tool_result' | 'retrieval' | 'state';
  label: string;
  at: number;
  name?: string;
  ok?: boolean;
  durationMs?: number;
  data?: Record<string, unknown>;
  assessment?: AgentRetrievalEvaluatedPayload['assessment'];
}

export interface StreamingAssistant {
  turnId: string;
  text: string;
}

export interface SessionState {
  connection: ConnectionState;
  provider: SessionReadyPayload['provider'] | null;
  conversationId: string | null;
  persona: UserContext;
  mode: InputMode;
  phase: SessionPhase;
  activeTurnId: string | null;
  micActive: boolean;
  micLevel: number;
  messages: Message[];
  streaming: StreamingAssistant | null;
  trace: TraceEntry[];
  lastMetrics: TurnMetrics | null;
  error: string | null;
  turnStartedAt: number | null;
}

export interface SessionActions {
  setConnection: (connection: ConnectionState) => void;
  setPersona: (persona: UserContext) => void;
  setMode: (mode: InputMode) => void;
  setMicActive: (active: boolean) => void;
  setMicLevel: (level: number) => void;
  setPhase: (phase: SessionPhase) => void;
  setError: (error: string | null) => void;
  sessionReady: (payload: SessionReadyPayload) => void;
  loadMessages: (messages: Message[]) => void;
  turnStarted: (turnId: string) => void;
  transcriptReceived: (turnId: string, text: string) => void;
  textDelta: (turnId: string, delta: string) => void;
  toolCalled: (payload: AgentToolCallPayload) => void;
  toolResult: (payload: AgentToolResultPayload) => void;
  retrievalEvaluated: (payload: AgentRetrievalEvaluatedPayload) => void;
  turnStateChanged: (turnId: string, state: TurnState) => void;
  turnCompleted: (turnId: string, userMessage: Message, assistantMessage: Message) => void;
  turnFailed: (turnId: string | null, code: string, message: string) => void;
  resetConversation: () => void;
}

export type SessionStore = SessionState & SessionActions;

const initialState: SessionState = {
  connection: 'disconnected',
  provider: null,
  conversationId: null,
  persona: DEFAULT_PERSONA,
  mode: 'handsfree',
  phase: 'idle',
  activeTurnId: null,
  micActive: false,
  micLevel: 0,
  messages: [],
  streaming: null,
  trace: [],
  lastMetrics: null,
  error: null,
  turnStartedAt: null,
};

let traceSeq = 0;
const traceId = () => `trace-${(traceSeq += 1)}`;

const elapsed = (state: SessionState) =>
  state.turnStartedAt ? Date.now() - state.turnStartedAt : 0;

const TOOL_LABELS: Record<string, string> = {
  search_knowledge_base: 'Searching the knowledge base',
  get_current_datetime: 'Checking the date and time',
  count_business_days: 'Counting working days',
  calculate: 'Calculating',
  get_leave_balance: 'Looking up leave balance',
  create_support_ticket: 'Creating a support ticket',
};

export const describeTool = (name: string): string => TOOL_LABELS[name] ?? name;

export const useSessionStore = create<SessionStore>()((set) => ({
  ...initialState,

  setConnection: (connection) => set({ connection }),
  setPersona: (persona) => set({ persona }),
  setMode: (mode) => set({ mode }),
  setMicActive: (micActive) =>
    set((state) => ({
      micActive,
      phase:
        micActive && state.phase === 'idle'
          ? 'listening'
          : !micActive && state.phase === 'listening'
            ? 'idle'
            : state.phase,
    })),
  setMicLevel: (micLevel) => set({ micLevel }),
  setPhase: (phase) => set({ phase }),
  setError: (error) => set({ error }),

  sessionReady: (payload) =>
    set({
      conversationId: payload.conversationId,
      persona: payload.userContext,
      provider: payload.provider,
      connection: 'connected',
      error: null,
    }),

  loadMessages: (messages) => set({ messages, streaming: null, trace: [] }),

  turnStarted: (turnId) =>
    set({
      activeTurnId: turnId,
      streaming: null,
      trace: [],
      error: null,
      turnStartedAt: Date.now(),
    }),

  transcriptReceived: (turnId, text) =>
    set((state) => ({
      activeTurnId: turnId,
      turnStartedAt: state.turnStartedAt ?? Date.now(),
      trace: state.activeTurnId === turnId ? state.trace : [],
      messages: [
        ...state.messages,
        {
          id: `pending-user-${turnId}`,
          conversationId: state.conversationId ?? '',
          role: 'user',
          content: text,
          sources: [],
          steps: [],
          metrics: null,
          createdAt: new Date().toISOString(),
        },
      ],
    })),

  textDelta: (turnId, delta) =>
    set((state) => ({
      streaming:
        state.streaming?.turnId === turnId
          ? { turnId, text: state.streaming.text + delta }
          : { turnId, text: delta },
    })),

  toolCalled: (payload) =>
    set((state) => ({
      // Narration streamed before a tool call is not the final answer; move it out of the bubble.
      streaming: null,
      trace: [
        ...state.trace,
        {
          id: traceId(),
          turnId: payload.turnId,
          kind: 'tool_call',
          name: payload.name,
          label: describeTool(payload.name),
          data: payload.args,
          at: elapsed(state),
        },
      ],
    })),

  toolResult: (payload) =>
    set((state) => ({
      trace: [
        ...state.trace,
        {
          id: traceId(),
          turnId: payload.turnId,
          kind: 'tool_result',
          name: payload.name,
          label: payload.summary,
          ok: payload.ok,
          durationMs: payload.durationMs,
          data: payload.data,
          at: elapsed(state),
        },
      ],
    })),

  retrievalEvaluated: (payload) =>
    set((state) => ({
      trace: [
        ...state.trace,
        {
          id: traceId(),
          turnId: payload.turnId,
          kind: 'retrieval',
          label: `Retrieval ${payload.assessment}${payload.topScore !== null ? ` · top score ${payload.topScore.toFixed(2)}` : ''} · ${payload.hits} passages`,
          assessment: payload.assessment,
          data: { queries: payload.queries },
          at: elapsed(state),
        },
      ],
    })),

  turnStateChanged: (turnId, turnState) =>
    set((state) => {
      if (turnState === 'idle') {
        return { phase: state.micActive ? 'listening' : 'idle', activeTurnId: null };
      }
      return { phase: turnState, activeTurnId: turnId };
    }),

  turnCompleted: (turnId, userMessage, assistantMessage) =>
    set((state) => ({
      messages: [
        ...state.messages.filter((m) => m.id !== `pending-user-${turnId}`),
        userMessage,
        assistantMessage,
      ],
      streaming: null,
      lastMetrics: assistantMessage.metrics,
      trace: [
        ...state.trace,
        { id: traceId(), turnId, kind: 'state', label: 'Answer ready', at: elapsed(state) },
      ],
    })),

  turnFailed: (turnId, code, message) =>
    set((state) => ({
      error: code === 'CANCELLED' ? null : message,
      streaming: null,
      messages:
        code === 'CANCELLED'
          ? state.messages
          : state.messages.filter((m) => m.id !== `pending-user-${turnId}`),
      phase: state.micActive ? 'listening' : 'idle',
      activeTurnId: null,
    })),

  resetConversation: () =>
    set((state) => ({
      ...initialState,
      connection: state.connection,
      provider: state.provider,
      persona: state.persona,
      mode: state.mode,
      micActive: state.micActive,
      phase: state.micActive ? 'listening' : 'idle',
    })),
}));
