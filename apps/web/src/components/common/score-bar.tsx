import { cn } from '@/lib/utils';

/** Horizontal score bar in [0, 1] with a label – used for retrieval scores. */
export function ScoreBar({ label, value, className }: { label: string; value: number | null; className?: string }) {
  const pct = value === null ? 0 : Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className={cn('flex items-center gap-2 text-xs', className)}>
      <span className="w-12 shrink-0 text-muted-foreground">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary/70 transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right tabular-nums">{value === null ? '–' : value.toFixed(2)}</span>
    </div>
  );
}
