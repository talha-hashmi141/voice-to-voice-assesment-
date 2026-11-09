import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const COMPOSE_FILE = resolve(ROOT, 'docker', 'docker-compose.yml');

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};
export const log = {
  step: (msg) => console.log(`\n${colors.cyan}${colors.bold}▶ ${msg}${colors.reset}`),
  ok: (msg) => console.log(`${colors.green}✔ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  fail: (msg) => console.error(`${colors.red}✖ ${msg}${colors.reset}`),
  info: (msg) => console.log(`  ${msg}`),
};

/** Runs a command, streaming output; resolves with the exit code (never throws). */
export function run(cmd, args, { cwd = ROOT, env = process.env, quiet = false } = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(cmd, args, {
      cwd,
      env,
      stdio: quiet ? 'ignore' : 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('close', (code) => resolvePromise(code ?? 1));
    child.on('error', () => resolvePromise(1));
  });
}

export async function runOrExit(cmd, args, options) {
  const code = await run(cmd, args, options);
  if (code !== 0) {
    log.fail(`${cmd} ${args.join(' ')} failed (exit ${code})`);
    process.exit(code);
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function dockerDaemonUp() {
  return (await run('docker', ['info'], { quiet: true })) === 0;
}

/** Starts Docker Desktop on macOS/Windows if the daemon is down, and waits for it. */
export async function ensureDockerDaemon({ waitSeconds = 120 } = {}) {
  if (await dockerDaemonUp()) return true;
  log.warn('Docker daemon is not running.');
  if (process.platform === 'darwin') {
    log.info('Starting Docker Desktop…');
    await run('open', ['-a', 'Docker'], { quiet: true });
  } else if (process.platform === 'win32') {
    log.info('Please start Docker Desktop.');
  } else {
    log.info('Try: sudo systemctl start docker');
  }
  for (let i = 0; i < waitSeconds / 2; i += 1) {
    await sleep(2000);
    if (await dockerDaemonUp()) return true;
  }
  return false;
}

export async function composeUp() {
  return run('docker', ['compose', '-f', COMPOSE_FILE, 'up', '-d', '--wait']);
}

export const envFileExists = () => existsSync(resolve(ROOT, '.env'));
