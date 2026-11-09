import {
  DocumentDetailSchema,
  DocumentListResponseSchema,
  IngestionJobListResponseSchema,
  IngestionJobSchema,
  ReindexQuerySchema,
  ReindexResponseSchema,
  SearchRequestSchema,
  SearchResponseSchema,
  UploadDocumentRequestSchema,
  UploadDocumentResponseSchema,
} from '@voice-agent/contracts';
import { createZodDto } from 'nestjs-zod';

export class SearchRequestDto extends createZodDto(SearchRequestSchema) {}
export class SearchResponseDto extends createZodDto(SearchResponseSchema) {}
export class DocumentListResponseDto extends createZodDto(DocumentListResponseSchema) {}
export class DocumentDetailDto extends createZodDto(DocumentDetailSchema) {}
export class UploadDocumentRequestDto extends createZodDto(UploadDocumentRequestSchema) {}
export class UploadDocumentResponseDto extends createZodDto(UploadDocumentResponseSchema) {}
export class IngestionJobDto extends createZodDto(IngestionJobSchema) {}
export class IngestionJobListResponseDto extends createZodDto(IngestionJobListResponseSchema) {}
export class ReindexResponseDto extends createZodDto(ReindexResponseSchema) {}
export class ReindexQueryDto extends createZodDto(ReindexQuerySchema) {}
