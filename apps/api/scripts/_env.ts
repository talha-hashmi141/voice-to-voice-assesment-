import { config } from 'dotenv';
import { resolve } from 'node:path';

/** Loads the monorepo root .env, then an optional apps/api/.env (which wins). */
export function loadEnv(): void {
  config({ path: resolve(__dirname, '..', '..', '..', '.env'), quiet: true });
  config({ path: resolve(__dirname, '..', '.env'), override: true, quiet: true });
}
