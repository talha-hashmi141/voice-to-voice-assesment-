import { type Source } from '@voice-agent/contracts';
import { type CitationRegistry } from '../tools';

export interface ExtractedCitations {
  /** Text with citation markers renumbered 1..n in order of first appearance. */
  text: string;
  /** Text without markers or markdown, for speech synthesis. */
  spokenText: string;
  sources: Source[];
}

const MARKER = /\[(\d+(?:\s*[,，]\s*\d+)*)\]/gu;

/** Removes citation markers and light markdown so TTS reads clean prose. */
export function stripForSpeech(text: string): string {
  return text
    .replace(MARKER, '')
    .replace(/\*\*(.+?)\*\*/gu, '$1')
    .replace(/\*(.+?)\*/gu, '$1')
    .replace(/`([^`]+)`/gu, '$1')
    .replace(/^#{1,6}\s+/gmu, '')
    .replace(/^\s*[-*•]\s+/gmu, '')
    .replace(/\s+([.,;:!?])/gu, '$1')
    .replace(/[ \t]{2,}/gu, ' ')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

/**
 * Maps [n] markers in the model's answer to the registry's passages, drops markers that do
 * not resolve, renumbers the rest in order of appearance, and produces the spoken variant.
 */
export function extractCitations(text: string, registry: CitationRegistry): ExtractedCitations {
  const renumbered = new Map<number, number>();
  const sources: Source[] = [];

  const rewritten = text.replace(MARKER, (_match, group: string) => {
    const indices = group
      .split(/[,，]/u)
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);
    const resolved: number[] = [];
    for (const index of indices) {
      const source = registry.get(index);
      if (!source) continue;
      let next = renumbered.get(index);
      if (next === undefined) {
        next = sources.length + 1;
        renumbered.set(index, next);
        sources.push({ ...source, index: next });
      }
      if (!resolved.includes(next)) resolved.push(next);
    }
    return resolved.length ? `[${resolved.join(', ')}]` : '';
  });

  const cleaned = rewritten.replace(/\s+([.,;:!?])/gu, '$1').replace(/[ \t]{2,}/gu, ' ').trim();
  return { text: cleaned, spokenText: stripForSpeech(cleaned), sources };
}
