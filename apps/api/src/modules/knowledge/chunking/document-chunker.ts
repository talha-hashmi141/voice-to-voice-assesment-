import { Injectable } from '@nestjs/common';
import { buildEmbeddedText, joinSectionPath } from './contextual-header';
import { splitMarkdownSections } from './markdown-section-splitter';
import { splitTextRecursively } from './recursive-text-splitter';
import { countTokens } from './tokens';

export interface ChunkingOptions {
  maxTokens: number;
  overlapTokens: number;
  /** Sections smaller than this are merged into the previous chunk of the same parent when it fits. */
  minTokens: number;
}

export const DEFAULT_CHUNKING_OPTIONS: ChunkingOptions = {
  maxTokens: 400,
  overlapTokens: 60,
  minTokens: 40,
};

export interface DocumentChunk {
  ordinal: number;
  sectionPath: string;
  content: string;
  embeddedText: string;
  tokenCount: number;
}

/**
 * Structure-aware chunker: split by markdown headings, then recursively by paragraph /
 * sentence within oversized sections, merge tiny sections, and prefix every chunk with
 * a contextual header for embedding.
 */
@Injectable()
export class DocumentChunker {
  chunk(
    documentTitle: string,
    markdown: string,
    options: ChunkingOptions = DEFAULT_CHUNKING_OPTIONS,
  ): DocumentChunk[] {
    const sections = splitMarkdownSections(markdown, documentTitle);
    const drafts: { sectionPath: string; parent: string; content: string }[] = [];

    for (const section of sections) {
      const sectionPath = joinSectionPath(section.path);
      const parent = joinSectionPath(section.path.slice(0, -1));
      const previous = drafts[drafts.length - 1];
      const tokens = countTokens(section.content);

      // Merge small sections into the previous chunk of the same parent when it still fits.
      if (
        previous &&
        tokens < options.minTokens &&
        previous.parent === parent &&
        countTokens(previous.content) + tokens < options.maxTokens
      ) {
        const heading = section.path[section.path.length - 1] ?? '';
        previous.content = `${previous.content}\n\n${heading}\n${section.content}`;
        continue;
      }

      const pieces =
        tokens <= options.maxTokens
          ? [section.content]
          : splitTextRecursively(section.content, {
              maxTokens: options.maxTokens,
              overlapTokens: options.overlapTokens,
            });
      pieces.forEach((content) => drafts.push({ sectionPath, parent, content }));
    }

    return drafts.map((draft, ordinal) => ({
      ordinal,
      sectionPath: draft.sectionPath,
      content: draft.content,
      embeddedText: buildEmbeddedText(documentTitle, draft.sectionPath, draft.content),
      tokenCount: countTokens(draft.content),
    }));
  }
}
