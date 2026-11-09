import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations';
import { ToolsModule } from '../tools';
import { AgentRuntime } from './agent-runtime';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { PromptBuilder } from './prompt-builder';

@Module({
  imports: [ToolsModule, ConversationsModule],
  controllers: [AgentController],
  providers: [PromptBuilder, AgentRuntime, AgentService],
  exports: [AgentRuntime, AgentService],
})
export class AgentModule {}
