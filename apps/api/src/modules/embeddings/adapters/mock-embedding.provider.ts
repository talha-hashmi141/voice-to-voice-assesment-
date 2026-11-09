import { EMBEDDING_DIMENSIONS } from '../../../common';
import { type EmbeddingProvider, type SimilarityThresholds } from '../embedding-provider.port';

const STOPWORDS = new Set(
  'a an the and or but if then of to in on at for from by with about as into like through after over between out against during without before under around among is are was were be been being do does did have has had i you he she it we they me him her us them my your his its our their this that these those what which who whom when where why how all any both each few more most other some such no nor not only own same so than too very can will just should now'.split(
    ' ',
  ),
);

/** FNV-1a 32-bit hash, deterministic across runs and platforms. */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Crude suffix stripping so "days" ≈ "day", "submitted" ≈ "submit", "policies" ≈ "policy". */
const SUFFIXES = ['ing', 'edly', 'ed', 'es', 's', 'ly', 'ment', 'tion'] as const;
function stem(token: string): string {
  if (token.length > 4 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  for (const suffix of SUFFIXES) {
    if (token.endsWith(suffix) && token.length - suffix.length >= 3) {
      let base = token.slice(0, -suffix.length);
      // "submitt" → "submit", "runn" → "run"
      if ((suffix === 'ed' || suffix === 'ing') && /([b-df-hj-np-tv-z])\1$/u.test(base))
        base = base.slice(0, -1);
      return base;
    }
  }
  return token;
}

export function tokenizeForHashing(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9$%]+/u)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token))
    .map(stem);
}

/**
 * Deterministic feature-hashing embedding (unigrams + bigrams) used when no OpenAI key is
 * configured and in automated tests. Lexically similar texts get similar vectors, so
 * retrieval remains meaningful without any network access.
 */
export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly model = 'mock:feature-hash-v1';
  readonly dimensions = EMBEDDING_DIMENSIONS;
  readonly thresholds: SimilarityThresholds = { strong: 0.3, weak: 0.12 };

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.embedOne(text));
  }

  embedOne(text: string): number[] {
    const vector = new Array<number>(this.dimensions).fill(0);
    const tokens = tokenizeForHashing(text);
    const add = (feature: string, weight: number) => {
      const hash = fnv1a(feature);
      const index = hash % this.dimensions;
      const sign = (hash >>> 8) & 1 ? 1 : -1;
      vector[index] = (vector[index] ?? 0) + sign * weight;
    };
    tokens.forEach((token, i) => {
      add(token, 1);
      const next = tokens[i + 1];
      if (next) add(`${token}_${next}`, 0.5);
    });
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
    return vector.map((value) => value / norm);
  }
}
