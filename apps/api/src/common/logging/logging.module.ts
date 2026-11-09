import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { AppConfigModule, AppConfigService } from '../config';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.logLevel,
          genReqId: (req) => (req.headers['x-request-id'] as string | undefined) ?? randomUUID(),
          autoLogging: { ignore: (req) => req.url?.startsWith('/api/health') ?? false },
          transport: config.isProduction
            ? undefined
            : { target: 'pino-pretty', options: { colorize: true, singleLine: true } },
          redact: ['req.headers.authorization', 'req.headers.cookie'],
        },
      }),
    }),
  ],
})
export class LoggingModule {}
