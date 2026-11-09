import { Injectable } from '@nestjs/common';
import { type CalculateArgs, CalculateArgsSchema } from '@voice-agent/contracts';
import { all, create } from 'mathjs';
import { type Tool, type ToolResult } from '../tool.port';

export interface CalculateData {
  expression: string;
  result: string;
}

/** mathjs instance with the code-execution style functions removed (mathjs' documented sandboxing pattern). */
const math = create(all!, {});
const limitedEvaluate = math.evaluate;
const blocked = ['import', 'createUnit', 'evaluate', 'parse', 'simplify', 'derivative', 'compile'];
math.import(
  Object.fromEntries(
    blocked.map((name) => [
      name,
      () => {
        throw new Error(`Function ${name} is disabled`);
      },
    ]),
  ),
  { override: true },
);

@Injectable()
export class CalculateTool implements Tool<CalculateArgs, CalculateData> {
  readonly name = 'calculate' as const;
  readonly description =
    'Evaluate an arithmetic expression exactly (e.g. remaining PTO after a trip, per-diem totals, day counts). Use it instead of doing mental maths.';
  readonly schema = CalculateArgsSchema;
  readonly timeoutMs = 2_000;
  readonly mutating = false;

  async execute(args: CalculateArgs): Promise<ToolResult<CalculateData>> {
    const expression = args.expression.replace(/[×x]/gu, '*').replace(/÷/gu, '/');
    if (!/^[\d\s.,+\-*/()%^eE]+$/u.test(expression)) {
      throw new Error('Only numbers and the operators + - * / ^ % ( ) are allowed');
    }
    const value: unknown = limitedEvaluate(expression);
    const result = math.format(value, { precision: 12 });
    return {
      data: { expression: args.expression, result },
      summary: `${args.expression} = ${result}`,
    };
  }
}
