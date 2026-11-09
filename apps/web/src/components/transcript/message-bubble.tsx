'use client';

import type { Message, Source } from '@voice-agent/contracts';
import { BotIcon, UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CitationText } from './citation-text';

export interface MessageBubbleProps {
  message: Pick<Message, 'role' | 'content' | 'sources'> & { metrics?: Message['metrics'] };
  streaming?: boolean;
  onCite?: (source: Source) => void;
}

export function MessageBubble({ message, streaming, onCite }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')} data-role={message.role}>
      <div
        className={cn(
          'mt-1 flex size-7 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
        )}
        aria-hidden
      >
        {isUser ? <UserIcon className="size-3.5" /> : <BotIcon className="size-3.5" />}
      </div>
      <div
        className={cn(
          'max-w-[min(80%,42rem)] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser ? 'rounded-tr-sm bg-primary text-primary-foreground' : 'rounded-tl-sm bg-card text-card-foreground ring-1 ring-border',
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <p className="whitespace-pre-wrap">
            <CitationText text={message.content} sources={message.sources ?? []} onCite={onCite} />
            {streaming ? <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-foreground/60 align-text-bottom" /> : null}
          </p>
        )}
        {!isUser && message.sources?.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/60 pt-2">
            {message.sources.map((source) => (
              <button
                key={source.chunkId}
                type="button"
                onClick={() => onCite?.(source)}
                className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <span className="font-mono font-semibold text-primary">{source.index}</span>
                <span className="truncate">{source.documentTitle}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
