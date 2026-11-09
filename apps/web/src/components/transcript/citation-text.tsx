'use client';

import type { Source } from '@voice-agent/contracts';
import { Fragment } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const MARKER = /\[(\d+(?:\s*,\s*\d+)*)\]/gu;

export interface CitationTextProps {
  text: string;
  sources: Source[];
  onCite?: (source: Source) => void;
}

/** Renders assistant text with [n] markers replaced by clickable citation chips. */
export function CitationText({ text, sources, onCite }: CitationTextProps) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(MARKER)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(<Fragment key={key++}>{text.slice(last, index)}</Fragment>);
    const numbers = match[1]!.split(',').map((n) => Number(n.trim()));
    parts.push(
      <span key={key++} className="inline-flex gap-0.5 align-baseline">
        {numbers.map((n) => {
          const source = sources.find((s) => s.index === n);
          const chip = (
            <button
              type="button"
              onClick={() => source && onCite?.(source)}
              className="inline-flex h-4 min-w-4 items-center justify-center rounded-sm bg-primary/10 px-1 font-mono text-[10px] font-semibold text-primary transition-colors hover:bg-primary/20"
              aria-label={source ? `Source ${n}: ${source.documentTitle}` : `Source ${n}`}
            >
              {n}
            </button>
          );
          return source ? (
            <Tooltip key={n}>
              <TooltipTrigger render={chip} />
              <TooltipContent>
                {source.documentTitle} · {source.sectionPath}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Fragment key={n}>{chip}</Fragment>
          );
        })}
      </span>,
    );
    last = index + match[0].length;
  }
  if (last < text.length) parts.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return <>{parts}</>;
}
