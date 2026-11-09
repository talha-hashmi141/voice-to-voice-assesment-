import { Injectable, NotFoundException } from '@nestjs/common';
import { type LeaveBalance } from '@voice-agent/contracts';

interface EmployeeRecord {
  employeeId: string;
  name: string;
  department: string;
  ptoTotalDays: number;
  ptoUsedDays: number;
  sickTotalDays: number;
  sickUsedDays: number;
}

/** Demo employees; balances line up with the DEMO_PERSONAS in @voice-agent/contracts. */
const EMPLOYEES: EmployeeRecord[] = [
  { employeeId: 'E-1042', name: 'Alice Nguyen', department: 'Engineering', ptoTotalDays: 20, ptoUsedDays: 9, sickTotalDays: 10, sickUsedDays: 2 },
  { employeeId: 'E-2077', name: 'Bob Okafor', department: 'Sales', ptoTotalDays: 25, ptoUsedDays: 18, sickTotalDays: 10, sickUsedDays: 0 },
  { employeeId: 'E-3311', name: 'Carla Mendes', department: 'People Operations', ptoTotalDays: 20, ptoUsedDays: 3, sickTotalDays: 10, sickUsedDays: 1 },
];

const SIMULATED_LATENCY_MS = 150;

/**
 * Stands in for an external HR system (think Workday) reached over the network. The small
 * artificial latency makes concurrent tool execution observable in the agent trace.
 */
@Injectable()
export class HrService {
  async getLeaveBalance(employeeId: string): Promise<LeaveBalance> {
    await new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS));
    const record = EMPLOYEES.find((employee) => employee.employeeId.toLowerCase() === employeeId.toLowerCase());
    if (!record) throw new NotFoundException(`No employee with id ${employeeId}`);
    return {
      employeeId: record.employeeId,
      name: record.name,
      department: record.department,
      ptoTotalDays: record.ptoTotalDays,
      ptoUsedDays: record.ptoUsedDays,
      ptoRemainingDays: record.ptoTotalDays - record.ptoUsedDays,
      sickTotalDays: record.sickTotalDays,
      sickUsedDays: record.sickUsedDays,
      sickRemainingDays: record.sickTotalDays - record.sickUsedDays,
      asOf: new Date().toISOString(),
    };
  }
}
