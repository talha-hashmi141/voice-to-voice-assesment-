import { Module } from '@nestjs/common';
import { AgentModule } from '../agent';
import { ConversationsModule } from '../conversations';
import { VoiceGateway } from './voice.gateway';
import { VoiceTurnPipeline } from './voice-turn-pipeline';

@Module({
  imports: [AgentModule, ConversationsModule],
  providers: [VoiceTurnPipeline, VoiceGateway],
  exports: [VoiceTurnPipeline],
})
export class VoiceModule {}
