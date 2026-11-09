import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import { LeaveBalanceDto, TicketListResponseDto } from './hr.dto';
import { HrService } from './hr.service';
import { TicketRepository } from './ticket.repository';

@ApiTags('hr')
@Controller('hr')
export class HrController {
  constructor(
    private readonly hr: HrService,
    private readonly tickets: TicketRepository,
  ) {}

  @Get('employees/:employeeId/leave-balance')
  @ApiOperation({ summary: 'Leave balance from the (mock) external HR system' })
  @ApiOkResponse({ type: LeaveBalanceDto })
  @ZodSerializerDto(LeaveBalanceDto)
  getLeaveBalance(@Param('employeeId') employeeId: string): Promise<LeaveBalanceDto> {
    return this.hr.getLeaveBalance(employeeId);
  }

  @Get('tickets')
  @ApiOperation({ summary: 'Support tickets created by the agent' })
  @ApiOkResponse({ type: TicketListResponseDto })
  @ZodSerializerDto(TicketListResponseDto)
  async listTickets(): Promise<TicketListResponseDto> {
    return { tickets: await this.tickets.findRecent() };
  }
}
