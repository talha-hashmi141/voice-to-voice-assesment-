#!/usr/bin/env node
/**
 * One-shot developer setup:
 *   1. verifies Node/pnpm
 *   2. creates .env from .env.example
 *   3. installs workspace dependencies
 *   4. starts Postgres (pgvector) + Redis via Docker Compose and waits for health
 *   5. builds shared packages, applies migrations, seeds + indexes the knowledge base
 *   6. copies browser VAD/ONNX assets into the web app
 *
 * Idempotent: safe to re-run at any time.
 */
import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { composeUp, ensureDockerDaemon, envFileExists, log, ROOT, run, runOrExit } from './_shared.mjs';

const [major] = process.versions.node.split('.').map(Number);
if (major < 22) {
  log.fail(`Node 22+ is required (found ${process.versions.node}).`);
  process.exit(1);
}

log.step('Environment file');
if (envFileExists()) {
  log.ok('.env already exists (left untouched)');
} else {
  copyFileSync(resolve(ROOT, '.env.example'), resolve(ROOT, '.env'));
  log.ok('Created .env from .env.example — add OPENAI_API_KEY to use real models (mock mode works without it)');
}

log.step('Installing dependencies');
await runOrExit('pnpm', ['install']);

log.step('Starting infrastructure (Postgres + pgvector, Redis)');
if (!(await ensureDockerDaemon())) {
  log.fail('Docker is not available. Start Docker Desktop and re-run `pnpm bootstrap`.');
  process.exit(1);
}
const composeCode = await composeUp();
if (composeCode !== 0) {
  log.fail('docker compose failed. Check that ports 5434 and 6379 are free.');
  process.exit(composeCode);
}
log.ok('Postgres and Redis are healthy');

log.step('Building shared packages');
await runOrExit('pnpm', ['--filter', '@voice-agent/contracts', 'build']);

log.step('Applying database migrations');
await runOrExit('pnpm', ['--filter', '@voice-agent/api', 'db:migrate']);

log.step('Seeding and indexing the knowledge base');
await runOrExit('pnpm', ['--filter', '@voice-agent/api', 'db:seed']);

log.step('Copying browser voice-activity-detection assets');
await runOrExit('pnpm', ['--filter', '@voice-agent/web', 'copy-assets']);

log.step('Done');
log.info('Start everything with:  pnpm dev');
log.info('Web:  http://localhost:3000     API: http://localhost:4000/api     Docs: http://localhost:4000/api/docs');
if ((await run('node', ['-e', "process.exit(require('fs').readFileSync('.env','utf8').match(/^OPENAI_API_KEY=.+$/m)?0:1)"], { quiet: true })) !== 0) {
  log.warn('No OPENAI_API_KEY set: running in deterministic mock mode. Add the key to .env, then run `pnpm db:seed` to re-embed with real embeddings.');
}
