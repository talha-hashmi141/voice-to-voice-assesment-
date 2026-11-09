import type {
  AudioSubmitMeta,
  ClientToServerEvents,
  ServerToClientEvents,
  SessionReadyPayload,
  UserContext,
} from '@voice-agent/contracts';
import { ClientEvents, ServerEvents, VOICE_NAMESPACE } from '@voice-agent/contracts';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from '@/lib/config';

export type VoiceSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface VoiceClientHandlers {
  onConnectionChange: (state: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
  onSessionReady: (payload: SessionReadyPayload) => void;
  onTurnState: ServerToClientEvents[typeof ServerEvents.TurnState];
  onTranscript: ServerToClientEvents[typeof ServerEvents.TranscriptUser];
  onTextDelta: ServerToClientEvents[typeof ServerEvents.AgentTextDelta];
  onToolCall: ServerToClientEvents[typeof ServerEvents.AgentToolCall];
  onToolResult: ServerToClientEvents[typeof ServerEvents.AgentToolResult];
  onRetrievalEvaluated: ServerToClientEvents[typeof ServerEvents.AgentRetrievalEvaluated];
  onAudio: ServerToClientEvents[typeof ServerEvents.AgentAudio];
  onTurnCompleted: ServerToClientEvents[typeof ServerEvents.TurnCompleted];
  onTurnError: ServerToClientEvents[typeof ServerEvents.TurnError];
}

/** Thin wrapper around the typed Socket.IO connection to the /voice namespace. */
export class VoiceClient {
  private socket: VoiceSocket | null = null;

  constructor(private readonly handlers: VoiceClientHandlers) {}

  connect(persona: UserContext, conversationId?: string): void {
    if (this.socket) this.disconnect();
    this.handlers.onConnectionChange('connecting');
    const socket: VoiceSocket = io(`${API_URL}${VOICE_NAMESPACE}`, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 500,
    });
    this.socket = socket;

    socket.on('connect', () => {
      this.handlers.onConnectionChange('connected');
      socket.emit(ClientEvents.SessionStart, { conversationId, userContext: persona });
    });
    socket.on('disconnect', () => this.handlers.onConnectionChange('disconnected'));
    socket.on('connect_error', () => this.handlers.onConnectionChange('error'));
    socket.on(ServerEvents.SessionReady, this.handlers.onSessionReady);
    socket.on(ServerEvents.TurnState, this.handlers.onTurnState);
    socket.on(ServerEvents.TranscriptUser, this.handlers.onTranscript);
    socket.on(ServerEvents.AgentTextDelta, this.handlers.onTextDelta);
    socket.on(ServerEvents.AgentToolCall, this.handlers.onToolCall);
    socket.on(ServerEvents.AgentToolResult, this.handlers.onToolResult);
    socket.on(ServerEvents.AgentRetrievalEvaluated, this.handlers.onRetrievalEvaluated);
    socket.on(ServerEvents.AgentAudio, this.handlers.onAudio);
    socket.on(ServerEvents.TurnCompleted, this.handlers.onTurnCompleted);
    socket.on(ServerEvents.TurnError, this.handlers.onTurnError);
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  sendText(text: string): void {
    this.socket?.emit(ClientEvents.TextSubmit, { text });
  }

  sendAudio(audio: ArrayBuffer, meta: AudioSubmitMeta): void {
    this.socket?.emit(ClientEvents.AudioSubmit, { audio, ...meta });
  }

  cancelTurn(): void {
    this.socket?.emit(ClientEvents.TurnCancel);
  }

  resetConversation(): void {
    this.socket?.emit(ClientEvents.ConversationReset);
  }

  disconnect(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.handlers.onConnectionChange('disconnected');
  }
}
