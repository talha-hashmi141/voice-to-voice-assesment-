import { Inject, Injectable } from '@nestjs/common';
import { type RetrievalAssessment, type SearchHit } from '@voice-agent/contracts';
import { EMBEDDING_PROVIDER, type EmbeddingProvider } from '../../embeddings';

export interface RetrievalEvaluation {
  assessment: RetrievalAssessment;
  topScore: number | null;
  /** Hits whose dense similarity clears the provider's "strong" threshold. */
  confidentHits: number;
  reason: string;
}

/**
 * CRAG-style retrieval grading without an extra LLM call: uses the embedding provider's
 * calibrated cosine thresholds plus cross-channel agreement (a passage that both the
 * vector and keyword channels surface is more trustworthy than either alone).
 */
@Injectable()
export class RetrievalEvaluator {
  constructor(@Inject(EMBEDDING_PROVIDER) private readonly embeddings: EmbeddingProvider) {}

  evaluate(hits: SearchHit[]): RetrievalEvaluation {
    const { strong, weak } = this.embeddings.thresholds;
    const top = hits[0];
    if (!top) return { assessment: 'none', topScore: null, confidentHits: 0, reason: 'no passages retrieved' };

    const topDense = top.scores.dense ?? 0;
    const topSparse = top.scores.sparse ?? 0;
    const bothChannels = top.scores.dense !== null && top.scores.sparse !== null;
    const confidentHits = hits.filter((hit) => (hit.scores.dense ?? 0) >= strong).length;
    const topScore = Number(Math.max(topDense, 0).toFixed(4));

    if (topDense >= strong) {
      return { assessment: 'strong', topScore, confidentHits, reason: `top similarity ${topScore} ≥ ${strong}` };
    }
    if (topDense >= weak && bothChannels) {
      return {
        assessment: 'strong',
        topScore,
        confidentHits,
        reason: `similarity ${topScore} with keyword agreement (sparse ${topSparse.toFixed(2)})`,
      };
    }
    if (topDense >= weak || (bothChannels && topSparse >= 0.6) || (top.scores.dense === null && topSparse >= 0.8)) {
      return {
        assessment: 'weak',
        topScore,
        confidentHits,
        reason: `partial match: similarity ${topScore} (thresholds strong ${strong} / weak ${weak})`,
      };
    }
    return {
      assessment: 'none',
      topScore,
      confidentHits,
      reason: `best similarity ${topScore} below weak threshold ${weak}`,
    };
  }
}
