import { Injectable } from '@nestjs/common';
import {
  type GetLeaveBalanceArgs,
  GetLeaveBalanceArgsSchema,
  type LeaveBalance,
} from '@voice-agent/contracts';
import { HrService } from '../../hr';
import { type Tool, type ToolContext, type ToolResult } from '../tool.port';

@Injectable()
export class GetLeaveBalanceTool implements Tool<GetLeaveBalanceArgs, LeaveBalance> {
  readonly name = 'get_leave_balance' as const;
  readonly description =
    "Look up an employee's PTO and sick-leave balance in the HR system (total, used, remaining). Defaults to the current user; never ask the user for their employee id.";
  readonly schema = GetLeaveBalanceArgsSchema;
  readonly timeoutMs = 5_000;
  readonly mutating = false;

  constructor(private readonly hr: HrService) {}

  async execute(
    args: GetLeaveBalanceArgs,
    context: ToolContext,
  ): Promise<ToolResult<LeaveBalance>> {
    const employeeId = args.employeeId?.trim() || context.userContext.employeeId;
    const balance = await this.hr.getLeaveBalance(employeeId);
    return {
      data: balance,
      summary: `${balance.name}: ${balance.ptoRemainingDays} of ${balance.ptoTotalDays} PTO days left, ${balance.sickRemainingDays} sick days left`,
    };
  }
}
