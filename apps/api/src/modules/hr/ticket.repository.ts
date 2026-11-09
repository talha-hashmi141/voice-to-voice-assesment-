import { Inject, Injectable } from '@nestjs/common';
import { type SupportTicket, type TicketPriority, type TicketQuery } from '@voice-agent/contracts';
import { and, desc, eq, type SQL } from 'drizzle-orm';
import {
  DATABASE,
  type Database,
  shortReference,
  supportTickets,
  type SupportTicketRow,
  toIso,
} from '../../common';

export interface CreateTicketInput {
  conversationId: string | null;
  requesterEmployeeId: string;
  title: string;
  description: string;
  priority: TicketPriority;
}

@Injectable()
export class TicketRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(input: CreateTicketInput): Promise<SupportTicket> {
    const [row] = await this.db
      .insert(supportTickets)
      .values({ ...input, reference: shortReference('TCK'), status: 'open' })
      .returning();
    return toTicket(row!);
  }

  async find(query: Partial<TicketQuery> = {}): Promise<SupportTicket[]> {
    const conditions: SQL[] = [];
    if (query.requesterEmployeeId)
      conditions.push(eq(supportTickets.requesterEmployeeId, query.requesterEmployeeId));
    if (query.status) conditions.push(eq(supportTickets.status, query.status));
    if (query.reference)
      conditions.push(eq(supportTickets.reference, query.reference.toUpperCase()));
    const rows = await this.db
      .select()
      .from(supportTickets)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(supportTickets.createdAt))
      .limit(query.limit ?? 50);
    return rows.map(toTicket);
  }

  async findRecent(limit = 50): Promise<SupportTicket[]> {
    const rows = await this.db
      .select()
      .from(supportTickets)
      .orderBy(desc(supportTickets.createdAt))
      .limit(limit);
    return rows.map(toTicket);
  }

  async updateStatus(id: string, status: SupportTicket['status']): Promise<SupportTicket | null> {
    const [row] = await this.db
      .update(supportTickets)
      .set({ status })
      .where(eq(supportTickets.id, id))
      .returning();
    return row ? toTicket(row) : null;
  }

  async findByReference(reference: string): Promise<SupportTicket | null> {
    const [row] = await this.db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.reference, reference))
      .limit(1);
    return row ? toTicket(row) : null;
  }
}

export const toTicket = (row: SupportTicketRow): SupportTicket => ({
  id: row.id,
  reference: row.reference,
  conversationId: row.conversationId,
  requesterEmployeeId: row.requesterEmployeeId,
  title: row.title,
  description: row.description,
  priority: row.priority as SupportTicket['priority'],
  status: row.status as SupportTicket['status'],
  createdAt: toIso(row.createdAt),
});
