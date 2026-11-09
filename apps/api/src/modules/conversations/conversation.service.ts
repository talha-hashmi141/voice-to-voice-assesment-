import { Injectable, NotFoundException } from '@nestjs/common';
import {
  type Conversation,
  type ConversationDetail,
  DEFAULT_PERSONA,
  type UserContext,
} from '@voice-agent/contracts';
import { toConversation, toMessage } from './conversations.mappers';
import { ConversationRepository, MessageRepository } from './repositories';

@Injectable()
export class ConversationService {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly messages: MessageRepository,
  ) {}

  /** Returns the conversation, creating one when no id is given; the stored user context wins. */
  async ensure(
    id: string | undefined,
    userContext?: UserContext,
  ): Promise<Conversation & { userContext: UserContext }> {
    if (id) {
      const existing = await this.conversations.findById(id);
      if (!existing) throw new NotFoundException(`Conversation ${id} not found`);
      if (!existing.userContext && userContext) await this.conversations.touch(id, { userContext });
      return {
        ...toConversation(existing, existing.messageCount),
        userContext: existing.userContext ?? userContext ?? DEFAULT_PERSONA,
      };
    }
    const created = await this.conversations.create({
      userContext: userContext ?? DEFAULT_PERSONA,
    });
    return { ...toConversation(created, 0), userContext: created.userContext ?? DEFAULT_PERSONA };
  }

  async create(input: { userContext?: UserContext; title?: string }): Promise<Conversation> {
    const row = await this.conversations.create({
      userContext: input.userContext ?? DEFAULT_PERSONA,
      title: input.title ?? null,
    });
    return toConversation(row, 0);
  }

  async list(): Promise<Conversation[]> {
    const rows = await this.conversations.list();
    return rows.map((row) => toConversation(row, row.messageCount));
  }

  async getDetail(id: string): Promise<ConversationDetail> {
    const row = await this.conversations.findById(id);
    if (!row) throw new NotFoundException(`Conversation ${id} not found`);
    const messages = await this.messages.listByConversation(id);
    return {
      ...toConversation(row, row.messageCount),
      messages: messages.filter((m) => m.role === 'user' || m.role === 'assistant').map(toMessage),
    };
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.conversations.delete(id);
    if (!deleted) throw new NotFoundException(`Conversation ${id} not found`);
  }
}
