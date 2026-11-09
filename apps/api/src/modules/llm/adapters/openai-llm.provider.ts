import type OpenAI from 'openai';
import type {
  ChatCompletionChunk,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';
import {
  type LlmChatOptions,
  type LlmFinishReason,
  type LlmMessage,
  type LlmProvider,
  type LlmStreamEvent,
  type LlmToolCall,
  type LlmToolDefinition,
  type LlmUsage,
} from '../llm-provider.port';

function toOpenAiMessages(messages: LlmMessage[]): ChatCompletionMessageParam[] {
  return messages.map((message): ChatCompletionMessageParam => {
    switch (message.role) {
      case 'system':
        return { role: 'system', content: message.content };
      case 'user':
        return { role: 'user', content: message.content };
      case 'assistant':
        return {
          role: 'assistant',
          content: message.content ?? null,
          ...(message.toolCalls?.length
            ? {
                tool_calls: message.toolCalls.map((call) => ({
                  id: call.id,
                  type: 'function' as const,
                  function: { name: call.name, arguments: call.arguments },
                })),
              }
            : {}),
        };
      case 'tool':
        return { role: 'tool', tool_call_id: message.toolCallId, content: message.content };
    }
  });
}

function toOpenAiTools(tools: LlmToolDefinition[] | undefined): ChatCompletionTool[] | undefined {
  if (!tools?.length) return undefined;
  return tools.map((tool) => ({
    type: 'function',
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }));
}

const toFinishReason = (reason: string | null | undefined): LlmFinishReason =>
  reason === 'stop' || reason === 'tool_calls' || reason === 'length' ? reason : 'other';

export class OpenAiLlmProvider implements LlmProvider {
  readonly model: string;

  constructor(
    private readonly client: OpenAI,
    modelName: string,
  ) {
    this.model = `openai:${modelName}`;
  }

  private get modelName(): string {
    return this.model.slice('openai:'.length);
  }

  async *streamChat(options: LlmChatOptions): AsyncIterable<LlmStreamEvent> {
    const stream = await this.client.chat.completions.create(
      {
        model: this.modelName,
        messages: toOpenAiMessages(options.messages),
        tools: toOpenAiTools(options.tools),
        tool_choice: options.tools?.length ? (options.toolChoice ?? 'auto') : undefined,
        parallel_tool_calls: options.tools?.length ? true : undefined,
        temperature: options.temperature ?? 0.3,
        max_completion_tokens: options.maxTokens,
        stream: true,
        stream_options: { include_usage: true },
      },
      { signal: options.signal },
    );

    const pending = new Map<number, LlmToolCall>();
    let finishReason: LlmFinishReason = 'other';
    let usage: LlmUsage | undefined;

    for await (const chunk of stream as AsyncIterable<ChatCompletionChunk>) {
      const choice = chunk.choices[0];
      if (choice?.delta?.content) yield { type: 'text_delta', delta: choice.delta.content };
      for (const delta of choice?.delta?.tool_calls ?? []) {
        const current = pending.get(delta.index) ?? { id: '', name: '', arguments: '' };
        if (delta.id) current.id = delta.id;
        if (delta.function?.name) current.name += delta.function.name;
        if (delta.function?.arguments) current.arguments += delta.function.arguments;
        pending.set(delta.index, current);
      }
      if (choice?.finish_reason) finishReason = toFinishReason(choice.finish_reason);
      if (chunk.usage) {
        usage = {
          promptTokens: chunk.usage.prompt_tokens,
          completionTokens: chunk.usage.completion_tokens,
          cachedPromptTokens: chunk.usage.prompt_tokens_details?.cached_tokens ?? 0,
        };
      }
    }

    for (const call of [...pending.entries()].sort(([a], [b]) => a - b).map(([, value]) => value)) {
      yield { type: 'tool_call', call: { ...call, arguments: call.arguments || '{}' } };
    }
    yield { type: 'done', finishReason: pending.size ? 'tool_calls' : finishReason, usage };
  }

  async complete(options: LlmChatOptions): Promise<string> {
    const response = await this.client.chat.completions.create(
      {
        model: this.modelName,
        messages: toOpenAiMessages(options.messages),
        temperature: options.temperature ?? 0,
        max_completion_tokens: options.maxTokens,
      },
      { signal: options.signal },
    );
    return response.choices[0]?.message?.content ?? '';
  }
}
