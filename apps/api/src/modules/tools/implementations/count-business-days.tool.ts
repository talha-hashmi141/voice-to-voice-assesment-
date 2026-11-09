import { Injectable } from '@nestjs/common';
import { type CountBusinessDaysArgs, CountBusinessDaysArgsSchema } from '@voice-agent/contracts';
import { type Tool, type ToolResult } from '../tool.port';

export interface BusinessDaysData {
  startDate: string;
  endDate: string;
  calendarDays: number;
  weekdays: number;
  /** Holidays from the input that fall on a weekday inside the range. */
  holidaysOnWeekdays: string[];
  businessDays: number;
  /** The working days that would need leave, for the model to list if useful. */
  businessDayDates: string[];
}

const parse = (iso: string): Date => new Date(`${iso}T00:00:00Z`);
const format = (date: Date): string => date.toISOString().slice(0, 10);
const isWeekday = (date: Date): boolean => date.getUTCDay() !== 0 && date.getUTCDay() !== 6;

/** Deterministic date arithmetic so leave requests are never counted "in the model's head". */
@Injectable()
export class CountBusinessDaysTool implements Tool<CountBusinessDaysArgs, BusinessDaysData> {
  readonly name = 'count_business_days' as const;
  readonly description =
    'Count the working days (Monday to Friday, excluding the given company holidays) in an inclusive date range. ' +
    'Use it for any leave request, deadline or notice-period question instead of counting days yourself; ' +
    'pass the holidays you found in the knowledge base.';
  readonly schema = CountBusinessDaysArgsSchema;
  readonly timeoutMs = 2_000;
  readonly mutating = false;

  async execute(args: CountBusinessDaysArgs): Promise<ToolResult<BusinessDaysData>> {
    const start = parse(args.startDate);
    const end = parse(args.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
      throw new Error('Invalid date');
    if (end < start) throw new Error('endDate must not be before startDate');
    if ((end.getTime() - start.getTime()) / 86_400_000 > 366)
      throw new Error('Range longer than a year');

    const holidays = new Set(args.holidays);
    const businessDayDates: string[] = [];
    const holidaysOnWeekdays: string[] = [];
    let weekdays = 0;
    let calendarDays = 0;
    for (
      const cursor = new Date(start);
      cursor <= end;
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    ) {
      calendarDays += 1;
      if (!isWeekday(cursor)) continue;
      weekdays += 1;
      const iso = format(cursor);
      if (holidays.has(iso)) holidaysOnWeekdays.push(iso);
      else businessDayDates.push(iso);
    }
    const data: BusinessDaysData = {
      startDate: args.startDate,
      endDate: args.endDate,
      calendarDays,
      weekdays,
      holidaysOnWeekdays,
      businessDays: businessDayDates.length,
      businessDayDates,
    };
    return {
      data,
      summary: `${weekdays} weekdays − ${holidaysOnWeekdays.length} holidays = ${data.businessDays} business days (${args.startDate} to ${args.endDate})`,
    };
  }
}
