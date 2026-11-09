import { DocumentChunker } from './document-chunker';
import { splitTextRecursively } from './recursive-text-splitter';
import { countTokens } from './tokens';

const sentence = (i: number) => `Sentence number ${i} explains an important policy detail about expenses.`;
const longParagraphs = Array.from({ length: 6 }, (_, p) =>
  Array.from({ length: 12 }, (_, i) => sentence(p * 12 + i)).join(' '),
).join('\n\n');

describe('splitTextRecursively', () => {
  it('never exceeds maxTokens and overlaps consecutive chunks', () => {
    const chunks = splitTextRecursively(longParagraphs, { maxTokens: 120, overlapTokens: 30 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(countTokens(chunk)).toBeLessThanOrEqual(120 + 30);
    // the second chunk starts with the tail of the first one
    const firstTail = chunks[0]!.split(' ').slice(-4).join(' ');
    expect(chunks[1]).toContain(firstTail);
  });

  it('returns the text untouched when it already fits', () => {
    expect(splitTextRecursively('short text', { maxTokens: 50, overlapTokens: 10 })).toEqual(['short text']);
  });
});

describe('DocumentChunker', () => {
  const chunker = new DocumentChunker();
  const markdown = `# Expense Policy\n\n## Receipts\n\nA receipt is required for every expense above $25.\n\n## Tiny\n\nShort note.\n\n## Per diem\n\n${longParagraphs}\n`;

  it('produces ordered chunks with section paths and contextual headers', () => {
    const chunks = chunker.chunk('Expense Policy', markdown, { maxTokens: 150, overlapTokens: 20, minTokens: 40 });
    expect(chunks.map((c) => c.ordinal)).toEqual(chunks.map((_, i) => i));
    expect(chunks[0]?.sectionPath).toBe('Receipts');
    expect(chunks[0]?.embeddedText).toContain(
      'Document: Expense Policy\nSection: Receipts\n\nA receipt is required for every expense above $25.',
    );
    expect(chunks.filter((c) => c.sectionPath === 'Per diem').length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.tokenCount).toBeLessThanOrEqual(170);
  });

  it('merges tiny sections into the previous chunk of the same parent', () => {
    const chunks = chunker.chunk('Expense Policy', markdown, { maxTokens: 150, overlapTokens: 20, minTokens: 40 });
    expect(chunks[0]?.content).toContain('Short note.');
    expect(chunks[0]?.content).toContain('Tiny');
    expect(chunks.some((c) => c.sectionPath === 'Tiny')).toBe(false);
  });
});
