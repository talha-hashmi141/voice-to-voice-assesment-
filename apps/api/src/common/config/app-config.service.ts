import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from './env.schema';

export type AiProvider = 'openai' | 'mock';

/**
 * Typed façade over @nestjs/config. Every consumer depends on this class rather
 * than on raw process.env, so configuration is validated once and discoverable.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get nodeEnv(): Env['NODE_ENV'] {
    return this.config.get('NODE_ENV', { infer: true });
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }

  get port(): number {
    return this.config.get('PORT', { infer: true });
  }

  get corsOrigins(): string[] {
    return this.config
      .get('CORS_ORIGINS', { infer: true })
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  get logLevel(): Env['LOG_LEVEL'] {
    return this.config.get('LOG_LEVEL', { infer: true });
  }

  get databaseUrl(): string {
    return this.config.get('DATABASE_URL', { infer: true });
  }

  get redisUrl(): string {
    return this.config.get('REDIS_URL', { infer: true });
  }

  get migrateOnStart(): boolean {
    return this.config.get('DB_MIGRATE_ON_START', { infer: true });
  }

  /** Explicit AI_PROVIDER wins; otherwise use OpenAI when a key is present, else deterministic mocks. */
  get aiProvider(): AiProvider {
    const explicit = this.config.get('AI_PROVIDER', { infer: true });
    if (explicit === 'openai' || explicit === 'mock') return explicit;
    return this.openai.apiKey ? 'openai' : 'mock';
  }

  get openai() {
    return {
      apiKey: this.config.get('OPENAI_API_KEY', { infer: true }) || undefined,
      chatModel: this.config.get('OPENAI_CHAT_MODEL', { infer: true }),
      embeddingModel: this.config.get('OPENAI_EMBEDDING_MODEL', { infer: true }),
      sttModel: this.config.get('OPENAI_STT_MODEL', { infer: true }),
      ttsModel: this.config.get('OPENAI_TTS_MODEL', { infer: true }),
      ttsVoice: this.config.get('OPENAI_TTS_VOICE', { infer: true }),
    };
  }

  /** Where the ticket-lookup tool sends its HTTP calls; defaults to this API's own /hr endpoints. */
  get ticketingApiUrl(): string {
    const configured = this.config.get('TICKETING_API_URL', { infer: true });
    if (configured) return configured;
    return this.isTest ? 'inprocess' : `http://localhost:${this.port}/api/hr`;
  }

  get agent() {
    return {
      maxSteps: this.config.get('AGENT_MAX_STEPS', { infer: true }),
      maxOutputTokens: this.config.get('AGENT_MAX_OUTPUT_TOKENS', { infer: true }),
      eagerRetrieval: this.config.get('AGENT_EAGER_RETRIEVAL', { infer: true }),
      retrievalTopK: this.config.get('RETRIEVAL_TOP_K', { infer: true }),
      sparseWeight: this.config.get('RETRIEVAL_SPARSE_WEIGHT', { infer: true }),
      rerankEnabled: this.config.get('RERANK_ENABLED', { infer: true }),
    };
  }
}
