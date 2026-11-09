import './test-env';
import { createDatabase, runMigrations } from '../../src/common/database/database.module';

/** Jest globalSetup: applies migrations to the test database once per run. */
export default async function globalSetup(): Promise<void> {
  const { client, db } = createDatabase(process.env.DATABASE_URL!);
  try {
    await runMigrations(db);
  } finally {
    await client.end({ timeout: 5 });
  }
}
