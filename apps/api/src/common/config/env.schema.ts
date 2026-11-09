import { z } from 'zod';

const BooleanString = z
  .enum(['true', 'false', '1', '0', ''])
  .transform((value) => value === 'true' || value === '1');

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgres://postgres:postgres@localhost:5434/voice_agent'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  DB_MIGRATE_ON_START: BooleanString.default(true),

  AI_PROVIDER: z.enum(['openai', 'mock', '']).default(''),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_CHAT_MODEL: z.string().default('gpt-4.1-mini'),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  OPENAI_STT_MODEL: z.string().default('gpt-4o-transcribe'),
  OPENAI_TTS_MODEL: z.string().default('gpt-4o-mini-tts'),
  OPENAI_TTS_VOICE: z.string().default('coral'),

  RERANK_ENABLED: BooleanString.default(false),
  AGENT_MAX_STEPS: z.coerce.number().int().min(1).max(12).default(6),
  AGENT_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(64).max(4096).default(400),
  AGENT_EAGER_RETRIEVAL: BooleanString.default(true),
  RETRIEVAL_TOP_K: z.coerce.number().int().min(1).max(20).default(5),
  RETRIEVAL_SPARSE_WEIGHT: z.coerce.number().min(0).max(2).default(0.7),
});

export type Env = z.infer<typeof EnvSchema>;

/** Used by @nestjs/config: throws a readable error listing every invalid variable. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
