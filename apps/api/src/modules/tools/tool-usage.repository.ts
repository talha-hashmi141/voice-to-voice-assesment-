import { Inject, Injectable } from '@nestjs/common';
import { type ToolInvocation, type ToolUsage } from '@voice-agent/contracts';
import { sql } from 'drizzle-orm';
import { DATABASE, type Database, toIso } from '../../common';

/** Aggregates tool activity from the agent traces stored with assistant messages. */
@Injectable()
export class ToolUsageRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async usage(): Promise<ToolUsage[]> {
    const rows = await this.db.execute<{
      name: string;
      calls: number;
      failures: number;
      avg_duration: number | null;
    }>(sql`
      select s->'data'->>'name' as name,
             count(*)::int as calls,
             (count(*) filter (where s->'data'->>'ok' = 'false'))::int as failures,
             avg((s->>'durationMs')::float) as avg_duration
      from messages m, jsonb_array_elements(m.steps) s
      where s->>'type' = 'tool_result' and s->'data'->>'name' is not null
      group by 1
      order by calls desc, name asc
    `);
    return rows.map((row) => ({
      name: row.name,
      calls: Number(row.calls),
      failures: Number(row.failures),
      avgDurationMs: row.avg_duration === null ? null : Math.round(Number(row.avg_duration)),
    }));
  }

  async recent(limit = 25): Promise<ToolInvocation[]> {
    const rows = await this.db.execute<{
      conversation_id: string;
      message_id: string;
      name: string;
      label: string;
      ok: boolean | null;
      duration_ms: number | null;
      created_at: Date | string;
    }>(sql`
      select m.conversation_id, m.id as message_id, s->'data'->>'name' as name, s->>'label' as label,
             (s->'data'->>'ok')::boolean as ok, (s->>'durationMs')::float as duration_ms, m.created_at
      from messages m, jsonb_array_elements(m.steps) s
      where s->>'type' = 'tool_result' and s->'data'->>'name' is not null
      order by m.created_at desc
      limit ${limit}
    `);
    return rows.map((row) => ({
      conversationId: row.conversation_id,
      messageId: row.message_id,
      name: row.name,
      label: row.label,
      ok: row.ok,
      durationMs: row.duration_ms === null ? null : Math.round(Number(row.duration_ms)),
      at: toIso(row.created_at),
    }));
  }
}
