'use client';

import type { SupportTicket, TicketStatus } from '@voice-agent/contracts';
import { TicketIcon } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

const STATUS_ITEMS: { value: TicketStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
];

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-state-speaking/15 text-state-speaking',
  high: 'bg-state-processing/20 text-state-processing',
  urgent: 'bg-state-error/15 text-state-error',
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function TicketTable({
  tickets,
  loading,
  onStatusChange,
}: {
  tickets: SupportTicket[];
  loading: boolean;
  onStatusChange: (ticket: SupportTicket, status: TicketStatus) => void;
}) {
  if (loading && !tickets.length) return <Skeleton className="h-32 w-full" />;
  if (!tickets.length) {
    return (
      <Empty className="py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TicketIcon />
          </EmptyMedia>
          <EmptyTitle>No tickets yet</EmptyTitle>
          <EmptyDescription>
            Tell the agent “My laptop screen is cracked”, then answer “Yes please, high priority”.
            The ticket it creates appears here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <Table data-testid="ticket-table">
      <TableHeader>
        <TableRow>
          <TableHead className="w-28">Reference</TableHead>
          <TableHead>Title</TableHead>
          <TableHead className="w-24">Priority</TableHead>
          <TableHead className="w-36">Status</TableHead>
          <TableHead className="w-24">Requester</TableHead>
          <TableHead className="w-40">Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tickets.map((ticket) => (
          <TableRow key={ticket.id}>
            <TableCell className="font-mono text-xs">{ticket.reference}</TableCell>
            <TableCell>
              <div className="line-clamp-1 text-sm font-medium">{ticket.title}</div>
              <div className="line-clamp-2 text-xs text-muted-foreground">{ticket.description}</div>
              {ticket.conversationId ? (
                <Link
                  href={`/conversations/${ticket.conversationId}`}
                  className="text-[11px] text-primary hover:underline"
                >
                  View conversation
                </Link>
              ) : null}
            </TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={cn('capitalize', PRIORITY_STYLES[ticket.priority])}
              >
                {ticket.priority}
              </Badge>
            </TableCell>
            <TableCell>
              <Select
                items={STATUS_ITEMS}
                value={ticket.status}
                onValueChange={(value) => value && onStatusChange(ticket, value as TicketStatus)}
              >
                <SelectTrigger
                  size="sm"
                  aria-label={`Status of ${ticket.reference}`}
                  className="w-32"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell className="font-mono text-xs">{ticket.requesterEmployeeId}</TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {formatDate(ticket.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
