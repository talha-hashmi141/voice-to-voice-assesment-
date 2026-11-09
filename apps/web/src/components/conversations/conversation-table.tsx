'use client';

import type { Conversation } from '@voice-agent/contracts';
import { MessageSquareIcon, Trash2Icon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const formatDate = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function ConversationTable({ conversations, loading, onDelete }: { conversations: Conversation[]; loading: boolean; onDelete: (id: string) => void }) {
  if (loading && !conversations.length) return <Skeleton className="h-48 w-full" />;
  if (!conversations.length) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessageSquareIcon />
          </EmptyMedia>
          <EmptyTitle>No conversations yet</EmptyTitle>
          <EmptyDescription>Talk to the voice agent and your sessions will show up here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Conversation</TableHead>
          <TableHead>Persona</TableHead>
          <TableHead className="text-right">Messages</TableHead>
          <TableHead>Last activity</TableHead>
          <TableHead className="w-24" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {conversations.map((conversation) => (
          <TableRow key={conversation.id}>
            <TableCell className="max-w-md">
              <Link href={`/conversations/${conversation.id}`} className="line-clamp-1 font-medium hover:underline">
                {conversation.title ?? 'Untitled conversation'}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">{conversation.userContext?.name ?? '–'}</TableCell>
            <TableCell className="text-right tabular-nums">{conversation.messageCount}</TableCell>
            <TableCell className="text-muted-foreground">{formatDate(conversation.updatedAt)}</TableCell>
            <TableCell className="text-right">
              <Button size="icon-sm" variant="ghost" aria-label="Delete conversation" onClick={() => onDelete(conversation.id)}>
                <Trash2Icon className="size-3.5" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
