'use client';

import type { Source } from '@voice-agent/contracts';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export interface SourcesSheetProps {
  sources: Source[];
  open: boolean;
  focusIndex?: number | null;
  onOpenChange: (open: boolean) => void;
}

export function SourcesSheet({ sources, open, focusIndex, onOpenChange }: SourcesSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Sources</SheetTitle>
          <SheetDescription>Knowledge-base passages the answer was grounded in.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4 pb-6">
          {sources.map((source) => (
            <article
              key={source.chunkId}
              className={cn('rounded-lg border p-3 text-sm', focusIndex === source.index && 'border-primary ring-2 ring-primary/30')}
            >
              <header className="mb-1.5 flex items-center gap-2">
                <span className="inline-flex size-5 items-center justify-center rounded-sm bg-primary/10 font-mono text-xs font-semibold text-primary">
                  {source.index}
                </span>
                <span className="font-medium">{source.documentTitle}</span>
                <Badge variant="outline" className="ml-auto font-mono text-[10px]">
                  score {source.score.toFixed(2)}
                </Badge>
              </header>
              <p className="mb-2 text-xs text-muted-foreground">{source.sectionPath}</p>
              <p className="whitespace-pre-wrap leading-relaxed text-foreground/90">{source.excerpt}</p>
            </article>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
