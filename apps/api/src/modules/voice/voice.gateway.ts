import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  AudioSubmitMetaSchema,
  ClientEvents,
  type ClientToServerEvents,
  type ServerToClientEvents,
  ServerEvents,
  type SessionReadyPayload,
  SessionStartSchema,
  TextSubmitSchema,
  type UserContext,
  VOICE_NAMESPACE,
} from '@voice-agent/contracts';
import { type Server, type Socket } from 'socket.io';
import { AppConfigService, newId } from '../../common';
import { ConversationService } from '../conversations';
import { type VoiceEvent } from './voice-events';
import { VoiceTurnPipeline, type VoiceTurnInput } from './voice-turn-pipeline';

type VoiceSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

interface VoiceSession {
  conversationId: string;
  userContext: UserContext;
  active?: { turnId: string; controller: AbortController };
}

const MAX_TRACE_PAYLOAD = 4_000;

/** Keeps tool payloads sent to the UI small and free of full passage text. */
function toTracePayload(name: string, data: unknown): Record<string, unknown> | undefined {
  if (!data || typeof data !== 'object') return undefined;
  if (name === 'search_knowledge_base') {
    const search = data as {
      assessment?: string;
      passages?: { ref: number; document: string; section: string; score: number }[];
    };
    return {
      assessment: search.assessment,
      passages: (search.passages ?? []).map(({ ref, document, section, score }) => ({
        ref,
        document,
        section,
        score,
      })),
    };
  }
  const serialised = JSON.stringify(data);
  return serialised.length <= MAX_TRACE_PAYLOAD ? (data as Record<string, unknown>) : undefined;
}

const toBuffer = (audio: unknown): Buffer | null => {
  if (Buffer.isBuffer(audio)) return audio;
  if (audio instanceof ArrayBuffer) return Buffer.from(audio);
  if (ArrayBuffer.isView(audio))
    return Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength);
  return null;
};

/**
 * Socket.IO gateway for the voice session: one conversation per socket, one active turn at a
 * time. A new utterance while the agent is speaking cancels the current turn (barge-in).
 */
@WebSocketGateway({
  namespace: VOICE_NAMESPACE,
  cors: { origin: true, credentials: true },
  maxHttpBufferSize: 10 * 1024 * 1024,
})
export class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(VoiceGateway.name);
  private readonly sessions = new Map<string, VoiceSession>();

  @WebSocketServer()
  server!: Server<ClientToServerEvents, ServerToClientEvents>;

  constructor(
    private readonly pipeline: VoiceTurnPipeline,
    private readonly conversations: ConversationService,
    private readonly config: AppConfigService,
  ) {}

  handleConnection(client: VoiceSocket): void {
    this.logger.debug(`client connected ${client.id}`);
  }

  handleDisconnect(client: VoiceSocket): void {
    this.abortActive(client.id);
    this.sessions.delete(client.id);
    this.logger.debug(`client disconnected ${client.id}`);
  }

  @SubscribeMessage(ClientEvents.SessionStart)
  async onSessionStart(
    @ConnectedSocket() client: VoiceSocket,
    @MessageBody() payload: unknown,
  ): Promise<SessionReadyPayload | undefined> {
    const parsed = SessionStartSchema.safeParse(payload);
    if (!parsed.success) {
      this.emitError(
        client,
        null,
        'INVALID_PAYLOAD',
        parsed.error.issues.map((i) => i.message).join('; '),
      );
      return undefined;
    }
    this.abortActive(client.id);
    const conversation = await this.conversations.ensure(
      parsed.data.conversationId,
      parsed.data.userContext,
    );
    this.sessions.set(client.id, {
      conversationId: conversation.id,
      userContext: conversation.userContext,
    });
    const ready: SessionReadyPayload = {
      conversationId: conversation.id,
      userContext: conversation.userContext,
      provider: this.config.aiProvider,
    };
    client.emit(ServerEvents.SessionReady, ready);
    return ready;
  }

  @SubscribeMessage(ClientEvents.ConversationReset)
  async onConversationReset(
    @ConnectedSocket() client: VoiceSocket,
  ): Promise<SessionReadyPayload | undefined> {
    const session = this.sessions.get(client.id);
    if (!session) {
      this.emitError(client, null, 'NO_SESSION', 'Start a session first');
      return undefined;
    }
    this.abortActive(client.id);
    const conversation = await this.conversations.ensure(undefined, session.userContext);
    session.conversationId = conversation.id;
    const ready: SessionReadyPayload = {
      conversationId: conversation.id,
      userContext: session.userContext,
      provider: this.config.aiProvider,
    };
    client.emit(ServerEvents.SessionReady, ready);
    return ready;
  }

  @SubscribeMessage(ClientEvents.TextSubmit)
  onTextSubmit(@ConnectedSocket() client: VoiceSocket, @MessageBody() payload: unknown): void {
    const parsed = TextSubmitSchema.safeParse(payload);
    if (!parsed.success) {
      this.emitError(client, null, 'INVALID_PAYLOAD', 'text is required');
      return;
    }
    void this.startTurn(client, { text: parsed.data.text });
  }

  @SubscribeMessage(ClientEvents.AudioSubmit)
  onAudioSubmit(@ConnectedSocket() client: VoiceSocket, @MessageBody() payload: unknown): void {
    const { audio, ...meta } = (payload ?? {}) as { audio?: unknown } & Record<string, unknown>;
    const parsedMeta = AudioSubmitMetaSchema.safeParse(meta);
    const buffer = toBuffer(audio);
    if (!parsedMeta.success || !buffer?.byteLength) {
      this.emitError(client, null, 'INVALID_PAYLOAD', 'audio (binary) and mimeType are required');
      return;
    }
    void this.startTurn(client, { audio: { data: buffer, mimeType: parsedMeta.data.mimeType } });
  }

  @SubscribeMessage(ClientEvents.TurnCancel)
  onTurnCancel(@ConnectedSocket() client: VoiceSocket): void {
    this.abortActive(client.id);
  }

  private async startTurn(
    client: VoiceSocket,
    input: Pick<VoiceTurnInput, 'audio' | 'text'>,
  ): Promise<void> {
    const session = this.sessions.get(client.id);
    if (!session) {
      this.emitError(client, null, 'NO_SESSION', 'Start a session first');
      return;
    }
    this.abortActive(client.id); // barge-in: a new utterance replaces the running turn
    const turnId = newId();
    const controller = new AbortController();
    session.active = { turnId, controller };

    try {
      for await (const event of this.pipeline.run({
        turnId,
        conversationId: session.conversationId,
        userContext: session.userContext,
        signal: controller.signal,
        ...input,
      })) {
        if (controller.signal.aborted && event.type !== 'cancelled') continue;
        this.relay(client, turnId, session.conversationId, event);
      }
    } catch (error) {
      this.logger.error(
        `turn ${turnId} crashed: ${error instanceof Error ? error.stack : String(error)}`,
      );
      this.emitError(
        client,
        turnId,
        'TURN_FAILED',
        'Something went wrong while handling your request',
      );
    } finally {
      if (session.active?.turnId === turnId) session.active = undefined;
      client.emit(ServerEvents.TurnState, { turnId, state: 'idle' });
    }
  }

  private relay(
    client: VoiceSocket,
    turnId: string,
    conversationId: string,
    event: VoiceEvent,
  ): void {
    switch (event.type) {
      case 'state':
        client.emit(ServerEvents.TurnState, { turnId, state: event.state });
        break;
      case 'transcript':
        client.emit(ServerEvents.TranscriptUser, { turnId, text: event.text, sttMs: event.sttMs });
        break;
      case 'text_delta':
        client.emit(ServerEvents.AgentTextDelta, { turnId, delta: event.delta });
        break;
      case 'tool_call':
        client.emit(ServerEvents.AgentToolCall, {
          turnId,
          callId: event.callId,
          name: event.name,
          args: event.args,
        });
        break;
      case 'tool_result':
        client.emit(ServerEvents.AgentToolResult, {
          turnId,
          callId: event.callId,
          name: event.name,
          ok: event.ok,
          durationMs: event.durationMs,
          summary: event.summary,
          data: toTracePayload(event.name, event.data),
        });
        break;
      case 'retrieval_evaluated':
        client.emit(ServerEvents.AgentRetrievalEvaluated, {
          turnId,
          callId: event.callId,
          assessment: event.assessment,
          topScore: event.topScore,
          hits: event.hits,
          queries: event.queries,
        });
        break;
      case 'audio':
        client.emit(ServerEvents.AgentAudio, {
          turnId,
          seq: event.seq,
          mimeType: event.mimeType,
          data: event.data,
          text: event.text,
        });
        break;
      case 'completed':
        client.emit(ServerEvents.TurnCompleted, {
          turnId,
          conversationId,
          userMessage: event.result.userMessage,
          assistantMessage: event.result.assistantMessage,
          sources: event.result.sources,
          steps: event.result.steps,
        });
        break;
      case 'cancelled':
        client.emit(ServerEvents.TurnError, {
          turnId,
          code: 'CANCELLED',
          message: 'Turn cancelled',
        });
        break;
      case 'error':
        this.emitError(client, turnId, event.code, event.message);
        break;
    }
  }

  private emitError(
    client: VoiceSocket,
    turnId: string | null,
    code: string,
    message: string,
  ): void {
    client.emit(ServerEvents.TurnError, { turnId, code, message });
  }

  private abortActive(clientId: string): void {
    const session = this.sessions.get(clientId);
    if (session?.active) {
      session.active.controller.abort();
      session.active = undefined;
    }
  }
}
