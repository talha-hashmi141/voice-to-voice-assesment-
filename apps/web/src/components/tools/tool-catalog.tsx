'use client';

import type { ToolDefinition } from '@voice-agent/contracts';
import {
  CalculatorIcon,
  CalendarClockIcon,
  CalendarRangeIcon,
  PencilLineIcon,
  SearchIcon,
  TicketIcon,
  WalletIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const ICONS: Record<string, typeof SearchIcon> = {
  search_knowledge_base: SearchIcon,
  get_current_datetime: CalendarClockIcon,
  count_business_days: CalendarRangeIcon,
  calculate: CalculatorIcon,
  get_leave_balance: WalletIcon,
  create_support_ticket: TicketIcon,
};

/** Example phrases that reliably make the agent call each tool. */
export const TOOL_TRIGGERS: Record<string, string> = {
  search_knowledge_base: '“How long do I have to claim back money I spent on a business trip?”',
  get_current_datetime: '“Is there a company holiday coming up this month?”',
  count_business_days: '“If I take December 21st to the 31st off, how many PTO days is that?”',
  calculate: '“I have used seven days; how many are left if I take five more?”',
  get_leave_balance: '“How many PTO days do I have left?”',
  create_support_ticket: '“My laptop screen is cracked” → “Yes please, high priority”',
};

interface SchemaProperty {
  type?: string;
  description?: string;
  default?: unknown;
  items?: { type?: string };
  enum?: unknown[];
}

function parameterRows(parameters: Record<string, unknown>) {
  const properties = (parameters.properties as Record<string, SchemaProperty> | undefined) ?? {};
  const required = new Set((parameters.required as string[] | undefined) ?? []);
  return Object.entries(properties).map(([name, schema]) => ({
    name,
    type:
      schema.type === 'array'
        ? `${schema.items?.type ?? 'any'}[]`
        : schema.enum
          ? schema.enum.join(' | ')
          : (schema.type ?? 'any'),
    required: required.has(name),
    description: schema.description ?? '',
  }));
}

export function ToolCatalog({ tools, loading }: { tools: ToolDefinition[]; loading: boolean }) {
  if (loading && !tools.length) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-44" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {tools.map((tool) => {
        const Icon = ICONS[tool.name] ?? PencilLineIcon;
        const rows = parameterRows(tool.parameters);
        return (
          <Card key={tool.name} className="gap-3" data-testid={`tool-${tool.name}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-mono text-sm">
                <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                {tool.name}
                <Badge
                  variant={tool.mutating ? 'destructive' : 'secondary'}
                  className="ml-auto text-[10px]"
                >
                  {tool.mutating ? 'creates records' : 'read-only'}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                {tool.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-xs">
              {rows.length ? (
                <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
                  {rows.map((row) => (
                    <div key={row.name} className="contents">
                      <dt className="font-mono text-foreground">
                        {row.name}
                        {row.required ? <span className="text-state-error">*</span> : null}
                        <span className="ml-1 text-muted-foreground">{row.type}</span>
                      </dt>
                      <dd className="text-muted-foreground">{row.description}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-muted-foreground">No arguments.</p>
              )}
              <p className="mt-1 border-t pt-2 text-muted-foreground">
                <span className="font-medium text-foreground">Try:</span>{' '}
                {TOOL_TRIGGERS[tool.name] ?? '—'}
              </p>
              <p className="text-[10px] text-muted-foreground">timeout {tool.timeoutMs / 1000}s</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
