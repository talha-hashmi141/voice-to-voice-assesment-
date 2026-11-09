import { ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { type TurnRequest, type TurnResponse } from '@voice-agent/contracts';
import { newId, Stopwatch } from '../../common';
import { ConversationService } from '../conversations';
import { type AgentTurnResult } from './agent-events';
import { AgentRuntime } from './agent-runtime';

/** Non-streaming text turn: used by the REST endpoint, tests and scripted demos. */
@Injectable()
export class AgentService {
  constructor(
    private readonly runtime: AgentRuntime,
    private readonly conversations: ConversationService,
  ) {}

  async runTextTurn(request: TurnRequest, signal?: AbortSignal): Promise<TurnResponse> {
    const conversation = await this.conversations.ensure(
      request.conversationId,
      request.userContext,
    );
    const turnId = newId();
    let completed: AgentTurnResult | undefined;

    for await (const event of this.runtime.run({
      turnId,
      conversationId: conversation.id,
      userText: request.text,
      userContext: conversation.userContext,
      signal: signal ?? new AbortController().signal,
      stopwatch: new Stopwatch(),
    })) {
      if (event.type === 'completed') completed = event.result;
      if (event.type === 'cancelled') throw new ConflictException('The turn was cancelled');
    }
    if (!completed) throw new InternalServerErrorException('The agent produced no answer');

    return {
      conversationId: conversation.id,
      turnId,
      userMessage: completed.userMessage,
      assistantMessage: completed.assistantMessage,
    };
  }
}
