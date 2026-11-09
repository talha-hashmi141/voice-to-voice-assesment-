import { LeaveBalanceSchema, TicketListResponseSchema } from '@voice-agent/contracts';
import { createZodDto } from 'nestjs-zod';

export class LeaveBalanceDto extends createZodDto(LeaveBalanceSchema) {}
export class TicketListResponseDto extends createZodDto(TicketListResponseSchema) {}
