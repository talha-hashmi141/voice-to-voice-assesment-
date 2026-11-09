import { CitationRegistry } from '../tools';
import { extractCitations, stripForSpeech } from './citation-extractor';

const registry = () => {
  const r = new CitationRegistry();
  for (let i = 1; i <= 3; i += 1) {
    r.register({ chunkId: `chunk-${i}`, documentId: 'd', documentSlug: 'doc', documentTitle: `Doc ${i}`, sectionPath: 'S', excerpt: 'x', score: 0.5 });
  }
  return r;
};

describe('extractCitations', () => {
  it('renumbers markers in order of appearance and returns matching sources', () => {
    const result = extractCitations('Carry over five days [3]. Request two weeks ahead [1], see also [3].', registry());
    expect(result.text).toBe('Carry over five days [1]. Request two weeks ahead [2], see also [1].');
    expect(result.sources.map((s) => [s.index, s.documentTitle])).toEqual([
      [1, 'Doc 3'],
      [2, 'Doc 1'],
    ]);
  });

  it('drops markers that do not resolve and handles grouped markers', () => {
    const result = extractCitations('Fact [9]. Other fact [1, 2].', registry());
    expect(result.text).toBe('Fact. Other fact [1, 2].');
    expect(result.sources).toHaveLength(2);
  });

  it('produces clean spoken text', () => {
    const result = extractCitations('**Twenty** days a year [1]. Use `OrbitHR` .', registry());
    expect(result.spokenText).toBe('Twenty days a year. Use OrbitHR.');
    expect(stripForSpeech('# Title\n- one\n- two')).toBe('Title\none\ntwo');
  });
});
