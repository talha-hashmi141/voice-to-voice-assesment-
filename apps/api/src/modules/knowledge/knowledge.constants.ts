import { join } from 'node:path';

/** Resolves to <apps/api>/knowledge-base from src/ and to <apps/api>/dist/knowledge-base after build. */
export const KNOWLEDGE_BASE_DIR = join(__dirname, '..', '..', '..', 'knowledge-base');
