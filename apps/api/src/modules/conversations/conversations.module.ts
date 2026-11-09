import { Module } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ConversationsController } from './conversations.controller';
import { MemoryService } from './memory.service';
import { ConversationRepository, MessageRepository } from './repositories';

@Module({
  controllers: [ConversationsController],
  providers: [ConversationRepository, MessageRepository, ConversationService, MemoryService],
  exports: [ConversationRepository, MessageRepository, ConversationService, MemoryService],
})
export class ConversationsModule {}
