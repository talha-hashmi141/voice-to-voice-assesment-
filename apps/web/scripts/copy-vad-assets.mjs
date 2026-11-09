#!/usr/bin/env node
/**
 * Copies the Silero VAD worklet + ONNX models and the onnxruntime-web WASM runtime
 * into public/vad so the browser can load them same-origin (no CDN dependency).
 * Runs automatically before `next dev` / `next build`; idempotent.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, '..', 'public', 'vad');
mkdirSync(target, { recursive: true });

/** Finds a package's root directory even when its "exports" map hides package.json. */
function packageRoot(name) {
  try {
    return dirname(require.resolve(`${name}/package.json`));
  } catch {
    let dir = dirname(require.resolve(name));
    while (dir !== dirname(dir)) {
      const candidate = join(dir, 'package.json');
      if (existsSync(candidate) && basename(dirname(candidate)) === basename(name)) return dir;
      dir = dirname(dir);
    }
    throw new Error(`Cannot locate package root for ${name}`);
  }
}

const vadDist = join(packageRoot('@ricky0123/vad-web'), 'dist');
const ortDist = join(packageRoot('onnxruntime-web'), 'dist');

const wanted = [
  ...readdirSync(vadDist)
    .filter((f) => f === 'vad.worklet.bundle.min.js' || /^silero_vad.*\.onnx$/.test(f))
    .map((f) => join(vadDist, f)),
  ...readdirSync(ortDist)
    .filter((f) => /^ort-wasm-simd-threaded(\.jsep)?\.(wasm|mjs)$/.test(f))
    .map((f) => join(ortDist, f)),
];

let copied = 0;
for (const source of wanted) {
  const destination = join(target, basename(source));
  const fresh = existsSync(destination) && statSync(destination).size === statSync(source).size;
  if (!fresh) {
    copyFileSync(source, destination);
    copied += 1;
  }
}
console.log(`[copy-vad-assets] ${copied} file(s) copied, ${wanted.length} present in public/vad`);
