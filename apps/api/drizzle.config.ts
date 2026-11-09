import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/common/database/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5434/voice_agent',
  },
  verbose: true,
  strict: true,
});
