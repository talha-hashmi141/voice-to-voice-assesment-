import { CountBusinessDaysTool } from './count-business-days.tool';

describe('CountBusinessDaysTool', () => {
  const tool = new CountBusinessDaysTool();

  it('counts weekdays and subtracts holidays that fall on weekdays', async () => {
    const { data, summary } = await tool.execute({
      startDate: '2026-12-21',
      endDate: '2026-12-31',
      holidays: ['2026-12-24', '2026-12-25', '2026-12-26', '2026-12-31'],
    });
    expect(data).toMatchObject({ calendarDays: 11, weekdays: 9, businessDays: 6 });
    expect(data.holidaysOnWeekdays).toEqual(['2026-12-24', '2026-12-25', '2026-12-31']);
    expect(data.businessDayDates).toEqual([
      '2026-12-21',
      '2026-12-22',
      '2026-12-23',
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
    ]);
    expect(summary).toBe('9 weekdays − 3 holidays = 6 business days (2026-12-21 to 2026-12-31)');
  });

  it('handles a single day and rejects reversed ranges', async () => {
    expect(
      (await tool.execute({ startDate: '2026-11-14', endDate: '2026-11-14', holidays: [] })).data
        .businessDays,
    ).toBe(0);
    await expect(
      tool.execute({ startDate: '2026-11-14', endDate: '2026-11-13', holidays: [] }),
    ).rejects.toThrow(/before/u);
  });
});
