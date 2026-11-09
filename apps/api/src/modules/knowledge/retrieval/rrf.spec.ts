import { reciprocalRankFusion } from './rrf';

describe('reciprocalRankFusion', () => {
  it('ranks an item first when it tops every list and normalises to 1', () => {
    const fused = reciprocalRankFusion([
      { channel: 'dense', items: [{ id: 'a', score: 0.9 }, { id: 'b', score: 0.5 }] },
      { channel: 'sparse', items: [{ id: 'a', score: 1 }, { id: 'c', score: 0.4 }] },
    ]);
    expect(fused[0]).toMatchObject({ id: 'a', fused: 1, dense: 0.9, sparse: 1, appearances: 2 });
  });

  it('prefers items that appear in several lists over a single high rank', () => {
    const fused = reciprocalRankFusion([
      { channel: 'dense', items: [{ id: 'x', score: 0.8 }, { id: 'y', score: 0.7 }] },
      { channel: 'sparse', items: [{ id: 'z', score: 1 }, { id: 'y', score: 0.9 }] },
    ]);
    expect(fused.map((f) => f.id)).toEqual(['y', 'x', 'z']);
  });

  it('keeps channel-native scores as null when an item is missing from that channel', () => {
    const [only] = reciprocalRankFusion([{ channel: 'dense', items: [{ id: 'a', score: 0.42 }] }]);
    expect(only).toMatchObject({ dense: 0.42, sparse: null, fused: 1 });
  });

  it('returns an empty list when there is nothing to fuse', () => {
    expect(reciprocalRankFusion([])).toEqual([]);
  });
});
