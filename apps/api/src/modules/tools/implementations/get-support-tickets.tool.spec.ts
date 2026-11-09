import { DEFAULT_PERSONA, type SupportTicket, type TicketQuery } from '@voice-agent/contracts';
import { HttpTicketingClient, type TicketingClient } from '../../hr';
import { CitationRegistry, type ToolContext } from '../tool.port';
import { GetSupportTicketsTool } from './get-support-tickets.tool';

const ticket = (
  reference: string,
  status: SupportTicket['status'],
  priority: SupportTicket['priority'] = 'high',
): SupportTicket => ({
  id: `id-${reference}`,
  reference,
  conversationId: null,
  requesterEmployeeId: DEFAULT_PERSONA.employeeId,
  title: `Ticket ${reference}`,
  description: 'desc',
  priority,
  status,
  createdAt: new Date('2026-11-10T10:00:00Z').toISOString(),
});

const context = (): ToolContext => ({
  turnId: 't',
  conversationId: 'c',
  userContext: DEFAULT_PERSONA,
  citations: new CitationRegistry(),
  signal: new AbortController().signal,
});

describe('GetSupportTicketsTool', () => {
  it('queries the ticketing client for the current user and summarises by status', async () => {
    const listTickets = jest.fn(async () => [
      ticket('TCK-AAA111', 'open'),
      ticket('TCK-BBB222', 'resolved', 'low'),
    ]);
    const client: TicketingClient = { kind: 'http', listTickets };
    const tool = new GetSupportTicketsTool(client);
    const result = await tool.execute({ status: 'all', limit: 10 }, context());
    expect(listTickets).toHaveBeenCalledWith(
      { requesterEmployeeId: 'E-1042', status: undefined, reference: undefined, limit: 10 },
      expect.any(AbortSignal),
    );
    expect(result.summary).toBe('2 tickets for Alice Nguyen (1 open, 1 resolved)');
    expect(result.data).toMatchObject({ count: 2, source: 'ticketing-api' });
    expect(result.data.tickets).toHaveLength(2);
    expect(result.data.tickets[0]).toMatchObject({
      reference: 'TCK-AAA111',
      status: 'open',
      priority: 'high',
    });
  });

  it('passes status and upper-cased reference filters through', async () => {
    const listTickets = jest.fn(
      async (_query: Partial<TicketQuery>, _signal?: AbortSignal): Promise<SupportTicket[]> => [],
    );
    const tool = new GetSupportTicketsTool({ kind: 'inprocess', listTickets });
    const result = await tool.execute(
      { status: 'open', reference: 'tck-abc123', limit: 5 },
      context(),
    );
    expect(listTickets.mock.calls[0]?.[0]).toMatchObject({
      status: 'open',
      reference: 'TCK-ABC123',
      limit: 5,
    });
    expect(result.summary).toBe('No tickets found for Alice Nguyen matching TCK-ABC123');
  });
});

describe('HttpTicketingClient', () => {
  it('builds the query string and parses the response', async () => {
    const fetchImpl = jest.fn(async (input: string | URL | Request) => {
      expect(String(input)).toBe(
        'http://ticketing.local/api/hr/tickets?requesterEmployeeId=E-1042&status=open&limit=3',
      );
      return new Response(JSON.stringify({ tickets: [ticket('TCK-C0FFEE', 'open')] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const client = new HttpTicketingClient(
      'http://ticketing.local/api/hr/',
      fetchImpl as unknown as typeof fetch,
    );
    const tickets = await client.listTickets({
      requesterEmployeeId: 'E-1042',
      status: 'open',
      limit: 3,
    });
    expect(tickets).toHaveLength(1);
    expect(tickets[0]?.reference).toBe('TCK-C0FFEE');
  });

  it('throws on non-2xx responses', async () => {
    const client = new HttpTicketingClient(
      'http://ticketing.local',
      (async () => new Response('nope', { status: 503 })) as unknown as typeof fetch,
    );
    await expect(client.listTickets({})).rejects.toThrow(/503/u);
  });
});
