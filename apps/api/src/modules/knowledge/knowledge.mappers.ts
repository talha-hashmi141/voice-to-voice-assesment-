import { type DocumentDetail, type DocumentSummary } from '@voice-agent/contracts';
import { toIso } from '../../common';
import { type RetrievedChunk } from './entities';
import { type DocumentWithStats } from './repositories';

export const toDocumentSummary = (row: DocumentWithStats): DocumentSummary => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  category: row.category,
  tags: row.tags ?? [],
  chunkCount: row.chunkCount,
  tokenCount: row.tokenCount,
  updatedAt: toIso(row.updatedAt),
});

export const toDocumentDetail = (
  row: DocumentWithStats,
  chunks: RetrievedChunk[],
): DocumentDetail => {
  const sections = new Map<string, number>();
  for (const chunk of chunks)
    sections.set(chunk.sectionPath, (sections.get(chunk.sectionPath) ?? 0) + 1);
  return {
    ...toDocumentSummary(row),
    content: row.content,
    sections: Array.from(sections, ([path, chunkCount]) => ({ path, chunkCount })),
  };
};

export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'document';
