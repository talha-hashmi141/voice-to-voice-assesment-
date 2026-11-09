import { checksumOf, DocumentLoader } from './document-loader';

describe('DocumentLoader', () => {
  const loader = new DocumentLoader();

  it('parses front-matter and falls back to a title derived from the slug', () => {
    const parsed = loader.parse(
      '---\ntitle: PTO Policy\ncategory: hr\ntags: [pto, leave]\nsummary: s\n---\n# Body\n',
      'pto-policy',
    );
    expect(parsed).toMatchObject({
      slug: 'pto-policy',
      title: 'PTO Policy',
      category: 'hr',
      tags: ['pto', 'leave'],
    });
    expect(parsed.content).toBe('# Body');
    expect(parsed.metadata).toEqual({ summary: 's' });

    const bare = loader.parse('plain text', 'remote-work-policy');
    expect(bare.title).toBe('Remote Work Policy');
    expect(bare.category).toBe('general');
  });

  it('checksums change when the content changes and are stable otherwise', () => {
    const a = loader.parse('---\ntitle: T\n---\nhello', 'a');
    const b = loader.parse('---\ntitle: T\n---\nhello', 'a');
    const c = loader.parse('---\ntitle: T\n---\nhello!', 'a');
    expect(checksumOf(a)).toBe(checksumOf(b));
    expect(checksumOf(a)).not.toBe(checksumOf(c));
  });
});
