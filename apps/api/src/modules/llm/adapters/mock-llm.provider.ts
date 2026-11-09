import {
  type LlmChatOptions,
  type LlmMessage,
  type LlmProvider,
  type LlmStreamEvent,
  type LlmToolCall,
} from '../llm-provider.port';

interface SearchPassage {
  ref: number;
  document: string;
  section: string;
  text: string;
}

/**
 * Deterministic, keyword-driven stand-in for a real model so the whole product – including
 * multi-step tool use, grounding, citations and abstention – runs with no API key.
 * It is intentionally simple: decide tools from the user text, then answer from tool results.
 */
export class MockLlmProvider implements LlmProvider {
  readonly model = 'mock:scripted-v1';
  private counter = 0;

  async *streamChat(options: LlmChatOptions): AsyncIterable<LlmStreamEvent> {
    const toolNames = new Set((options.tools ?? []).map((tool) => tool.name));
    const lastUser = [...options.messages].reverse().find((m) => m.role === 'user');
    const userText = lastUser?.role === 'user' ? lastUser.content : '';
    const lastUserIndex = options.messages.lastIndexOf(lastUser!);
    const toolMessages = options.messages.slice(lastUserIndex + 1).filter((m) => m.role === 'tool');
    const previousAssistant = [...options.messages.slice(0, lastUserIndex)]
      .reverse()
      .find((m) => m.role === 'assistant' && m.content);

    if (toolMessages.length === 0 && toolNames.size) {
      const calls = this.planCalls(userText, previousAssistant?.role === 'assistant' ? previousAssistant.content : null, toolNames);
      if (calls.length) {
        for (const call of calls) yield { type: 'tool_call', call };
        yield { type: 'done', finishReason: 'tool_calls' };
        return;
      }
    }

    const answer = this.compose(userText, toolMessages);
    for (const word of answer.split(/(?<=\s)/u)) {
      yield { type: 'text_delta', delta: word };
    }
    yield { type: 'done', finishReason: 'stop' };
  }

  async complete(options: LlmChatOptions): Promise<string> {
    const lastUser = [...options.messages].reverse().find((m) => m.role === 'user');
    return lastUser?.role === 'user' ? lastUser.content.slice(0, 200) : '';
  }

  private call(name: string, args: Record<string, unknown>): LlmToolCall {
    this.counter += 1;
    return { id: `mock-call-${this.counter}`, name, arguments: JSON.stringify(args) };
  }

  private planCalls(userText: string, previousAssistant: string | null, available: Set<string>): LlmToolCall[] {
    const text = userText.toLowerCase();
    const calls: LlmToolCall[] = [];
    const confirming = /^(yes|yeah|yep|sure|please do|go ahead|do it|ok(ay)?)\b/u.test(text.trim());

    if (available.has('create_support_ticket') && confirming && previousAssistant?.includes('open a support ticket')) {
      const match = /about: "(.+?)"/u.exec(previousAssistant);
      const priority = /urgent|critical/u.test(text) ? 'urgent' : /high/u.test(text) ? 'high' : 'medium';
      calls.push(
        this.call('create_support_ticket', {
          title: match?.[1] ?? 'Support request from voice assistant',
          description: `User confirmed via voice assistant: ${match?.[1] ?? userText}`,
          priority,
        }),
      );
      return calls;
    }

    if (available.has('search_knowledge_base')) {
      calls.push(this.call('search_knowledge_base', { queries: [userText], topK: 5 }));
    }
    if (available.has('get_current_datetime') && /\b(today|date|time|week|month|december|january|holiday|tomorrow|year)\b/u.test(text)) {
      calls.push(this.call('get_current_datetime', {}));
    }
    if (available.has('get_leave_balance') && /\b(pto|vacation|days? off|leave|balance|time off|holiday)\b/u.test(text)) {
      calls.push(this.call('get_leave_balance', {}));
    }
    return calls;
  }

  private compose(userText: string, toolMessages: LlmMessage[]): string {
    const results = toolMessages.flatMap((message) => {
      if (message.role !== 'tool') return [];
      try {
        return [{ name: message.name, payload: JSON.parse(message.content) as Record<string, unknown> }];
      } catch {
        return [];
      }
    });

    const parts: string[] = [];
    const ticket = results.find((r) => r.name === 'create_support_ticket' && r.payload.ok);
    if (ticket) {
      const data = ticket.payload.data as { reference: string; priority: string };
      return `Done. I opened support ticket ${data.reference} with ${data.priority} priority. The IT team will follow the helpdesk response targets for that priority.`;
    }

    const search = results.find((r) => r.name === 'search_knowledge_base');
    const searchData = search?.payload.data as
      | { assessment: 'strong' | 'weak' | 'none'; passages: SearchPassage[] }
      | undefined;
    if (searchData && searchData.assessment !== 'none' && searchData.passages.length) {
      const top = searchData.passages[0]!;
      const plain = top.text
        .replace(/\*\*/g, '')
        .replace(/^\s*[-*•]\s+/gmu, '')
        .replace(/\|/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const sentences = plain.split(/(?<=[.!?])\s+/u).slice(0, 2).join(' ');
      parts.push(`According to the ${top.document} (${top.section}): ${sentences} [${top.ref}]`);
      if (searchData.assessment === 'weak') {
        parts.push('That is the closest information I have; it may not fully cover your question.');
      }
    } else {
      parts.push(
        "I couldn't find anything about that in the Orbital Labs knowledge base, so I'd rather not guess. You can ask People Operations, or I can open a support ticket for you.",
      );
    }

    const balance = results.find((r) => r.name === 'get_leave_balance' && r.payload.ok);
    if (balance) {
      const data = balance.payload.data as { ptoRemainingDays: number; ptoTotalDays: number; ptoUsedDays: number };
      parts.push(
        `You currently have ${data.ptoRemainingDays} of your ${data.ptoTotalDays} PTO days left, having used ${data.ptoUsedDays}.`,
      );
    }

    const datetime = results.find((r) => r.name === 'get_current_datetime' && r.payload.ok);
    if (datetime) {
      const data = datetime.payload.data as { weekday: string; date: string };
      parts.push(`Today is ${data.weekday}, ${data.date}.`);
    }

    if (/\b(broken|cracked|not working|damaged|stolen|lost)\b/u.test(userText.toLowerCase())) {
      parts.push(`Would you like me to open a support ticket about: "${userText.replace(/"/g, "'")}"?`);
    }
    return parts.join(' ');
  }
}
