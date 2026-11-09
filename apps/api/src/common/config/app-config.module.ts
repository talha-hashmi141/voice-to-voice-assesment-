import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'node:path';
import { AppConfigService } from './app-config.service';
import { validateEnv } from './env.schema';

/**
 * Loads the monorepo-level `.env` (../../.env relative to apps/api) and an optional
 * app-local `.env`, validates with Zod, and exposes a typed AppConfigService globally.
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [join(process.cwd(), '.env'), join(process.cwd(), '..', '..', '.env')],
      validate: validateEnv,
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
