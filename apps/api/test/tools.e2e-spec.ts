import { type INestApplication } from '@nestjs/common';
import {
  type EmployeeListResponse,
  type ToolListResponse,
  type ToolUsageResponse,
  type TurnResponse,
} from '@voice-agent/contracts';
import request from 'supertest';
import { IngestionService, KNOWLEDGE_BASE_DIR } from '../src/modules/knowledge';
import { createTestApp } from './utils/create-app';

describe('Tools & HR API (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
    await app.get(IngestionService).ingestDirectory(KNOWLEDGE_BASE_DIR);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/tools lists the seven tools with argument schemas and side-effect flags', async () => {
    const body = (await http().get('/api/tools').expect(200)).body as ToolListResponse;
    expect(body.tools.map((t) => t.name).sort()).toEqual([
      'calculate',
      'count_business_days',
      'create_support_ticket',
      'get_current_datetime',
      'get_leave_balance',
      'get_support_tickets',
      'search_knowledge_base',
    ]);
    expect(body.tools.filter((t) => t.mutating).map((t) => t.name)).toEqual([
      'create_support_ticket',
    ]);
    const search = body.tools.find((t) => t.name === 'search_knowledge_base')!;
    expect(search.parameters).toMatchObject({ type: 'object', required: ['queries'] });
  });

  it('GET /api/tools/usage aggregates tool results from stored traces', async () => {
    await http()
      .post('/api/agent/turn')
      .send({ text: 'How many PTO days do I have left this year?' })
      .expect(200);
    const body = (await http().get('/api/tools/usage').expect(200)).body as ToolUsageResponse;
    const names = body.usage.map((u) => u.name);
    expect(names).toEqual(expect.arrayContaining(['search_knowledge_base', 'get_leave_balance']));
    expect(body.usage.every((u) => u.calls >= 1)).toBe(true);
    expect(body.recent[0]).toMatchObject({ ok: true });
    expect(body.recent[0]?.at).toMatch(/^\d{4}-/u);
  });

  it('GET /api/hr/employees returns every demo persona with balances', async () => {
    const body = (await http().get('/api/hr/employees').expect(200)).body as EmployeeListResponse;
    expect(body.employees.map((e) => e.employeeId).sort()).toEqual(['E-1042', 'E-2077', 'E-3311']);
    expect(body.employees[0]!.ptoRemainingDays).toBe(
      body.employees[0]!.ptoTotalDays - body.employees[0]!.ptoUsedDays,
    );
  });

  it('PATCH /api/hr/tickets/:id/status moves a ticket the agent created', async () => {
    const first = (
      await http()
        .post('/api/agent/turn')
        .send({ text: 'My laptop screen is cracked, what should I do?' })
        .expect(200)
    ).body as TurnResponse;
    await http()
      .post('/api/agent/turn')
      .send({ conversationId: first.conversationId, text: 'Yes please, high priority' })
      .expect(200);
    const { tickets } = (await http().get('/api/hr/tickets').expect(200)).body as {
      tickets: { id: string; status: string }[];
    };
    expect(tickets.length).toBeGreaterThan(0);
    const updated = await http()
      .patch(`/api/hr/tickets/${tickets[0]!.id}/status`)
      .send({ status: 'resolved' })
      .expect(200);
    expect(updated.body.status).toBe('resolved');
    await http()
      .patch(`/api/hr/tickets/${tickets[0]!.id}/status`)
      .send({ status: 'nope' })
      .expect(400);
    await http()
      .patch('/api/hr/tickets/00000000-0000-0000-0000-000000000000/status')
      .send({ status: 'open' })
      .expect(404);
  });

  it('GET /api/hr/tickets filters by requester, status and reference', async () => {
    const all = (await http().get('/api/hr/tickets').expect(200)).body as {
      tickets: { reference: string; requesterEmployeeId: string }[];
    };
    const sample = all.tickets[0]!;
    const byRef = (
      await http().get(`/api/hr/tickets?reference=${sample.reference.toLowerCase()}`).expect(200)
    ).body as {
      tickets: unknown[];
    };
    expect(byRef.tickets).toHaveLength(1);
    const byRequester = (
      await http()
        .get(`/api/hr/tickets?requesterEmployeeId=${sample.requesterEmployeeId}&status=resolved`)
        .expect(200)
    ).body as { tickets: { status: string }[] };
    expect(byRequester.tickets.every((t) => t.status === 'resolved')).toBe(true);
    await http().get('/api/hr/tickets?status=bogus').expect(400);
  });

  it("the agent answers questions about the user's own tickets through get_support_tickets", async () => {
    const body = (
      await http()
        .post('/api/agent/turn')
        .send({ text: 'What is the status of my tickets?' })
        .expect(200)
    ).body as TurnResponse;
    const tools = body.assistantMessage.steps
      .filter((s) => s.type === 'tool_call')
      .map((s) => s.data?.name);
    expect(tools).toContain('get_support_tickets');
    expect(body.assistantMessage.content).toMatch(/TCK-[A-Z0-9]{6}/u);
  });
});
