export type RetrievalChannel = 'dense' | 'sparse';

export interface RankedItem {
  id: string;
  /** Channel-native score: cosine similarity for dense, rank/maxRank for sparse. */
  score: number;
}

export interface RankedList {
  channel: RetrievalChannel;
  /** Items ordered best-first. */
  items: RankedItem[];
}

export interface FusedResult {
  id: string;
  /** Normalised RRF score in [0, 1]; 1 means ranked first in every list. */
  fused: number;
  dense: number | null;
  sparse: number | null;
  /** How many lists the item appeared in. */
  appearances: number;
}

export const DEFAULT_RRF_K = 60;

/**
 * Reciprocal Rank Fusion (Cormack et al. 2009): score(d) = Σ 1 / (k + rank_i(d)).
 * Works across channels with incomparable native scores (cosine vs. BM25-like ranks)
 * and across multiple query phrasings; items that rank well in several lists win.
 */
export function reciprocalRankFusion(lists: RankedList[], k = DEFAULT_RRF_K): FusedResult[] {
  const table = new Map<string, FusedResult & { raw: number }>();
  for (const list of lists) {
    list.items.forEach((item, index) => {
      const entry = table.get(item.id) ?? {
        id: item.id,
        fused: 0,
        dense: null,
        sparse: null,
        appearances: 0,
        raw: 0,
      };
      entry.raw += 1 / (k + index + 1);
      entry.appearances += 1;
      if (list.channel === 'dense') entry.dense = Math.max(entry.dense ?? -Infinity, item.score);
      else entry.sparse = Math.max(entry.sparse ?? -Infinity, item.score);
      table.set(item.id, entry);
    });
  }
  const maxPossible = lists.length / (k + 1) || 1;
  return Array.from(table.values())
    .map(({ raw, ...rest }) => ({ ...rest, fused: Number((raw / maxPossible).toFixed(6)) }))
    .sort((a, b) => b.fused - a.fused || (b.dense ?? 0) - (a.dense ?? 0) || a.id.localeCompare(b.id));
}
