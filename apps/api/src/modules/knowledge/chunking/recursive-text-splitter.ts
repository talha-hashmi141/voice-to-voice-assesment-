import { countTokens } from './tokens';

export interface SplitOptions {
  maxTokens: number;
  overlapTokens: number;
}

const SEPARATORS: RegExp[] = [/\n\s*\n/u, /\n/u, /(?<=[.!?])\s+/u, /\s+/u];

function splitBy(text: string, separator: RegExp): string[] {
  return text
    .split(separator)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Recursively splits text to fit `maxTokens`, trying paragraph → line → sentence → word
 * boundaries, then packs adjacent pieces greedily and prepends a sentence-level overlap
 * from the previous chunk so facts spanning a boundary are retrievable from either side.
 */
export function splitTextRecursively(text: string, options: SplitOptions): string[] {
  const pieces = splitToPieces(text.trim(), options.maxTokens, 0);
  const packed = packPieces(pieces, options.maxTokens);
  return applyOverlap(packed, options.overlapTokens);
}

function splitToPieces(text: string, maxTokens: number, depth: number): string[] {
  if (!text) return [];
  if (countTokens(text) <= maxTokens || depth >= SEPARATORS.length) return [text];
  const parts = splitBy(text, SEPARATORS[depth]!);
  if (parts.length <= 1) return splitToPieces(text, maxTokens, depth + 1);
  return parts.flatMap((part) =>
    countTokens(part) <= maxTokens ? [part] : splitToPieces(part, maxTokens, depth + 1),
  );
}

function packPieces(pieces: string[], maxTokens: number): string[] {
  const chunks: string[] = [];
  let current = '';
  let currentTokens = 0;
  for (const piece of pieces) {
    const pieceTokens = countTokens(piece);
    if (current && currentTokens + pieceTokens + 1 > maxTokens) {
      chunks.push(current);
      current = piece;
      currentTokens = pieceTokens;
    } else {
      current = current ? `${current}\n${piece}` : piece;
      currentTokens += pieceTokens + (current === piece ? 0 : 1);
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Takes trailing sentences from the previous chunk (up to overlapTokens) and prepends them. */
function applyOverlap(chunks: string[], overlapTokens: number): string[] {
  if (overlapTokens <= 0 || chunks.length < 2) return chunks;
  return chunks.map((chunk, index) => {
    if (index === 0) return chunk;
    const previous = chunks[index - 1]!;
    const sentences = splitBy(previous, /(?<=[.!?])\s+|\n/u);
    const carried: string[] = [];
    let tokens = 0;
    for (let i = sentences.length - 1; i >= 0; i -= 1) {
      const sentence = sentences[i]!;
      const sentenceTokens = countTokens(sentence);
      if (tokens + sentenceTokens > overlapTokens) break;
      carried.unshift(sentence);
      tokens += sentenceTokens;
    }
    return carried.length ? `${carried.join(' ')}\n${chunk}` : chunk;
  });
}
