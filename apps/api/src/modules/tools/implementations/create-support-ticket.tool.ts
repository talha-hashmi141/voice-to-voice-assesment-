import { Injectable } from '@nestjs/common';
import { type CreateSupportTicketArgs, CreateSupportTicketArgsSchema, type SupportTicket } from '@voice-agent/contracts';
import { TicketRepository } from '../../hr';
import { type Tool, type ToolContext, type ToolResult } from '../tool.port';

@Injectable()
export class CreateSupportTicketTool implements Tool<CreateSupportTicketArgs, SupportTicket> {
  readonly name = 'create_support_ticket' as const;
  readonly description =
    'Open an IT/HR support ticket on behalf of the user. This has side effects: summarise title, description and priority and get the user\'s explicit confirmation BEFORE calling it. Returns the ticket reference.';
  readonly schema = CreateSupportTicketArgsSchema;
  readonly timeoutMs = 5_000;
  readonly mutating = true;

  constructor(private readonly tickets: TicketRepository) {}

  async execute(args: CreateSupportTicketArgs, context: ToolContext): Promise<ToolResult<SupportTicket>> {
    const ticket = await this.tickets.create({
      conversationId: context.conversationId,
      requesterEmployeeId: context.userContext.employeeId,
      title: args.title,
      description: args.description,
      priority: args.priority,
    });
    return { data: ticket, summary: `Ticket ${ticket.reference} created (${ticket.priority} priority)` };
  }
}
