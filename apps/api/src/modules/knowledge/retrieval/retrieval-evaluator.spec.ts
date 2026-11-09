import { type SearchHit } from '@voice-agent/contracts';
import { MockEmbeddingProvider } from '../../embeddings';
import { RetrievalEvaluator } from './retrieval-evaluator';

const hit = (dense: number | null, sparse: number | null, rank = 1): SearchHit => ({
  chunkId: `c${rank}`,
  documentId: 'd',
  documentSlug: 'doc',
  documentTitle: 'Doc',
  sectionPath: 'S',
  content: 'text',
  rank,
  scores: { fused: 1, dense, sparse },
});

describe('RetrievalEvaluator', () => {
  const evaluator = new RetrievalEvaluator(new MockEmbeddingProvider()); // strong 0.3 / weak 0.12

  it('is "none" without hits or with noise-level similarity', () => {
    expect(evaluator.evaluate([]).assessment).toBe('none');
    expect(evaluator.evaluate([hit(0.05, null)]).assessment).toBe('none');
  });

  it('is "strong" above the strong threshold or with cross-channel agreement', () => {
    expect(evaluator.evaluate([hit(0.35, null)]).assessment).toBe('strong');
    expect(evaluator.evaluate([hit(0.2, 0.9)]).assessment).toBe('strong');
  });

  it('is "weak" for partial matches', () => {
    expect(evaluator.evaluate([hit(0.15, null)]).assessment).toBe('weak');
    expect(evaluator.evaluate([hit(null, 0.95)]).assessment).toBe('weak');
  });

  it('counts confident hits and reports the top score', () => {
    const result = evaluator.evaluate([hit(0.5, 1, 1), hit(0.31, null, 2), hit(0.1, null, 3)]);
    expect(result).toMatchObject({ assessment: 'strong', topScore: 0.5, confidentHits: 2 });
  });
});
