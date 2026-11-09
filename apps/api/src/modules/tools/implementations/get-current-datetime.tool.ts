import { Inject, Injectable } from '@nestjs/common';
import { type GetCurrentDateTimeArgs, GetCurrentDateTimeArgsSchema } from '@voice-agent/contracts';
import { type Tool, type ToolContext, type ToolResult } from '../tool.port';

export interface CurrentDateTimeData {
  iso: string;
  date: string;
  time: string;
  weekday: string;
  year: number;
  timezone: string;
}

/** Injectable clock so tests can freeze time. */
export const CLOCK = Symbol('CLOCK');
export type Clock = () => Date;
export const systemClock: Clock = () => new Date();

const isValidTimezone = (tz: string): boolean => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

@Injectable()
export class GetCurrentDateTimeTool implements Tool<GetCurrentDateTimeArgs, CurrentDateTimeData> {
  readonly name = 'get_current_datetime' as const;
  readonly description =
    "Get the current date, time and weekday in the user's timezone. Use it whenever a question depends on today's date (deadlines, notice periods, holidays, 'this week', 'next month').";
  readonly schema = GetCurrentDateTimeArgsSchema;
  readonly timeoutMs = 2_000;
  readonly mutating = false;

  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  async execute(args: GetCurrentDateTimeArgs, context: ToolContext): Promise<ToolResult<CurrentDateTimeData>> {
    const requested = args.timezone?.trim();
    const timezone = requested && isValidTimezone(requested) ? requested : context.userContext.timezone || 'UTC';
    const now = this.clock();
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
        .formatToParts(now)
        .map((part) => [part.type, part.value]),
    );
    const data: CurrentDateTimeData = {
      iso: now.toISOString(),
      date: `${parts.day} ${parts.month} ${parts.year}`,
      time: `${parts.hour}:${parts.minute}`,
      weekday: parts.weekday ?? '',
      year: Number(parts.year),
      timezone,
    };
    return { data, summary: `${data.weekday}, ${data.date} ${data.time} (${timezone})` };
  }
}
