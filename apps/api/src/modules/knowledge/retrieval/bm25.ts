/**
 * BM25 ranking over Postgres tsvector lexemes. Postgres' ts_rank has no inverse-document-
 * frequency term, so chunks that merely repeat a common word ("business", "day") outrank
 * chunks containing the rare, discriminative words of a query. BM25 fixes that with IDF and
 * length normalisation; the candidate set still comes from the GIN-indexed `tsv @@ query`.
 */
export interface Bm25Document {
  id: string;
  termFrequencies: Map<string, number>;
  /** Total lexeme occurrences in the document. */
  length: number;
}

export interface Bm25Stats {
  totalDocuments: number;
  averageLength: number;
  /** Number of documents containing each lexeme. */
  documentFrequency: Map<string, number>;
}

export interface Bm25Options {
  k1?: number;
  b?: number;
}

const TSVECTOR_ENTRY = /'((?:[^']|'')*)'(?::([\d,A-D]+))?/gu;

/** Parses the text form of a tsvector ("'claim':3,7 'expens':1A") into lexeme → occurrence count. */
export function parseTsVector(tsv: string): Bm25Document['termFrequencies'] {
  const frequencies = new Map<string, number>();
  for (const match of tsv.matchAll(TSVECTOR_ENTRY)) {
    const lexeme = match[1]!.replace(/''/gu, "'");
    const positions = match[2] ? match[2].split(',').length : 1;
    frequencies.set(lexeme, (frequencies.get(lexeme) ?? 0) + positions);
  }
  return frequencies;
}

export function toBm25Document(id: string, tsv: string): Bm25Document {
  const termFrequencies = parseTsVector(tsv);
  let length = 0;
  for (const count of termFrequencies.values()) length += count;
  return { id, termFrequencies, length };
}

export const inverseDocumentFrequency = (
  documentFrequency: number,
  totalDocuments: number,
): number => Math.log(1 + (totalDocuments - documentFrequency + 0.5) / (documentFrequency + 0.5));

export function bm25Score(
  queryLexemes: string[],
  document: Bm25Document,
  stats: Bm25Stats,
  { k1 = 1.2, b = 0.75 }: Bm25Options = {},
): number {
  let score = 0;
  const lengthNorm = 1 - b + b * (document.length / (stats.averageLength || 1));
  for (const lexeme of queryLexemes) {
    const tf = document.termFrequencies.get(lexeme) ?? 0;
    if (!tf) continue;
    const idf = inverseDocumentFrequency(
      stats.documentFrequency.get(lexeme) ?? 0,
      stats.totalDocuments,
    );
    score += idf * ((tf * (k1 + 1)) / (tf + k1 * lengthNorm));
  }
  return score;
}

/** Scores and sorts candidates, dropping zero scores. */
export function rankBm25(
  queryLexemes: string[],
  documents: Bm25Document[],
  stats: Bm25Stats,
  options?: Bm25Options,
): { id: string; score: number }[] {
  const unique = Array.from(new Set(queryLexemes));
  return documents
    .map((document) => ({ id: document.id, score: bm25Score(unique, document, stats, options) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
