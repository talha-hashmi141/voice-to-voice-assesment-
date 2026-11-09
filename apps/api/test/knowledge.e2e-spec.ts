import { type INestApplication } from '@nestjs/common';
import { type DocumentListResponse, type SearchResponse } from '@voice-agent/contracts';
import request from 'supertest';
import { IngestionService, KNOWLEDGE_BASE_DIR } from '../src/modules/knowledge';
import { createTestApp } from './utils/create-app';

describe('Knowledge API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    await app.get(IngestionService).ingestDirectory(KNOWLEDGE_BASE_DIR);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/knowledge/documents lists indexed documents with chunk statistics', async () => {
    const response = await request(app.getHttpServer()).get('/api/knowledge/documents').expect(200);
    const body = response.body as DocumentListResponse;
    expect(body.documents.length).toBeGreaterThanOrEqual(12);
    const pto = body.documents.find((doc) => doc.slug === 'pto-and-leave-policy');
    expect(pto).toMatchObject({ title: 'PTO and Leave Policy', category: 'hr-policies' });
    expect(pto!.chunkCount).toBeGreaterThan(3);
  });

  it('GET /api/knowledge/documents/:id returns content and section breakdown', async () => {
    const list = (await request(app.getHttpServer()).get('/api/knowledge/documents'))
      .body as DocumentListResponse;
    const id = list.documents[0]!.id;
    const response = await request(app.getHttpServer())
      .get(`/api/knowledge/documents/${id}`)
      .expect(200);
    expect(response.body.content.length).toBeGreaterThan(100);
    expect(response.body.sections.length).toBeGreaterThan(0);
  });

  it('POST /api/knowledge/search returns ranked hits with fused and per-channel scores', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/knowledge/search')
      .send({ query: 'How long do I have to submit expense reports after a trip?', topK: 3 })
      .expect(200);
    const body = response.body as SearchResponse;
    expect(body.mode).toBe('hybrid');
    expect(body.hits).toHaveLength(3);
    expect(body.hits[0]).toMatchObject({ rank: 1, documentSlug: 'expense-and-travel-policy' });
    expect(body.hits[0]!.scores.fused).toBeGreaterThan(0);
    expect(body.hits.map((h) => h.rank)).toEqual([1, 2, 3]);
  });

  it('supports dense-only and sparse-only modes', async () => {
    for (const mode of ['dense', 'sparse'] as const) {
      const response = await request(app.getHttpServer())
        .post('/api/knowledge/search')
        .send({ query: 'company holidays in December', topK: 2, mode })
        .expect(200);
      expect(response.body.mode).toBe(mode);
      expect(response.body.hits.length).toBeGreaterThan(0);
    }
  });

  it('rejects invalid search payloads with a normalised validation error', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/knowledge/search')
      .send({ query: '' })
      .expect(400);
    expect(response.body).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
  });

  it('returns 404 for an unknown document', async () => {
    await request(app.getHttpServer())
      .get('/api/knowledge/documents/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });
});
