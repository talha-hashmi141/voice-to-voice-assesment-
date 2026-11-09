import { type SupportTicket, type TicketQuery } from '@voice-agent/contracts';

/**
 * Port used by the ticket-lookup tool. In production this would be an external ticketing system
 * (Jira, ServiceNow, Zendesk); here the HTTP adapter talks to this app's own /hr REST API and
 * the in-process adapter serves tests without a network hop.
 */
export interface TicketingClient {
  readonly kind: 'http' | 'inprocess';
  listTickets(query: Partial<TicketQuery>, signal?: AbortSignal): Promise<SupportTicket[]>;
}

export const TICKETING_CLIENT = Symbol('TICKETING_CLIENT');
