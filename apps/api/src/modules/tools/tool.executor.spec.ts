import { DEFAULT_PERSONA } from '@voice-agent/contracts';
import { z } from 'zod';
import { CitationRegistry, type Tool, type ToolContext } from './tool.port';
import { ToolExecutor } from './tool.executor';
import { ToolRegistry } from './tool.registry';

const context = (): ToolContext => ({
  turnId: 't1',
  conversationId: 'c1',
  userContext: DEFAULT_PERSONA,
  citations: new CitationRegistry(),
  signal: new AbortController().signal,
});

const makeTool = (overrides: Partial<Tool<{ n?: number }, unknown>> & { execute: Tool<{ n?: number }>['execute'] }): Tool => ({
  name: 'calculate',
  description: 'test',
  schema: z.object({ n: z.number().optional() }),
  timeoutMs: 50,
  mutating: false,
  ...overrides,
}) as Tool;

describe('ToolExecutor', () => {
  it('runs calls concurrently and preserves call order in results', async () => {
    const order: string[] = [];
    const slow = makeTool({
      name: 'calculate',
      execute: async () => {
        await new Promise((r) => setTimeout(r, 30));
        order.push('slow');
        return { data: 'slow', summary: 'slow' };
      },
    });
    const fast = makeTool({
      name: 'get_current_datetime',
      execute: async () => {
        order.push('fast');
        return { data: 'fast', summary: 'fast' };
      },
    });
    const executor = new ToolExecutor(new ToolRegistry([slow, fast]));
    const started = performance.now();
    const results = await executor.executeAll(
      [
        { id: '1', name: 'calculate', arguments: '{}' },
        { id: '2', name: 'get_current_datetime', arguments: '{}' },
      ],
      context(),
    );
    expect(performance.now() - started).toBeLessThan(80);
    expect(order).toEqual(['fast', 'slow']);
    expect(results.map((r) => r.call.id)).toEqual(['1', '2']);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it('reports invalid JSON, schema violations and unknown tools as structured errors', async () => {
    const tool = makeTool({ execute: async () => ({ data: 1, summary: '1' }) });
    const executor = new ToolExecutor(new ToolRegistry([tool]));
    const [badJson, badSchema, unknown] = await executor.executeAll(
      [
        { id: '1', name: 'calculate', arguments: '{not json' },
        { id: '2', name: 'calculate', arguments: '{"n":"x"}' },
        { id: '3', name: 'nope', arguments: '{}' },
      ],
      context(),
    );
    expect(badJson).toMatchObject({ ok: false, error: 'Arguments were not valid JSON' });
    expect(badSchema?.ok).toBe(false);
    expect(badSchema?.error).toMatch(/Invalid arguments/u);
    expect(unknown).toMatchObject({ ok: false, error: 'Unknown tool "nope"' });
    expect(ToolExecutor.toModelPayload(badJson!)).toBe('{"ok":false,"error":"Arguments were not valid JSON"}');
  });

  it('times out slow tools and surfaces thrown errors', async () => {
    const hanging = makeTool({ timeoutMs: 20, execute: () => new Promise(() => undefined) });
    const throwing = makeTool({ name: 'get_leave_balance', execute: async () => { throw new Error('HR system down'); } });
    const executor = new ToolExecutor(new ToolRegistry([hanging, throwing]));
    const [timedOut, failed] = await executor.executeAll(
      [
        { id: '1', name: 'calculate', arguments: '{}' },
        { id: '2', name: 'get_leave_balance', arguments: '{}' },
      ],
      context(),
    );
    expect(timedOut?.error).toMatch(/timed out/u);
    expect(failed?.error).toBe('HR system down');
  });
});

describe('ToolRegistry', () => {
  it('exports JSON schema definitions for the model', () => {
    const tool = makeTool({ execute: async () => ({ data: 1, summary: '1' }) });
    const [definition] = new ToolRegistry([tool]).toLlmDefinitions();
    expect(definition).toMatchObject({ name: 'calculate', description: 'test' });
    expect(definition?.parameters).toMatchObject({ type: 'object', properties: { n: { type: 'number' } } });
    expect(definition?.parameters).not.toHaveProperty('$schema');
  });

  it('rejects duplicate tool names', () => {
    const tool = makeTool({ execute: async () => ({ data: 1, summary: '1' }) });
    expect(() => new ToolRegistry([tool, tool])).toThrow(/Duplicate tool/u);
  });
});
