import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { type LlmToolDefinition } from '../llm';
import { type Tool, TOOLS } from './tool.port';

@Injectable()
export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  constructor(@Inject(TOOLS) tools: Tool[]) {
    for (const tool of tools) {
      if (this.tools.has(tool.name)) throw new Error(`Duplicate tool registration: ${tool.name}`);
      this.tools.set(tool.name, tool);
    }
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): Tool[] {
    return [...this.tools.values()];
  }

  /** Converts Zod argument schemas into JSON Schema for the model's function-calling API. */
  toLlmDefinitions(): LlmToolDefinition[] {
    return this.list().map((tool) => {
      const schema = z.toJSONSchema(tool.schema, { target: 'draft-7', io: 'input' }) as Record<
        string,
        unknown
      >;
      delete schema.$schema;
      return { name: tool.name, description: tool.description, parameters: schema };
    });
  }
}
