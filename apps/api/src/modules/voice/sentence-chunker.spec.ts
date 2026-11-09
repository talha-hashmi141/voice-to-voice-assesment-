import { SentenceChunker } from './sentence-chunker';

const stream = (text: string, size = 4): string[] => {
  const chunker = new SentenceChunker();
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(...chunker.push(text.slice(i, i + size)));
  const rest = chunker.flush();
  if (rest) out.push(rest);
  return out;
};

describe('SentenceChunker', () => {
  it('splits streamed tokens into sentences at terminators', () => {
    expect(
      stream('You get twenty days a year. Up to five days carry over! Anything else?'),
    ).toEqual(['You get twenty days a year.', 'Up to five days carry over!', 'Anything else?']);
  });

  it('does not split on decimals, abbreviations or very short fragments', () => {
    expect(
      stream('The hotel cap is $250.50 per night, e.g. in London. Ask Mr. Smith for details.'),
    ).toEqual([
      'The hotel cap is $250.50 per night, e.g. in London.',
      'Ask Mr. Smith for details.',
    ]);
    expect(stream('Yes. That is the rule for new hires.')).toEqual([
      'Yes. That is the rule for new hires.',
    ]);
  });

  it('waits for the token after a terminator before emitting', () => {
    const chunker = new SentenceChunker();
    expect(chunker.push('Twenty days per year.')).toEqual([]);
    expect(chunker.push(' Five')).toEqual(['Twenty days per year.']);
    expect(chunker.flush()).toBe('Five');
  });

  it('force-breaks very long runs without punctuation', () => {
    const long = Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ');
    const out = stream(long, 10);
    expect(out.length).toBeGreaterThan(1);
    expect(out.join(' ')).toBe(long);
  });
});
