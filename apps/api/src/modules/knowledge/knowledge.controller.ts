import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type IngestionJob } from '@voice-agent/contracts';
import { ZodSerializerDto } from 'nestjs-zod';
import { AppConfigService, shortReference } from '../../common';
import {
  DocumentDetailDto,
  DocumentListResponseDto,
  IngestionJobDto,
  IngestionJobListResponseDto,
  ReindexQueryDto,
  ReindexResponseDto,
  SearchRequestDto,
  SearchResponseDto,
  UploadDocumentRequestDto,
  UploadDocumentResponseDto,
} from './dto';
import { IngestionQueueService, IngestionService } from './ingestion';
import { KNOWLEDGE_BASE_DIR } from './knowledge.constants';
import { slugify, toDocumentDetail, toDocumentSummary } from './knowledge.mappers';
import { ChunkRepository, DocumentRepository } from './repositories';
import { RetrievalService } from './retrieval';

@ApiTags('knowledge')
@Controller('knowledge')
export class KnowledgeController {
  constructor(
    private readonly documents: DocumentRepository,
    private readonly chunks: ChunkRepository,
    private readonly retrieval: RetrievalService,
    private readonly ingestion: IngestionService,
    private readonly jobs: IngestionQueueService,
    private readonly config: AppConfigService,
  ) {}

  @Get('documents')
  @ApiOperation({ summary: 'List knowledge-base documents with chunk statistics' })
  @ApiOkResponse({ type: DocumentListResponseDto })
  @ZodSerializerDto(DocumentListResponseDto)
  async listDocuments(): Promise<DocumentListResponseDto> {
    const rows = await this.documents.findAll();
    return { documents: rows.map(toDocumentSummary) };
  }

  @Get('documents/:id')
  @ApiOperation({ summary: 'Get a document with its full content and section breakdown' })
  @ApiOkResponse({ type: DocumentDetailDto })
  @ZodSerializerDto(DocumentDetailDto)
  async getDocument(@Param('id') id: string): Promise<DocumentDetailDto> {
    const row = await this.documents.findById(id);
    if (!row) throw new NotFoundException(`Document ${id} not found`);
    const chunks = await this.chunks.findByDocument(id);
    return toDocumentDetail(row, chunks);
  }

  @Post('documents')
  @ApiOperation({ summary: 'Upload a markdown document; indexing runs asynchronously on the ingestion queue' })
  @ApiOkResponse({ type: UploadDocumentResponseDto })
  @ZodSerializerDto(UploadDocumentResponseDto)
  async uploadDocument(@Body() body: UploadDocumentRequestDto): Promise<UploadDocumentResponseDto> {
    const base = slugify(body.title);
    const slug = (await this.documents.findBySlug(base)) ? `${base}-${shortReference('').slice(1).toLowerCase()}` : base;
    const saved = await this.ingestion.saveDocument({
      slug,
      title: body.title,
      category: body.category,
      tags: body.tags,
      content: body.content,
      sourcePath: null,
      metadata: { uploaded: true },
    });
    const job = await this.jobs.enqueue({ slug: saved.slug, force: true });
    const row = await this.documents.findById(saved.id);
    return { document: toDocumentSummary(row!), job };
  }

  @Delete('documents/:slug')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a document and its chunks' })
  async deleteDocument(@Param('slug') slug: string): Promise<void> {
    await this.ingestion.removeDocument(slug);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hybrid semantic search (dense + full-text, RRF-fused) with per-channel scores' })
  @ApiOkResponse({ type: SearchResponseDto })
  @ZodSerializerDto(SearchResponseDto)
  async search(@Body() body: SearchRequestDto): Promise<SearchResponseDto> {
    const outcome = await this.retrieval.search({
      queries: [body.query],
      topK: body.topK,
      mode: body.mode,
      rerank: this.config.agent.rerankEnabled,
    });
    return { query: body.query, mode: body.mode, hits: outcome.hits, tookMs: outcome.tookMs };
  }

  @Post('reindex')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Re-scan the knowledge-base folder and queue indexing jobs for changed (or all, with force=true) documents' })
  @ApiOkResponse({ type: ReindexResponseDto })
  @ZodSerializerDto(ReindexResponseDto)
  async reindex(@Query() query: ReindexQueryDto): Promise<ReindexResponseDto> {
    const inputs = await this.ingestion.loadDirectory(KNOWLEDGE_BASE_DIR);
    const jobs: IngestionJob[] = [];
    for (const input of inputs) {
      const saved = await this.ingestion.saveDocument(input);
      jobs.push(await this.jobs.enqueue({ slug: saved.slug, force: query.force || saved.changed }));
    }
    return { jobs };
  }

  @Get('jobs')
  @ApiOperation({ summary: 'Recent ingestion jobs' })
  @ApiOkResponse({ type: IngestionJobListResponseDto })
  @ZodSerializerDto(IngestionJobListResponseDto)
  async listJobs(): Promise<IngestionJobListResponseDto> {
    return { jobs: await this.jobs.recentJobs() };
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Ingestion job status' })
  @ApiOkResponse({ type: IngestionJobDto })
  @ZodSerializerDto(IngestionJobDto)
  async getJob(@Param('id') id: string): Promise<IngestionJobDto> {
    const job = await this.jobs.getJob(id);
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    return job;
  }
}
