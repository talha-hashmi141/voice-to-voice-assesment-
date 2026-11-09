'use client';

import type { TurnMetrics } from '@voice-agent/contracts';
import {
  ActivityIcon,
  CalculatorIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  SearchIcon,
  TicketIcon,
  WalletIcon,
  XCircleIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { type TraceEntry } from '@/features/voice-session';
import { cn } from '@/lib/utils';
import { LatencyBadges } from '../voice/latency-badges';

const ICONS: Record<string, typeof SearchIcon> = {
  search_knowledge_base: SearchIcon,
  get_current_datetime: CalendarClockIcon,
  count_business_days: CalendarClockIcon,
  calculate: CalculatorIcon,
  get_leave_balance: WalletIcon,
  create_support_ticket: TicketIcon,
};

const ASSESSMENT_STYLES: Record<string, string> = {
  strong: 'bg-state-listening/15 text-state-listening',
  weak: 'bg-state-processing/20 text-state-processing',
  none: 'bg-state-error/15 text-state-error',
};

function TraceRow({ entry }: { entry: TraceEntry }) {
  const [open, setOpen] = useState(false);
  const Icon =
    entry.kind === 'retrieval'
      ? ActivityIcon
      : entry.kind === 'state'
        ? CheckCircle2Icon
        : (ICONS[entry.name ?? ''] ?? ActivityIcon);
  const hasData = entry.data && Object.keys(entry.data).length > 0;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-lg border bg-card/60 text-xs"
    >
      <CollapsibleTrigger
        disabled={!hasData}
        className={cn(
          'flex w-full items-start gap-2 px-2.5 py-2 text-left',
          hasData && 'cursor-pointer hover:bg-muted/60',
        )}
      >
        <span
          className={cn(
            'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md',
            entry.kind === 'tool_call' && 'bg-state-processing/20 text-state-processing',
            entry.kind === 'tool_result' &&
              (entry.ok === false
                ? 'bg-state-error/15 text-state-error'
                : 'bg-state-listening/15 text-state-listening'),
            entry.kind === 'retrieval' && ASSESSMENT_STYLES[entry.assessment ?? 'weak'],
            entry.kind === 'state' && 'bg-state-speaking/15 text-state-speaking',
          )}
        >
          {entry.kind === 'tool_result' && entry.ok === false ? (
            <XCircleIcon className="size-3" />
          ) : (
            <Icon className="size-3" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{entry.label}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="tabular-nums">+{(entry.at / 1000).toFixed(2)}s</span>
            {entry.durationMs !== undefined ? (
              <span className="tabular-nums">· {entry.durationMs} ms</span>
            ) : null}
            {entry.kind === 'retrieval' && entry.assessment ? (
              <Badge
                variant="outline"
                className={cn(
                  'h-4 px-1 text-[10px] capitalize',
                  ASSESSMENT_STYLES[entry.assessment],
                )}
              >
                {entry.assessment}
              </Badge>
            ) : null}
          </span>
        </span>
        {hasData ? (
          <ChevronDownIcon
            className={cn(
              'mt-1 size-3 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
        ) : null}
      </CollapsibleTrigger>
      {hasData ? (
        <CollapsibleContent>
          <pre className="max-h-48 overflow-auto border-t bg-muted/40 px-2.5 py-2 font-mono text-[10px] leading-snug whitespace-pre-wrap">
            {JSON.stringify(entry.data, null, 2)}
          </pre>
        </CollapsibleContent>
      ) : null}
    </Collapsible>
  );
}

export interface AgentTracePanelProps {
  trace: TraceEntry[];
  metrics: TurnMetrics | null;
  phase: string;
}

/** Live view of what the agent is doing: tool calls, results, retrieval grading, timings. */
export function AgentTracePanel({ trace, metrics, phase }: AgentTracePanelProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Agent trace</h2>
          <p className="text-xs text-muted-foreground">
            Tools, retrieval grading and latency for the current turn
          </p>
        </div>
        <Badge variant="secondary" className="capitalize">
          {phase.replace('_', ' ')}
        </Badge>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {trace.length ? (
          <ol className="flex flex-col gap-2">
            {trace.map((entry) => (
              <li key={entry.id}>
                <TraceRow entry={entry} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            The trace appears here while the agent works: which tools it calls, how it grades what
            it retrieved, and how long each stage took.
          </p>
        )}
      </div>
      <div className="border-t px-4 py-3">
        <LatencyBadges metrics={metrics} />
      </div>
    </div>
  );
}
