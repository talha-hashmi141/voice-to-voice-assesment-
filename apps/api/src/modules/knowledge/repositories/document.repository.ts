import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { DATABASE, type Database, documents, type DocumentRow } from '../../../common';
import { type DocumentInput } from '../entities';

export interface DocumentWithStats extends DocumentRow {
  chunkCount: number;
  tokenCount: number;
}

@Injectable()
export class DocumentRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * Correlated subqueries are written with explicit table qualification: Drizzle renders
   * column references unqualified inside sql`` templates, which would make the inner
   * "id" resolve to chunks.id.
   */
  private readonly statsSelection = {
    chunkCount: sql<number>`(select count(*)::int from chunks c where c.document_id = documents.id)`,
    tokenCount: sql<number>`(select coalesce(sum(c.token_count), 0)::int from chunks c where c.document_id = documents.id)`,
  };

  async findAll(): Promise<DocumentWithStats[]> {
    return this.db
      .select({ ...documentColumns(), ...this.statsSelection })
      .from(documents)
      .orderBy(documents.category, documents.title);
  }

  async findById(id: string): Promise<DocumentWithStats | null> {
    const [row] = await this.db
      .select({ ...documentColumns(), ...this.statsSelection })
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    return row ?? null;
  }

  async findBySlug(slug: string): Promise<DocumentRow | null> {
    const [row] = await this.db.select().from(documents).where(eq(documents.slug, slug)).limit(1);
    return row ?? null;
  }

  /** Inserts or updates by slug; returns the row and whether the content checksum changed. */
  async upsert(
    input: DocumentInput,
    checksum: string,
  ): Promise<{ row: DocumentRow; changed: boolean }> {
    const existing = await this.findBySlug(input.slug);
    if (existing && existing.checksum === checksum) {
      return { row: existing, changed: false };
    }
    const [row] = await this.db
      .insert(documents)
      .values({
        slug: input.slug,
        title: input.title,
        category: input.category,
        tags: input.tags,
        content: input.content,
        sourcePath: input.sourcePath ?? null,
        metadata: input.metadata ?? {},
        checksum,
        embeddingModel: null,
      })
      .onConflictDoUpdate({
        target: documents.slug,
        set: {
          title: input.title,
          category: input.category,
          tags: input.tags,
          content: input.content,
          sourcePath: input.sourcePath ?? null,
          metadata: input.metadata ?? {},
          checksum,
          embeddingModel: null,
          updatedAt: new Date(),
        },
      })
      .returning();
    return { row: row!, changed: true };
  }

  async markIndexed(id: string, embeddingModel: string): Promise<void> {
    await this.db
      .update(documents)
      .set({ embeddingModel, updatedAt: new Date() })
      .where(eq(documents.id, id));
  }

  async deleteBySlug(slug: string): Promise<boolean> {
    const deleted = await this.db
      .delete(documents)
      .where(eq(documents.slug, slug))
      .returning({ id: documents.id });
    return deleted.length > 0;
  }

  async findStale(embeddingModel: string): Promise<DocumentRow[]> {
    return this.db
      .select()
      .from(documents)
      .where(and(sql`${documents.embeddingModel} is distinct from ${embeddingModel}`))
      .orderBy(desc(documents.updatedAt));
  }
}

function documentColumns() {
  return {
    id: documents.id,
    slug: documents.slug,
    title: documents.title,
    category: documents.category,
    tags: documents.tags,
    sourcePath: documents.sourcePath,
    content: documents.content,
    checksum: documents.checksum,
    embeddingModel: documents.embeddingModel,
    metadata: documents.metadata,
    createdAt: documents.createdAt,
    updatedAt: documents.updatedAt,
  };
}
