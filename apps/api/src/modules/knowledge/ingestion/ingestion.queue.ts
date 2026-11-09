import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { type IngestionJob, type IngestionJobStatus } from '@voice-agent/contracts';
import { type Job, Queue } from 'bullmq';
import { toIso } from '../../../common';
import { IngestionService } from './ingestion.service';

export const INGESTION_QUEUE = 'ingestion';
export const INGEST_DOCUMENT_JOB = 'ingest-document';

export interface IngestDocumentJobData {
  slug: string;
  force: boolean;
}

/** Enqueues indexing work and exposes job status to the API. */
@Injectable()
export class IngestionQueueService {
  constructor(@InjectQueue(INGESTION_QUEUE) private readonly queue: Queue<IngestDocumentJobData>) {}

  async enqueue(data: IngestDocumentJobData): Promise<IngestionJob> {
    const job = await this.queue.add(INGEST_DOCUMENT_JOB, data, {
      jobId: `${data.slug}-${Date.now()}`,
    });
    return this.toDto(job);
  }

  async getJob(id: string): Promise<IngestionJob | null> {
    const job = await this.queue.getJob(id);
    return job ? this.toDto(job) : null;
  }

  async recentJobs(limit = 50): Promise<IngestionJob[]> {
    const jobs = await this.queue.getJobs(
      ['waiting', 'active', 'completed', 'failed', 'delayed'],
      0,
      limit - 1,
    );
    const dtos = await Promise.all(jobs.map((job) => this.toDto(job)));
    return dtos.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  private async toDto(job: Job<IngestDocumentJobData>): Promise<IngestionJob> {
    const state = await job.getState();
    const status: IngestionJobStatus =
      state === 'completed'
        ? 'completed'
        : state === 'failed'
          ? 'failed'
          : state === 'active'
            ? 'active'
            : 'queued';
    const progress =
      typeof job.progress === 'number' ? job.progress : status === 'completed' ? 100 : 0;
    return {
      id: String(job.id),
      documentSlug: job.data.slug,
      status,
      progress,
      error: job.failedReason || null,
      createdAt: toIso(new Date(job.timestamp)),
      finishedAt: job.finishedOn ? toIso(new Date(job.finishedOn)) : null,
    };
  }
}

/** BullMQ worker: runs the chunk → embed → store pipeline off the request path. */
@Processor(INGESTION_QUEUE, { concurrency: 2 })
export class IngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestionProcessor.name);

  constructor(private readonly ingestion: IngestionService) {
    super();
  }

  async process(job: Job<IngestDocumentJobData>): Promise<{ chunks: number; skipped: boolean }> {
    this.logger.log(`Job ${job.id}: indexing "${job.data.slug}" (force=${job.data.force})`);
    const result = await this.ingestion.indexDocument(job.data.slug, {
      force: job.data.force,
      onProgress: (percent) => job.updateProgress(percent),
    });
    return { chunks: result.chunks, skipped: result.skipped };
  }
}
