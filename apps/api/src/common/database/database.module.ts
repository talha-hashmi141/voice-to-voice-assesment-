import { Global, Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { join } from 'node:path';
import postgres, { type Sql } from 'postgres';
import { AppConfigService } from '../config';
import { DATABASE, DATABASE_CLIENT, type Database } from './database.tokens';
import * as schema from './schema';

/** Resolves to <apps/api>/drizzle both from src/ (ts-node/tsx) and from dist/ (compiled). */
export const MIGRATIONS_FOLDER = join(__dirname, '..', '..', '..', 'drizzle');

export function createPostgresClient(url: string): Sql {
  return postgres(url, { max: 10, prepare: false, onnotice: () => undefined });
}

export function createDatabase(url: string): { client: Sql; db: Database } {
  const client = createPostgresClient(url);
  return { client, db: drizzle(client, { schema }) };
}

export async function runMigrations(db: Database, folder = MIGRATIONS_FOLDER): Promise<void> {
  await migrate(db, { migrationsFolder: folder });
}

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CLIENT,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): Sql => createPostgresClient(config.databaseUrl),
    },
    {
      provide: DATABASE,
      inject: [DATABASE_CLIENT, AppConfigService],
      useFactory: async (client: Sql, config: AppConfigService): Promise<Database> => {
        const db = drizzle(client, { schema });
        if (config.migrateOnStart && !config.isTest) {
          await runMigrations(db);
          new Logger('Database').log('Migrations applied');
        }
        return db;
      },
    },
  ],
  exports: [DATABASE, DATABASE_CLIENT],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DATABASE_CLIENT) private readonly client: Sql) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.end({ timeout: 5 });
  }
}
