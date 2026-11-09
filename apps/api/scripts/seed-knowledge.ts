import { loadEnv } from './_env';
loadEnv();

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { IngestionService, KNOWLEDGE_BASE_DIR } from '../src/modules/knowledge';

/** Seeds and indexes every markdown document in apps/api/knowledge-base (inline, no queue). */
async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const ingestion = app.get(IngestionService);
    const started = Date.now();
    const results = await ingestion.ingestDirectory(KNOWLEDGE_BASE_DIR, { force });
    console.table(
      results.map((result) => ({
        document: result.title,
        chunks: result.chunks,
        status: result.skipped ? 'up-to-date' : 'indexed',
      })),
    );
    const indexed = results.filter((r) => !r.skipped).length;
    console.warn(
      `✔ ${results.length} documents, ${results.reduce((n, r) => n + r.chunks, 0)} chunks (${indexed} re-indexed) in ${Date.now() - started}ms`,
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
