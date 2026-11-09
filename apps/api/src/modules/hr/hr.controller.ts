import { Body, Controller, Get, NotFoundException, Param, Patch, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';
import {
  EmployeeListResponseDto,
  LeaveBalanceDto,
  SupportTicketDto,
  TicketListResponseDto,
  TicketQueryDto,
  UpdateTicketStatusRequestDto,
} from './hr.dto';
import { HrService } from './hr.service';
import { TicketRepository } from './ticket.repository';

@ApiTags('hr')
@Controller('hr')
export class HrController {
  constructor(
    private readonly hr: HrService,
    private readonly tickets: TicketRepository,
  ) {}

  @Get('employees')
  @ApiOperation({ summary: 'Demo employees with their leave balances (mock external HR system)' })
  @ApiOkResponse({ type: EmployeeListResponseDto })
  @ZodSerializerDto(EmployeeListResponseDto)
  async listEmployees(): Promise<EmployeeListResponseDto> {
    return { employees: await this.hr.listLeaveBalances() };
  }

  @Get('employees/:employeeId/leave-balance')
  @ApiOperation({ summary: 'Leave balance from the (mock) external HR system' })
  @ApiOkResponse({ type: LeaveBalanceDto })
  @ZodSerializerDto(LeaveBalanceDto)
  getLeaveBalance(@Param('employeeId') employeeId: string): Promise<LeaveBalanceDto> {
    return this.hr.getLeaveBalance(employeeId);
  }

  @Get('tickets')
  @ApiOperation({
    summary:
      'Support tickets created by the agent, optionally filtered by requester, status or reference',
  })
  @ApiOkResponse({ type: TicketListResponseDto })
  @ZodSerializerDto(TicketListResponseDto)
  async listTickets(@Query() query: TicketQueryDto): Promise<TicketListResponseDto> {
    return { tickets: await this.tickets.find(query) };
  }

  @Patch('tickets/:id/status')
  @ApiOperation({ summary: 'Move a ticket between open, in progress and resolved' })
  @ApiOkResponse({ type: SupportTicketDto })
  @ZodSerializerDto(SupportTicketDto)
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateTicketStatusRequestDto,
  ): Promise<SupportTicketDto> {
    const ticket = await this.tickets.updateStatus(id, body.status);
    if (!ticket) throw new NotFoundException(`Ticket ${id} not found`);
    return ticket;
  }
}
