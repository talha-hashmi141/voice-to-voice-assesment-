const ABBREVIATIONS = new Set([
  'e.g',
  'i.e',
  'mr',
  'mrs',
  'ms',
  'dr',
  'vs',
  'etc',
  'no',
  'st',
  'approx',
]);
const TERMINATOR = /[.!?]["')\]]?(\s+|$)/u;

export interface SentenceChunkerOptions {
  /** Do not emit sentences shorter than this (characters) – avoids choppy TTS for "Yes." style fragments unless flushed. */
  minChars: number;
  /** Force a break when the buffer exceeds this many characters even without a terminator. */
  maxChars: number;
}

export const DEFAULT_SENTENCE_OPTIONS: SentenceChunkerOptions = { minChars: 20, maxChars: 280 };

/**
 * Incremental sentence boundary detector for streamed LLM tokens. Each completed sentence is
 * handed to TTS immediately, so speech starts after the first sentence rather than the last.
 */
export class SentenceChunker {
  private buffer = '';

  constructor(private readonly options: SentenceChunkerOptions = DEFAULT_SENTENCE_OPTIONS) {}

  /** Appends a token and returns any sentences completed by it. */
  push(delta: string): string[] {
    this.buffer += delta;
    const out: string[] = [];
    let match = this.findBoundary();
    while (match !== null) {
      const sentence = this.buffer.slice(0, match).trim();
      this.buffer = this.buffer.slice(match);
      if (sentence) out.push(sentence);
      match = this.findBoundary();
    }
    if (this.buffer.length > this.options.maxChars) {
      const cut = this.buffer.lastIndexOf(' ', this.options.maxChars);
      if (cut > 0) {
        out.push(this.buffer.slice(0, cut).trim());
        this.buffer = this.buffer.slice(cut);
      }
    }
    return out;
  }

  /** Returns whatever is left (end of stream), or null when empty. */
  flush(): string | null {
    const rest = this.buffer.trim();
    this.buffer = '';
    return rest || null;
  }

  private findBoundary(): number | null {
    const text = this.buffer;
    let from = 0;
    while (from < text.length) {
      const slice = text.slice(from);
      const match = TERMINATOR.exec(slice);
      if (!match) return null;
      const end = from + match.index + match[0].length;
      const candidate = text.slice(0, end);
      const trimmed = candidate.trim();
      // Newline inside the match also counts as a boundary (lists, line breaks).
      const word =
        trimmed
          .replace(/[.!?"')\]]+$/u, '')
          .split(/\s+/u)
          .pop()
          ?.toLowerCase() ?? '';
      const isAbbreviation =
        ABBREVIATIONS.has(word) ||
        (/^\d+$/u.test(word) && /\.\d/u.test(text.slice(end - 1, end + 2)));
      const atEndWithoutSpace = match[0].trim() === match[0] && end === text.length; // terminator at the very end, more may come ("3." → "3.5")
      if (!isAbbreviation && !atEndWithoutSpace && trimmed.length >= this.options.minChars)
        return end;
      from = end;
    }
    return null;
  }
}
