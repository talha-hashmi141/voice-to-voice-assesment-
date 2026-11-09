'use client';

import type { Source } from '@voice-agent/contracts';
import { ArrowLeftIcon, MicIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { PageHeader } from '@/components/common';
import { SourcesSheet, TranscriptList } from '@/components/transcript';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LatencyBadges } from '@/components/voice/latency-badges';
import { useConversation } from '@/features/conversations';

export function ConversationDetail({ id }: { id: string }) {
  const conversation = useConversation(id);
  const [sources, setSources] = useState<{ list: Source[]; focus: number } | null>(null);
  const detail = conversation.data;
  const lastAssistant = detail
    ? [...detail.messages].reverse().find((m) => m.role === 'assistant')
    : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={detail?.title ?? 'Conversation'}
        description={
          detail
            ? `${detail.userContext?.name ?? 'Unknown persona'} · ${detail.messages.length} messages`
            : undefined
        }
        actions={
          <>
            <Button size="sm" variant="ghost" render={<Link href="/conversations" />}>
              <ArrowLeftIcon className="size-3.5" />
              All conversations
            </Button>
            <Button size="sm" render={<Link href={`/?conversation=${id}`} />}>
              <MicIcon className="size-3.5" />
              Continue by voice
            </Button>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto">
        {conversation.loading && !detail ? (
          <div className="flex flex-col gap-3 p-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-2/3" />
            ))}
          </div>
        ) : null}
        {conversation.error ? (
          <p className="p-6 text-sm text-state-error">{conversation.error}</p>
        ) : null}
        {detail ? (
          <TranscriptList
            messages={detail.messages}
            onCite={(source) => {
              const owner = [...detail.messages]
                .reverse()
                .find((m) => m.sources.some((s) => s.chunkId === source.chunkId));
              setSources({ list: owner?.sources ?? [source], focus: source.index });
            }}
            emptyHint="This conversation has no messages."
          />
        ) : null}
      </div>
      {lastAssistant?.metrics ? (
        <div className="border-t px-4 py-3 md:px-6">
          <LatencyBadges metrics={lastAssistant.metrics} />
        </div>
      ) : null}
      <SourcesSheet
        sources={sources?.list ?? []}
        focusIndex={sources?.focus ?? null}
        open={!!sources}
        onOpenChange={(open) => !open && setSources(null)}
      />
    </div>
  );
}
