import { MockEmbeddingProvider, tokenizeForHashing } from './mock-embedding.provider';

const cosine = (a: number[], b: number[]) =>
  a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);

describe('MockEmbeddingProvider', () => {
  const provider = new MockEmbeddingProvider();

  it('produces unit-length vectors of the configured dimension', async () => {
    const [vector] = await provider.embed(['Expense reports must be submitted within 30 days']);
    expect(vector).toHaveLength(provider.dimensions);
    expect(Math.sqrt(vector!.reduce((s, v) => s + v * v, 0))).toBeCloseTo(1, 5);
  });

  it('is deterministic', async () => {
    const [a] = await provider.embed(['hello world']);
    const [b] = await provider.embed(['hello world']);
    expect(a).toEqual(b);
  });

  it('scores lexically related texts higher than unrelated ones', async () => {
    const [query, related, unrelated] = await provider.embed([
      'how many vacation days do I get each year',
      'Every full-time employee receives 20 days of paid vacation per calendar year',
      'Passwords must be at least 14 characters long and MFA is mandatory',
    ]);
    expect(cosine(query!, related!)).toBeGreaterThan(cosine(query!, unrelated!));
  });

  it('normalises simple plural/verb suffixes and drops stopwords', () => {
    expect(tokenizeForHashing('The days were submitted')).toEqual(['day', 'submit']);
    expect(tokenizeForHashing('company policies for running')).toEqual([
      'company',
      'policy',
      'run',
    ]);
  });
});
