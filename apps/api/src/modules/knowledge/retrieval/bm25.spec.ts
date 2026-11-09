import {
  bm25Score,
  inverseDocumentFrequency,
  parseTsVector,
  rankBm25,
  toBm25Document,
} from './bm25';

describe('parseTsVector', () => {
  it('counts occurrences from positions and handles weights and quotes', () => {
    const frequencies = parseTsVector(`'claim':3,7 'expens':1A,9 'o''brien':2 'day':4`);
    expect(Object.fromEntries(frequencies)).toEqual({ claim: 2, expens: 2, "o'brien": 1, day: 1 });
  });
});

describe('bm25', () => {
  const docs = [
    toBm25Document(
      'expense',
      `'submit':1 'expens':2,8 'within':3 'day':4,9 'claim':5 'receipt':6 'busi':7`,
    ),
    toBm25Document(
      'equipment',
      `'busi':1,5,9 'day':2,6,10 'loaner':3 'laptop':4 'repair':7 'courier':8`,
    ),
    toBm25Document('holidays', `'holiday':1 'day':2 'decemb':3 'close':4`),
  ];
  const stats = {
    totalDocuments: 3,
    averageLength: docs.reduce((n, d) => n + d.length, 0) / 3,
    documentFrequency: new Map([
      ['busi', 2],
      ['day', 3],
      ['claim', 1],
      ['expens', 1],
      ['holiday', 1],
    ]),
  };

  it('weights rare terms above frequent ones', () => {
    expect(inverseDocumentFrequency(1, 3)).toBeGreaterThan(inverseDocumentFrequency(3, 3));
    const ranked = rankBm25(['claim', 'busi', 'day'], docs, stats);
    expect(ranked[0]?.id).toBe('expense');
    expect(ranked.map((r) => r.id)).not.toContain('nothing');
  });

  it('does not let a document win by repeating a common word', () => {
    const equipment = docs[1]!;
    const expense = docs[0]!;
    expect(bm25Score(['busi', 'day'], equipment, stats)).toBeLessThan(
      bm25Score(['claim', 'expens'], expense, stats) * 2,
    );
  });

  it('drops documents without any query term', () => {
    expect(rankBm25(['holiday'], docs, stats).map((r) => r.id)).toEqual(['holidays']);
    expect(rankBm25(['unknown'], docs, stats)).toEqual([]);
  });
});
