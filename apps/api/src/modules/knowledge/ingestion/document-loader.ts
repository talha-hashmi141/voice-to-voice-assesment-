import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import matter from 'gray-matter';
import { type DocumentInput } from '../entities';

export const checksumOf = (
  input: Pick<DocumentInput, 'title' | 'content' | 'category' | 'tags'>,
): string =>
  createHash('sha256')
    .update(JSON.stringify([input.title, input.category, input.tags, input.content]))
    .digest('hex');

const toTitle = (slug: string): string =>
  slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

/** Reads markdown documents with YAML front-matter from a directory. */
@Injectable()
export class DocumentLoader {
  parse(markdown: string, slug: string, sourcePath?: string): DocumentInput {
    const { data, content } = matter(markdown);
    const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];
    return {
      slug,
      title:
        typeof data.title === 'string' && data.title.trim() ? data.title.trim() : toTitle(slug),
      category:
        typeof data.category === 'string' && data.category.trim()
          ? data.category.trim()
          : 'general',
      tags,
      content: content.trim(),
      sourcePath: sourcePath ?? null,
      metadata: typeof data.summary === 'string' ? { summary: data.summary } : {},
    };
  }

  async loadDirectory(directory: string): Promise<DocumentInput[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = entries
      .filter(
        (entry) =>
          entry.isFile() && ['.md', '.markdown'].includes(extname(entry.name).toLowerCase()),
      )
      .map((entry) => entry.name)
      .sort();
    return Promise.all(
      files.map(async (file) => {
        const path = join(directory, file);
        const markdown = await readFile(path, 'utf8');
        return this.parse(markdown, basename(file, extname(file)), path);
      }),
    );
  }
}
