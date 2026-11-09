import { Inject, Injectable } from '@nestjs/common';
import {
  type GetSupportTicketsArgs,
  GetSupportTicketsArgsSchema,
  type SupportTicket,
} from '@voice-agent/contracts';
import { TICKETING_CLIENT, type TicketingClient } from '../../hr';
import { type Tool, type ToolContext, type ToolResult } from '../tool.port';

export interface SupportTicketsData {
  requester: string;
  filter: { status: GetSupportTicketsArgs['status']; reference?: string };
  count: number;
  tickets: Pick<
    SupportTicket,
    'reference' | 'title' | 'description' | 'priority' | 'status' | 'createdAt'
  >[];
  source: 'ticketing-api' | 'in-process';
}

const STATUS_LABEL: Record<SupportTicket['status'], string> = {
  open: 'open',
  in_progress: 'in progress',
  resolved: 'resolved',
};

/** Looks up the current user's tickets through the ticketing API (an HTTP call in normal operation). */
@Injectable()
export class GetSupportTicketsTool implements Tool<GetSupportTicketsArgs, SupportTicketsData> {
  readonly name = 'get_support_tickets' as const;
  readonly description =
    "Look up the current user's support tickets in the ticketing system: their status (open, in progress, resolved), " +
    'priority, title and when they were opened. Use it whenever the user asks about a ticket they raised, a TCK reference, ' +
    'or whether something was already reported. It already knows who the user is.';
  readonly schema = GetSupportTicketsArgsSchema;
  readonly timeoutMs = 8_000;
  readonly mutating = false;

  constructor(@Inject(TICKETING_CLIENT) private readonly ticketing: TicketingClient) {}

  async execute(
    args: GetSupportTicketsArgs,
    context: ToolContext,
  ): Promise<ToolResult<SupportTicketsData>> {
    const tickets = await this.ticketing.listTickets(
      {
        requesterEmployeeId: context.userContext.employeeId,
        status: args.status === 'all' ? undefined : args.status,
        reference: args.reference?.toUpperCase(),
        limit: args.limit,
      },
      context.signal,
    );
    const data: SupportTicketsData = {
      requester: context.userContext.employeeId,
      filter: {
        status: args.status,
        ...(args.reference ? { reference: args.reference.toUpperCase() } : {}),
      },
      count: tickets.length,
      tickets: tickets.map(({ reference, title, description, priority, status, createdAt }) => ({
        reference,
        title,
        description,
        priority,
        status,
        createdAt,
      })),
      source: this.ticketing.kind === 'http' ? 'ticketing-api' : 'in-process',
    };
    const byStatus = Object.entries(
      tickets.reduce<Record<string, number>>(
        (acc, t) => ({ ...acc, [STATUS_LABEL[t.status]]: (acc[STATUS_LABEL[t.status]] ?? 0) + 1 }),
        {},
      ),
    )
      .map(([label, n]) => `${n} ${label}`)
      .join(', ');
    return {
      data,
      summary: tickets.length
        ? `${tickets.length} ticket${tickets.length === 1 ? '' : 's'} for ${context.userContext.name} (${byStatus})`
        : `No tickets found for ${context.userContext.name}${args.reference ? ` matching ${args.reference.toUpperCase()}` : ''}`,
    };
  }
}
