import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DocumentChunker } from './chunking';
import { DocumentLoader, INGESTION_QUEUE, IngestionProcessor, IngestionQueueService, IngestionService } from './ingestion';
import { KnowledgeController } from './knowledge.controller';
import { ChunkRepository, DocumentRepository } from './repositories';
import { NoopReranker, RERANKER, RetrievalEvaluator, RetrievalService } from './retrieval';

@Module({
  imports: [BullModule.registerQueue({ name: INGESTION_QUEUE })],
  controllers: [KnowledgeController],
  providers: [
    DocumentRepository,
    ChunkRepository,
    DocumentChunker,
    DocumentLoader,
    IngestionService,
    IngestionQueueService,
    IngestionProcessor,
    RetrievalService,
    RetrievalEvaluator,
    { provide: RERANKER, useClass: NoopReranker },
  ],
  exports: [RetrievalService, RetrievalEvaluator, IngestionService, DocumentRepository, ChunkRepository],
})
export class KnowledgeModule {}
