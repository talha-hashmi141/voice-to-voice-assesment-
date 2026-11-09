import {
  type RetrievalAssessment,
  type Source,
  type ToolName,
  type UserContext,
} from '@voice-agent/contracts';
import { type z } from 'zod';

/** Per-turn registry that numbers cited passages consistently across several searches. */
export class CitationRegistry {
  private readonly sources: Source[] = [];
  private readonly byChunk = new Map<string, Source>();

  register(source: Omit<Source, 'index'>): Source {
    const existing = this.byChunk.get(source.chunkId);
    if (existing) return existing;
    const created: Source = { ...source, index: this.sources.length + 1 };
    this.sources.push(created);
    this.byChunk.set(source.chunkId, created);
    return created;
  }

  get(index: number): Source | undefined {
    return this.sources[index - 1];
  }

  all(): Source[] {
    return [...this.sources];
  }
}

export interface ToolContext {
  turnId: string;
  conversationId: string;
  userContext: UserContext;
  citations: CitationRegistry;
  signal: AbortSignal;
}

export interface ToolResult<TData = unknown> {
  /** Structured payload handed back to the model (serialised as JSON). */
  data: TData;
  /** One-line human-readable description for the trace UI. */
  summary: string;
  /** Present for retrieval tools: how trustworthy the retrieved passages are. */
  retrieval?: {
    assessment: RetrievalAssessment;
    topScore: number | null;
    hits: number;
    queries: string[];
    reason: string;
  };
}

export interface Tool<TArgs = unknown, TData = unknown> {
  readonly name: ToolName;
  readonly description: string;
  readonly schema: z.ZodType<TArgs>;
  readonly timeoutMs: number;
  /** Mutating tools have side effects; the prompt asks the model to confirm with the user first. */
  readonly mutating: boolean;
  execute(args: TArgs, context: ToolContext): Promise<ToolResult<TData>>;
}

export const TOOLS = Symbol('TOOLS');
