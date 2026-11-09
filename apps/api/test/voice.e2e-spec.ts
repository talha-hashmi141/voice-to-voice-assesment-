import { type INestApplication } from '@nestjs/common';
import {
  ClientEvents,
  type ClientToServerEvents,
  ServerEvents,
  type ServerToClientEvents,
  type SessionReadyPayload,
  type TurnCompletedPayload,
  DEFAULT_PERSONA,
} from '@voice-agent/contracts';
import { type AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { IngestionService, KNOWLEDGE_BASE_DIR } from '../src/modules/knowledge';
import { MOCK_UTTERANCES } from '../src/modules/speech';
import { createTestApp } from './utils/create-app';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

describe('Voice gateway (e2e, Socket.IO)', () => {
  let app: INestApplication;
  let url: string;
  const clients: Client[] = [];

  const connect = async (): Promise<Client> => {
    const client: Client = io(`${url}/voice`, { transports: ['websocket'], forceNew: true });
    clients.push(client);
    await new Promise<void>((resolve, reject) => {
      client.once('connect', () => resolve());
      client.once('connect_error', reject);
    });
    return client;
  };

  const startSession = (client: Client, conversationId?: string): Promise<SessionReadyPayload> =>
    new Promise((resolve) =>
      client.emit(
        ClientEvents.SessionStart,
        { conversationId, userContext: DEFAULT_PERSONA },
        resolve,
      ),
    );

  /** Records every event of one turn until turn.completed (or a fatal error) arrives. */
  const recordTurn = (
    client: Client,
    trigger: () => void,
  ): Promise<{ events: { event: string; payload: unknown }[]; completed: TurnCompletedPayload }> =>
    new Promise((resolve, reject) => {
      const events: { event: string; payload: unknown }[] = [];
      const record = (event: string) => (payload: unknown) => events.push({ event, payload });
      const listeners = Object.values(ServerEvents).map((event) => [event, record(event)] as const);
      for (const [event, handler] of listeners)
        client.on(event as keyof ServerToClientEvents, handler as never);
      const cleanup = () => {
        for (const [event, handler] of listeners)
          client.off(event as keyof ServerToClientEvents, handler as never);
      };
      client.once(ServerEvents.TurnCompleted, (completed) => {
        cleanup();
        resolve({ events, completed });
      });
      client.on(ServerEvents.TurnError, (error) => {
        if (error.code !== 'CANCELLED') {
          cleanup();
          reject(new Error(`${error.code}: ${error.message}`));
        }
      });
      trigger();
    });

  beforeAll(async () => {
    app = await createTestApp();
    await app.get(IngestionService).ingestDirectory(KNOWLEDGE_BASE_DIR);
    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    url = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    for (const client of clients) client.disconnect();
    await app?.close();
  });

  it('runs a text turn: transcript, trace events, ordered audio clips and completion', async () => {
    const client = await connect();
    const ready = await startSession(client);
    expect(ready.conversationId).toMatch(/[0-9a-f-]{36}/u);
    expect(ready.provider).toBe('mock');

    const { events, completed } = await recordTurn(client, () =>
      client.emit(ClientEvents.TextSubmit, { text: 'How many PTO days do I have left this year?' }),
    );
    const names = events.map((e) => e.event);
    expect(names[0]).toBe(ServerEvents.TranscriptUser);
    expect(names).toContain(ServerEvents.AgentToolCall);
    expect(names).toContain(ServerEvents.AgentRetrievalEvaluated);
    expect(names.filter((n) => n === ServerEvents.AgentToolResult).length).toBeGreaterThanOrEqual(
      3,
    );

    const audio = events
      .filter((e) => e.event === ServerEvents.AgentAudio)
      .map((e) => e.payload as { seq: number; mimeType: string; data: ArrayBuffer | Buffer });
    expect(audio.length).toBeGreaterThan(0);
    expect(audio.map((a) => a.seq)).toEqual(audio.map((_, i) => i));
    expect(audio[0]?.mimeType).toBe('audio/wav');
    expect(
      Buffer.from(audio[0]!.data as ArrayBuffer)
        .subarray(0, 4)
        .toString(),
    ).toBe('RIFF');

    expect(completed.conversationId).toBe(ready.conversationId);
    expect(completed.assistantMessage.content).toMatch(/PTO days left/u);
    expect(completed.assistantMessage.metrics?.firstAudioMs).not.toBeNull();
    const states = events
      .filter((e) => e.event === ServerEvents.TurnState)
      .map((e) => (e.payload as { state: string }).state);
    expect(states).toEqual(expect.arrayContaining(['thinking', 'executing_tools', 'speaking']));
  });

  it('runs an audio turn through the (mock) recogniser and resets the conversation', async () => {
    const client = await connect();
    const ready = await startSession(client);
    const { events, completed } = await recordTurn(client, () =>
      client.emit(ClientEvents.AudioSubmit, {
        audio: Buffer.alloc(4_000),
        mimeType: 'audio/wav',
        sampleRate: 16_000,
      }),
    );
    const transcript = events.find((e) => e.event === ServerEvents.TranscriptUser)?.payload as {
      text: string;
      sttMs: number;
    };
    expect(MOCK_UTTERANCES).toContain(transcript.text);
    expect(transcript.sttMs).toBeGreaterThanOrEqual(0);
    expect(completed.userMessage.content).toBe(transcript.text);
    expect(events[0]).toMatchObject({
      event: ServerEvents.TurnState,
      payload: expect.objectContaining({ state: 'transcribing' }),
    });

    const next = await new Promise<SessionReadyPayload>((resolve) =>
      client.emit(ClientEvents.ConversationReset, resolve),
    );
    expect(next.conversationId).not.toBe(ready.conversationId);
  });

  it('rejects turns without a session and invalid payloads', async () => {
    const client = await connect();
    const error = await new Promise<{ code: string }>((resolve) => {
      client.once(ServerEvents.TurnError, resolve);
      client.emit(ClientEvents.TextSubmit, { text: 'hello' });
    });
    expect(error.code).toBe('NO_SESSION');
    await startSession(client);
    const invalid = await new Promise<{ code: string }>((resolve) => {
      client.once(ServerEvents.TurnError, resolve);
      client.emit(ClientEvents.AudioSubmit, { mimeType: 'audio/wav' } as never);
    });
    expect(invalid.code).toBe('INVALID_PAYLOAD');
  });
});
