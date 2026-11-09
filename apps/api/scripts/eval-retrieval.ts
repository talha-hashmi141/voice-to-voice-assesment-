import { loadEnv } from './_env';
loadEnv();

import { NestFactory } from '@nestjs/core';
import { type RetrievalMode } from '@voice-agent/contracts';
import { AppModule } from '../src/app.module';
import { EMBEDDING_PROVIDER, type EmbeddingProvider } from '../src/modules/embeddings';
import { RetrievalEvaluator, RetrievalService } from '../src/modules/knowledge';

/**
 * Retrieval evaluation with realistic, deliberately paraphrased questions (wording differs from
 * the source documents). Reports hit@1, hit@3 and MRR per retrieval mode plus latency.
 */
interface EvalCase {
  question: string;
  /** Any of these document slugs counts as a correct top hit. */
  expected: string[];
}

const CASES: EvalCase[] = [
  {
    question: 'How long do I have to claim back money I spent on a business trip?',
    expected: ['expense-and-travel-policy'],
  },
  {
    question: 'Do I need to keep the receipt for a $20 taxi ride?',
    expected: ['expense-and-travel-policy'],
  },
  {
    question: 'What is the hotel budget per night in London?',
    expected: ['expense-and-travel-policy'],
  },
  {
    question: 'What happens to my unused vacation at the end of the year?',
    expected: ['pto-and-leave-policy'],
  },
  { question: 'How many days off do new employees get?', expected: ['pto-and-leave-policy'] },
  {
    question: 'How much notice do I need to give for a two-week vacation?',
    expected: ['pto-and-leave-policy'],
  },
  { question: 'Which days is the office closed in December?', expected: ['company-holidays-2026'] },
  { question: 'Can I work from Portugal for a month?', expected: ['remote-work-policy'] },
  {
    question: 'When do I have to be online every day?',
    expected: ['remote-work-policy', 'employee-handbook-overview'],
  },
  { question: 'My laptop screen is cracked, what should I do?', expected: ['equipment-policy'] },
  {
    question: 'Someone stole my phone, who do I tell?',
    expected: ['it-security-policy', 'equipment-policy'],
  },
  { question: 'How fast does IT respond to an urgent ticket?', expected: ['helpdesk-and-support'] },
  {
    question: 'Does the company match my retirement contributions?',
    expected: ['benefits-overview'],
  },
  { question: 'How much can I spend on courses each year?', expected: ['benefits-overview'] },
  { question: 'When are promotions decided?', expected: ['performance-and-promotions'] },
  { question: 'Can I accept a present from a supplier?', expected: ['code-of-conduct'] },
  { question: 'What do I need to finish in my first week?', expected: ['onboarding-guide'] },
  { question: 'Is there a dress code?', expected: ['employee-handbook-overview'] },
  { question: 'Can I bring my dog to the office?', expected: [] },
];

const MODES: RetrievalMode[] = ['hybrid', 'dense', 'sparse'];

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    const retrieval = app.get(RetrievalService);
    const evaluator = app.get(RetrievalEvaluator);
    const embeddings = app.get<EmbeddingProvider>(EMBEDDING_PROVIDER);
    console.warn(`Embedding provider: ${embeddings.model}\n`);

    const summary: Record<string, { hit1: number; hit3: number; mrr: number; ms: number }> = {};
    for (const mode of MODES) {
      let hit1 = 0;
      let hit3 = 0;
      let mrr = 0;
      let ms = 0;
      const rows: Record<string, string>[] = [];
      const answerable = CASES.filter((c) => c.expected.length);
      for (const testCase of CASES) {
        const outcome = await retrieval.search({ queries: [testCase.question], topK: 5, mode });
        ms += outcome.tookMs;
        const slugs = outcome.hits.map((hit) => hit.documentSlug);
        const rank = slugs.findIndex((slug) => testCase.expected.includes(slug)) + 1;
        if (testCase.expected.length) {
          if (rank === 1) hit1 += 1;
          if (rank >= 1 && rank <= 3) hit3 += 1;
          if (rank >= 1) mrr += 1 / rank;
        }
        const evaluation = evaluator.evaluate(outcome.hits);
        rows.push({
          question: testCase.question.slice(0, 52),
          top: `${slugs[0] ?? '-'} (${outcome.hits[0]?.scores.fused.toFixed(2) ?? '-'})`,
          rank: testCase.expected.length
            ? (rank || '✗').toString()
            : `n/a (${evaluation.assessment})`,
          dense: outcome.hits[0]?.scores.dense?.toFixed(2) ?? '-',
          sparse: outcome.hits[0]?.scores.sparse?.toFixed(2) ?? '-',
          grade: evaluation.assessment,
        });
      }
      console.warn(`\n=== mode: ${mode} ===`);
      console.table(rows);
      summary[mode] = {
        hit1: Number((hit1 / answerable.length).toFixed(2)),
        hit3: Number((hit3 / answerable.length).toFixed(2)),
        mrr: Number((mrr / answerable.length).toFixed(2)),
        ms: Math.round(ms / CASES.length),
      };
    }
    console.warn('\n=== summary (hit@1 / hit@3 / MRR / avg ms) ===');
    console.table(summary);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
