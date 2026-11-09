import {
  EmployeeListResponseSchema,
  LeaveBalanceSchema,
  SupportTicketSchema,
  TicketListResponseSchema,
  TicketQuerySchema,
  UpdateTicketStatusRequestSchema,
} from '@voice-agent/contracts';
import { createZodDto } from 'nestjs-zod';

export class LeaveBalanceDto extends createZodDto(LeaveBalanceSchema) {}
export class EmployeeListResponseDto extends createZodDto(EmployeeListResponseSchema) {}
export class TicketListResponseDto extends createZodDto(TicketListResponseSchema) {}
export class SupportTicketDto extends createZodDto(SupportTicketSchema) {}
export class UpdateTicketStatusRequestDto extends createZodDto(UpdateTicketStatusRequestSchema) {}
export class TicketQueryDto extends createZodDto(TicketQuerySchema) {}
