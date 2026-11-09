'use client';

import type { Message, Source } from '@voice-agent/contracts';
import { MicIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { MessageBubble } from './message-bubble';

export interface TranscriptListProps {
  messages: Message[];
  streamingText?: string | null;
  onCite?: (source: Source) => void;
  emptyHint?: string;
}

export function TranscriptList({
  messages,
  streamingText,
  onCite,
  emptyHint,
}: TranscriptListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages.length, streamingText]);

  if (!messages.length && !streamingText) {
    return (
      <Empty className="h-full border-none">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MicIcon />
          </EmptyMedia>
          <EmptyTitle>Say something</EmptyTitle>
          <EmptyDescription>
            {emptyHint ??
              'Try: “How many vacation days do new employees get?”, “My laptop screen is cracked”, or “Can I bring my dog to the office?”'}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div
      className="flex flex-col gap-4 px-4 py-4 md:px-6"
      role="log"
      aria-live="polite"
      aria-label="Conversation transcript"
    >
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} onCite={onCite} />
      ))}
      {streamingText ? (
        <MessageBubble
          message={{ role: 'assistant', content: streamingText, sources: [] }}
          streaming
          onCite={onCite}
        />
      ) : null}
      <div ref={endRef} />
    </div>
  );
}
