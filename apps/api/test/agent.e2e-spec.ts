import { type INestApplication } from '@nestjs/common';
import { type ConversationDetail, type ConversationListResponse, DEMO_PERSONAS, type TurnResponse } from '@voice-agent/contracts';
import request from 'supertest';
import { IngestionService, KNOWLEDGE_BASE_DIR } from '../src/modules/knowledge';
import { createTestApp } from './utils/create-app';

/**
 * End-to-end agent behaviour in mock mode (deterministic LLM + hashing embeddings):
 * multi-step tool use, grounding with citations, memory across turns, abstention and
 * a confirmed side-effecting action.
 */
describe('Agent API (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
    await app.get(IngestionService).ingestDirectory(KNOWLEDGE_BASE_DIR);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('answers a policy question with cited sources after a multi-tool step', async () => {
    const response = await http()
      .post('/api/agent/turn')
      .send({ text: 'How many PTO days do I have left this year, and can I carry unused days over?' })
      .expect(200);
    const body = response.body as TurnResponse;
    const answer = body.assistantMessage;

    expect(body.conversationId).toMatch(/[0-9a-f-]{36}/u);
    expect(answer.sources.length).toBeGreaterThan(0);
    expect(answer.content).toMatch(/\[1\]/u);
    expect(answer.content).toMatch(/PTO days left/u);
    const toolNames = answer.steps.filter((s) => s.type === 'tool_call').map((s) => s.data?.name);
    expect(toolNames).toEqual(expect.arrayContaining(['search_knowledge_base', 'get_leave_balance', 'get_current_datetime']));
    expect(answer.steps.some((s) => s.type === 'retrieval_evaluated')).toBe(true);
    expect(answer.metrics).toMatchObject({ llmCalls: 2, toolCalls: 3 });
  });

  it('keeps conversation context and performs a confirmed side-effecting action', async () => {
    const first = (await http().post('/api/agent/turn').send({ text: 'My laptop screen is cracked, what should I do?' }).expect(200)).body as TurnResponse;
    expect(first.assistantMessage.content).toMatch(/open a support ticket/u);

    const second = (
      await http().post('/api/agent/turn').send({ conversationId: first.conversationId, text: 'Yes please, high priority' }).expect(200)
    ).body as TurnResponse;
    expect(second.assistantMessage.content).toMatch(/ticket TCK-[A-Z0-9]{6}/u);
    expect(second.assistantMessage.steps.map((s) => s.type)).toContain('tool_call');

    const tickets = (await http().get('/api/hr/tickets').expect(200)).body as { tickets: { priority: string; conversationId: string }[] };
    expect(tickets.tickets[0]).toMatchObject({ priority: 'high', conversationId: first.conversationId });

    const detail = (await http().get(`/api/conversations/${first.conversationId}`).expect(200)).body as ConversationDetail;
    expect(detail.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
    expect(detail.title).toMatch(/laptop screen/u);
  });

  it('declines to invent policies when the knowledge base has nothing relevant', async () => {
    const body = (await http().post('/api/agent/turn').send({ text: 'What is the policy on bringing dogs to the office?' }).expect(200)).body as TurnResponse;
    expect(body.assistantMessage.content).toMatch(/couldn't find anything|closest information/u);
  });

  it('uses the selected persona for identity-dependent tools', async () => {
    const bob = DEMO_PERSONAS[1]!;
    const body = (await http().post('/api/agent/turn').send({ text: 'How much vacation do I have left?', userContext: bob }).expect(200)).body as TurnResponse;
    expect(body.assistantMessage.content).toMatch(/7 of your 25 PTO days/u);
    const list = (await http().get('/api/conversations').expect(200)).body as ConversationListResponse;
    expect(list.conversations.find((c) => c.id === body.conversationId)?.userContext?.employeeId).toBe(bob.employeeId);
  });

  it('validates the request body', async () => {
    const response = await http().post('/api/agent/turn').send({ text: '' }).expect(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });
});
