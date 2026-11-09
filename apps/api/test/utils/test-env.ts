/** Test-mode environment: dedicated database, deterministic mock providers, quiet logs. */
process.env.NODE_ENV = 'test';
process.env.AI_PROVIDER = 'mock';
process.env.LOG_LEVEL = 'error';
process.env.DB_MIGRATE_ON_START = 'false';
process.env.DATABASE_URL ??= 'postgres://postgres:postgres@localhost:5434/voice_agent_test';
process.env.REDIS_URL ??= 'redis://localhost:6379';
