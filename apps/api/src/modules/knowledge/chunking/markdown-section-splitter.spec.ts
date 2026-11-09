import { splitMarkdownSections } from './markdown-section-splitter';

const DOC = `# PTO and Leave Policy

Intro paragraph.

## Allowance

Twenty days per year.

### Accrual

Monthly accrual.

## Carryover

Up to 5 days.

\`\`\`
# not a heading inside a fence
\`\`\`
`;

describe('splitMarkdownSections', () => {
  it('builds a heading hierarchy and drops the repeated document title from paths', () => {
    const sections = splitMarkdownSections(DOC, 'PTO and Leave Policy');
    expect(sections.map((s) => s.path)).toEqual([
      ['PTO and Leave Policy'],
      ['Allowance'],
      ['Allowance', 'Accrual'],
      ['Carryover'],
    ]);
    expect(sections[1]?.content).toBe('Twenty days per year.');
  });

  it('keeps fenced code inside the section instead of treating it as a heading', () => {
    const sections = splitMarkdownSections(DOC, 'PTO and Leave Policy');
    expect(sections[3]?.content).toContain('# not a heading inside a fence');
  });

  it('uses the document title as the path for text without headings', () => {
    const sections = splitMarkdownSections('Just a paragraph.', 'Untitled');
    expect(sections).toEqual([{ path: ['Untitled'], level: 0, content: 'Just a paragraph.' }]);
  });
});
