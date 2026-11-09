import type { TurnMetrics } from '@voice-agent/contracts';
import { GaugeIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const ITEMS: { key: keyof TurnMetrics; label: string; hint: string }[] = [
  { key: 'sttMs', label: 'STT', hint: 'Speech-to-text time for your utterance' },
  { key: 'firstTokenMs', label: '1st token', hint: 'Time until the model produced its first word' },
  { key: 'firstAudioMs', label: '1st audio', hint: 'Time until the first spoken clip was ready' },
  { key: 'totalMs', label: 'Total', hint: 'End-to-end turn time on the server' },
];

const format = (value: number | null) =>
  value === null ? '–' : value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${value}ms`;

export function LatencyBadges({
  metrics,
  className,
}: {
  metrics: TurnMetrics | null;
  className?: string;
}) {
  return (
    <div
      className={cn('flex flex-wrap items-center gap-1.5 text-[11px]', className)}
      aria-label="Latency of the last turn"
    >
      <GaugeIcon className="size-3.5 text-muted-foreground" aria-hidden />
      {ITEMS.map((item) => (
        <Tooltip key={item.key}>
          <TooltipTrigger
            render={
              <span className="inline-flex items-center gap-1 rounded-md border bg-card px-1.5 py-0.5 tabular-nums">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-medium">
                  {metrics ? format(metrics[item.key] as number | null) : '–'}
                </span>
              </span>
            }
          />
          <TooltipContent>{item.hint}</TooltipContent>
        </Tooltip>
      ))}
      {metrics?.estimatedCostUsd !== null && metrics?.estimatedCostUsd !== undefined ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="inline-flex items-center gap-1 rounded-md border bg-card px-1.5 py-0.5 tabular-nums">
                <span className="text-muted-foreground">cost</span>
                <span className="font-medium">≈ ${metrics.estimatedCostUsd.toFixed(4)}</span>
              </span>
            }
          />
          <TooltipContent>
            Estimated from list prices: {metrics.promptTokens ?? 0} prompt tokens (
            {metrics.cachedPromptTokens ?? 0} cached), {metrics.completionTokens ?? 0} completion
            tokens, plus audio minutes.
          </TooltipContent>
        </Tooltip>
      ) : null}
      {metrics ? (
        <span className="text-muted-foreground">
          · {metrics.llmCalls} model call{metrics.llmCalls === 1 ? '' : 's'}, {metrics.toolCalls}{' '}
          tool call{metrics.toolCalls === 1 ? '' : 's'}
        </span>
      ) : null}
    </div>
  );
}
