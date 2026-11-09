'use client';

import type { SupportTicket, TicketStatus } from '@voice-agent/contracts';
import { RefreshCwIcon } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common';
import { Button } from '@/components/ui/button';
import { useEmployees, useTickets, useToolCatalog, useToolUsage } from '@/features/tools';
import { hrApi } from '@/lib/api';
import { EmployeeCards } from './employee-cards';
import { TicketTable } from './ticket-table';
import { ToolCatalog } from './tool-catalog';
import { ToolUsagePanel } from './tool-usage';

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

/** Visual view of what the agent can do and what it did: tool catalogue, usage, tickets, HR data. */
export function ToolsScreen() {
  const catalog = useToolCatalog();
  const usage = useToolUsage();
  const tickets = useTickets();
  const employees = useEmployees();

  const changeStatus = async (ticket: SupportTicket, status: TicketStatus) => {
    try {
      await hrApi.updateTicketStatus(ticket.id, status);
      toast.success(`${ticket.reference} marked ${status.replace('_', ' ')}`);
      tickets.reload();
    } catch {
      toast.error('Could not update the ticket');
    }
  };

  const reloadAll = () => {
    usage.reload();
    tickets.reload();
    employees.reload();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Tools & tickets"
        description="What the agent can do, what it has done, and the records its actions created. Refreshes every few seconds."
        actions={
          <Button size="sm" variant="outline" onClick={reloadAll}>
            <RefreshCwIcon className="size-3.5" />
            Refresh
          </Button>
        }
      />
      <div className="flex flex-1 flex-col gap-8 overflow-y-auto px-4 py-4 md:px-6">
        <Section
          title="Support tickets"
          description="Created by the create_support_ticket tool after you confirm. Change a status to simulate the IT team working it."
        >
          {tickets.error ? <p className="text-xs text-state-error">{tickets.error}</p> : null}
          <TicketTable
            tickets={tickets.data?.tickets ?? []}
            loading={tickets.loading}
            onStatusChange={(ticket, status) => void changeStatus(ticket, status)}
          />
        </Section>
        <Section
          title="Tool activity"
          description="Aggregated from the agent traces stored with every answer, including pre-fetched searches."
        >
          <ToolUsagePanel data={usage.data} loading={usage.loading} />
        </Section>
        <Section
          title="Tool catalogue"
          description="Exactly what the model sees: name, description and argument schema. Read-only tools run without confirmation; the one that creates records asks first."
        >
          <ToolCatalog tools={catalog.data?.tools ?? []} loading={catalog.loading} />
        </Section>
        <Section
          title="HR system (mock)"
          description="The external system behind get_leave_balance. Pick a persona in the voice agent to query these balances."
        >
          <EmployeeCards employees={employees.data?.employees ?? []} loading={employees.loading} />
        </Section>
      </div>
    </div>
  );
}
