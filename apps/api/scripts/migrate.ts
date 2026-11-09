import { loadEnv } from './_env';
loadEnv();

import { createDatabase, runMigrations } from '../src/common/database/database.module';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5434/voice_agent';
  const { client, db } = createDatabase(url);
  try {
    await runMigrations(db);
    console.warn('✔ migrations applied');
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
