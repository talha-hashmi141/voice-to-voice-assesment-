import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { AppConfigService } from '../config';

export function parseRedisUrl(url: string): { host: string; port: number; password?: string; db?: number } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || 'localhost',
    port: Number(parsed.port || 6379),
    password: parsed.password || undefined,
    db: parsed.pathname && parsed.pathname !== '/' ? Number(parsed.pathname.slice(1)) : undefined,
  };
}

/** BullMQ root connection (Redis). Queues are registered by the modules that own them. */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        // Key prefix isolates environments sharing one Redis (e.g. dev API vs. e2e tests).
        prefix: config.isTest ? 'voice-agent-test' : 'voice-agent',
        connection: { ...parseRedisUrl(config.redisUrl), maxRetriesPerRequest: null, enableOfflineQueue: true },
        defaultJobOptions: { removeOnComplete: 200, removeOnFail: 200, attempts: 2 },
      }),
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
