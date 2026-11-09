import { DEFAULT_PERSONA } from '@voice-agent/contracts';
import { CitationRegistry, type ToolContext } from '../tool.port';
import { GetCurrentDateTimeTool } from './get-current-datetime.tool';

const context = (timezone: string): ToolContext => ({
  turnId: 't',
  conversationId: 'c',
  userContext: { ...DEFAULT_PERSONA, timezone },
  citations: new CitationRegistry(),
  signal: new AbortController().signal,
});

describe('GetCurrentDateTimeTool', () => {
  const tool = new GetCurrentDateTimeTool(() => new Date('2026-12-21T15:30:00Z'));

  it("formats the date in the user's timezone by default", async () => {
    const { data, summary } = await tool.execute({}, context('America/New_York'));
    expect(data).toMatchObject({
      weekday: 'Monday',
      date: '21 December 2026',
      time: '10:30',
      year: 2026,
      timezone: 'America/New_York',
    });
    expect(summary).toBe('Monday, 21 December 2026 10:30 (America/New_York)');
  });

  it('honours an explicit valid timezone and falls back on invalid ones', async () => {
    expect((await tool.execute({ timezone: 'Asia/Karachi' }, context('UTC'))).data.time).toBe(
      '20:30',
    );
    expect((await tool.execute({ timezone: 'Not/AZone' }, context('UTC'))).data.timezone).toBe(
      'UTC',
    );
  });
});
