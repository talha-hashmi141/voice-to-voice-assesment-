'use client';

import type { ToolUsageResponse } from '@voice-agent/contracts';
import { CheckCircle2Icon, XCircleIcon } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { describeTool } from '@/features/voice-session';

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

export function ToolUsagePanel({
  data,
  loading,
}: {
  data: ToolUsageResponse | null;
  loading: boolean;
}) {
  if (loading && !data) return <Skeleton className="h-40 w-full" />;
  if (!data) return null;
  const max = Math.max(1, ...data.usage.map((u) => u.calls));
  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Calls per tool
        </h3>
        {data.usage.length ? (
          data.usage.map((u) => (
            <div key={u.name} className="text-xs">
              <div className="mb-0.5 flex items-center justify-between gap-2">
                <span className="truncate font-mono">{u.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {u.calls}
                  {u.failures ? (
                    <span className="text-state-error"> · {u.failures} failed</span>
                  ) : null}
                  {u.avgDurationMs !== null ? <span> · {u.avgDurationMs} ms</span> : null}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${Math.round((u.calls / max) * 100)}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">
            No tool calls recorded yet. Ask the agent something.
          </p>
        )}
      </div>
      <div>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Recent invocations
        </h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Time</TableHead>
              <TableHead>Tool</TableHead>
              <TableHead>Result</TableHead>
              <TableHead className="w-16 text-right">ms</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.recent.map((row) => (
              <TableRow key={`${row.messageId}-${row.name}-${row.at}-${row.label}`}>
                <TableCell className="text-xs text-muted-foreground tabular-nums">
                  {formatTime(row.at)}
                </TableCell>
                <TableCell className="text-xs">
                  <span className="font-medium">{describeTool(row.name)}</span>
                  <span className="block font-mono text-[10px] text-muted-foreground">
                    {row.name}
                  </span>
                </TableCell>
                <TableCell className="text-xs">
                  <Link
                    href={`/conversations/${row.conversationId}`}
                    className="flex items-start gap-1.5 hover:underline"
                  >
                    {row.ok === false ? (
                      <XCircleIcon className="mt-0.5 size-3.5 shrink-0 text-state-error" />
                    ) : (
                      <CheckCircle2Icon className="mt-0.5 size-3.5 shrink-0 text-state-listening" />
                    )}
                    <span className="line-clamp-2">{row.label}</span>
                  </Link>
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {row.durationMs ?? '–'}
                </TableCell>
              </TableRow>
            ))}
            {!data.recent.length ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-xs text-muted-foreground">
                  Nothing yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
