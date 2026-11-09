'use client';

import type { LeaveBalance } from '@voice-agent/contracts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function Meter({ label, used, total }: { label: string; used: number; total: number }) {
  const remaining = total - used;
  return (
    <div className="text-xs">
      <div className="mb-0.5 flex justify-between">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          <span className="font-medium">{remaining}</span> of {total} left
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-state-listening/80"
          style={{ width: `${Math.round((remaining / total) * 100)}%` }}
        />
      </div>
    </div>
  );
}

export function EmployeeCards({
  employees,
  loading,
}: {
  employees: LeaveBalance[];
  loading: boolean;
}) {
  if (loading && !employees.length) return <Skeleton className="h-28 w-full" />;
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {employees.map((employee) => (
        <Card key={employee.employeeId} className="gap-2">
          <CardHeader>
            <CardTitle className="text-sm">{employee.name}</CardTitle>
            <CardDescription className="text-xs">
              {employee.department} · <span className="font-mono">{employee.employeeId}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Meter label="PTO days" used={employee.ptoUsedDays} total={employee.ptoTotalDays} />
            <Meter label="Sick days" used={employee.sickUsedDays} total={employee.sickTotalDays} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
