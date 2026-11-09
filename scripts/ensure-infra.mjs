#!/usr/bin/env node
/** predev hook: makes sure Postgres + Redis are up before `turbo run dev`. Skipped in CI. */
import { composeUp, dockerDaemonUp, envFileExists, log } from './_shared.mjs';
import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './_shared.mjs';

if (process.env.CI || process.env.SKIP_INFRA === '1') process.exit(0);

if (!envFileExists()) {
  copyFileSync(resolve(ROOT, '.env.example'), resolve(ROOT, '.env'));
  log.ok('Created .env from .env.example');
}

if (!(await dockerDaemonUp())) {
  log.warn(
    'Docker daemon not running — run `pnpm bootstrap` once, or start Docker Desktop. Continuing anyway.',
  );
  process.exit(0);
}
const code = await composeUp();
if (code !== 0)
  log.warn('docker compose up failed; the API will not be able to reach Postgres/Redis.');
