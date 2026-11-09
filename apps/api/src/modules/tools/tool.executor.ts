import { Injectable, Logger } from '@nestjs/common';
import { withTimeout } from '../../common';
import { type LlmToolCall } from '../llm';
import { type ToolContext, type ToolResult } from './tool.port';
import { ToolRegistry } from './tool.registry';

export interface ToolExecution {
  call: LlmToolCall;
  args: Record<string, unknown>;
  ok: boolean;
  result?: ToolResult;
  error?: string;
  durationMs: number;
}

/**
 * Runs every tool call of a model turn concurrently (Promise.allSettled) with per-tool
 * timeouts and cancellation. Failures become structured error payloads the model can
 * recover from, never exceptions that abort the turn.
 */
@Injectable()
export class ToolExecutor {
  private readonly logger = new Logger(ToolExecutor.name);

  constructor(private readonly registry: ToolRegistry) {}

  async executeAll(calls: LlmToolCall[], context: ToolContext): Promise<ToolExecution[]> {
    const settled = await Promise.allSettled(calls.map((call) => this.executeOne(call, context)));
    return settled.map((outcome, index) =>
      outcome.status === 'fulfilled'
        ? outcome.value
        : { call: calls[index]!, args: {}, ok: false, error: String(outcome.reason), durationMs: 0 },
    );
  }

  async executeOne(call: LlmToolCall, context: ToolContext): Promise<ToolExecution> {
    const started = performance.now();
    const finish = (partial: Omit<ToolExecution, 'call' | 'durationMs'>): ToolExecution => ({
      call,
      durationMs: Math.round(performance.now() - started),
      ...partial,
    });

    const tool = this.registry.get(call.name);
    if (!tool) return finish({ args: {}, ok: false, error: `Unknown tool "${call.name}"` });

    let rawArgs: unknown;
    try {
      rawArgs = call.arguments.trim() ? JSON.parse(call.arguments) : {};
    } catch {
      return finish({ args: {}, ok: false, error: 'Arguments were not valid JSON' });
    }
    const parsed = tool.schema.safeParse(rawArgs);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => `${issue.path.join('.') || 'args'}: ${issue.message}`).join('; ');
      return finish({ args: rawArgs as Record<string, unknown>, ok: false, error: `Invalid arguments – ${issues}` });
    }

    try {
      const result = await withTimeout(tool.execute(parsed.data, context), tool.timeoutMs, call.name, context.signal);
      return finish({ args: parsed.data as Record<string, unknown>, ok: true, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Tool ${call.name} failed: ${message}`);
      return finish({ args: parsed.data as Record<string, unknown>, ok: false, error: message });
    }
  }

  /** What the model sees for a tool call: compact JSON with an ok flag. */
  static toModelPayload(execution: ToolExecution): string {
    return execution.ok
      ? JSON.stringify({ ok: true, data: execution.result?.data ?? null })
      : JSON.stringify({ ok: false, error: execution.error ?? 'unknown error' });
  }
}
