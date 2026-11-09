import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from '../common';

export const TicketPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
export type TicketPriority = z.infer<typeof TicketPrioritySchema>;

export const TicketStatusSchema = z.enum(['open', 'in_progress', 'resolved']);
export type TicketStatus = z.infer<typeof TicketStatusSchema>;

export const SupportTicketSchema = z.object({
  id: IdSchema,
  reference: z.string(),
  conversationId: IdSchema.nullable(),
  requesterEmployeeId: z.string(),
  title: z.string(),
  description: z.string(),
  priority: TicketPrioritySchema,
  status: TicketStatusSchema,
  createdAt: IsoDateTimeSchema,
});
export type SupportTicket = z.infer<typeof SupportTicketSchema>;

export const LeaveBalanceSchema = z.object({
  employeeId: z.string(),
  name: z.string(),
  department: z.string(),
  ptoTotalDays: z.number(),
  ptoUsedDays: z.number(),
  ptoRemainingDays: z.number(),
  sickTotalDays: z.number(),
  sickUsedDays: z.number(),
  sickRemainingDays: z.number(),
  asOf: IsoDateTimeSchema,
});
export type LeaveBalance = z.infer<typeof LeaveBalanceSchema>;

export const TicketListResponseSchema = z.object({
  tickets: z.array(SupportTicketSchema),
});
export type TicketListResponse = z.infer<typeof TicketListResponseSchema>;

export const UpdateTicketStatusRequestSchema = z.object({
  status: TicketStatusSchema,
});
export type UpdateTicketStatusRequest = z.infer<typeof UpdateTicketStatusRequestSchema>;

export const EmployeeListResponseSchema = z.object({
  employees: z.array(LeaveBalanceSchema),
});
export type EmployeeListResponse = z.infer<typeof EmployeeListResponseSchema>;

/** Query parameters of GET /hr/tickets. */
export const TicketQuerySchema = z.object({
  requesterEmployeeId: z.string().trim().min(1).optional(),
  status: TicketStatusSchema.optional(),
  reference: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type TicketQuery = z.infer<typeof TicketQuerySchema>;
