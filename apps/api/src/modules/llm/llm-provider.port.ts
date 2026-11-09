/** Provider-agnostic chat/tool-calling contract. Adapters: OpenAI (production) and a scripted mock. */

export interface LlmToolDefinition {
  name: string;
  description: string;
  /** JSON Schema for the arguments object. */
  parameters: Record<string, unknown>;
}

export interface LlmToolCall {
  id: string;
  name: string;
  /** Raw JSON string exactly as produced by the model. */
  arguments: string;
}

export type LlmMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; toolCalls?: LlmToolCall[] }
  | { role: 'tool'; toolCallId: string; name: string; content: string };

export type LlmFinishReason = 'stop' | 'tool_calls' | 'length' | 'other';

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  /** Prompt tokens served from OpenAI's automatic prompt cache (billed at a discount). */
  cachedPromptTokens?: number;
}

export type LlmStreamEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_call'; call: LlmToolCall }
  | { type: 'done'; finishReason: LlmFinishReason; usage?: LlmUsage };

export interface LlmChatOptions {
  messages: LlmMessage[];
  tools?: LlmToolDefinition[];
  toolChoice?: 'auto' | 'none' | 'required';
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface LlmProvider {
  readonly model: string;
  /** Streams text deltas and complete tool calls, then a terminal `done` event. */
  streamChat(options: LlmChatOptions): AsyncIterable<LlmStreamEvent>;
  /** Non-streaming helper for auxiliary tasks (reranking, summaries). */
  complete(options: LlmChatOptions): Promise<string>;
}

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
