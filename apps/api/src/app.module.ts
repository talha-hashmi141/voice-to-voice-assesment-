import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { AppConfigModule, DatabaseModule, LoggingModule, QueueModule } from './common';
import {
  AgentModule,
  ConversationsModule,
  EmbeddingsModule,
  HealthModule,
  HrModule,
  KnowledgeModule,
  LlmModule,
  OpenAiModule,
  ToolsModule,
} from './modules';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    DatabaseModule,
    QueueModule,
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 300 }] }),
    OpenAiModule,
    EmbeddingsModule,
    LlmModule,
    HealthModule,
    KnowledgeModule,
    HrModule,
    ToolsModule,
    ConversationsModule,
    AgentModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
