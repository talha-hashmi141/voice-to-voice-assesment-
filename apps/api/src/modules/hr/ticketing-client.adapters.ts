import {
  type SupportTicket,
  type TicketListResponse,
  type TicketQuery,
} from '@voice-agent/contracts';
import { TicketRepository } from './ticket.repository';
import { type TicketingClient } from './ticketing-client.port';

/** Calls the ticketing REST API over HTTP (GET {baseUrl}/tickets?requesterEmployeeId=…&status=…). */
export class HttpTicketingClient implements TicketingClient {
  readonly kind = 'http' as const;

  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async listTickets(query: Partial<TicketQuery>, signal?: AbortSignal): Promise<SupportTicket[]> {
    const url = new URL(`${this.baseUrl.replace(/\/$/u, '')}/tickets`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '')
        url.searchParams.set(key, String(value));
    }
    const response = await this.fetchImpl(url, { headers: { accept: 'application/json' }, signal });
    if (!response.ok) throw new Error(`Ticketing API responded with ${response.status}`);
    const body = (await response.json()) as TicketListResponse;
    return body.tickets;
  }
}

/** Same contract without HTTP – used in automated tests and when TICKETING_API_URL=inprocess. */
export class InProcessTicketingClient implements TicketingClient {
  readonly kind = 'inprocess' as const;

  constructor(private readonly tickets: TicketRepository) {}

  listTickets(query: Partial<TicketQuery>): Promise<SupportTicket[]> {
    return this.tickets.find(query);
  }
}
