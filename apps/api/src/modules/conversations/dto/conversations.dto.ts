import {
  ConversationDetailSchema,
  ConversationListResponseSchema,
  ConversationSchema,
  CreateConversationRequestSchema,
} from '@voice-agent/contracts';
import { createZodDto } from 'nestjs-zod';

export class ConversationDto extends createZodDto(ConversationSchema) {}
export class ConversationDetailDto extends createZodDto(ConversationDetailSchema) {}
export class ConversationListResponseDto extends createZodDto(ConversationListResponseSchema) {}
export class CreateConversationRequestDto extends createZodDto(CreateConversationRequestSchema) {}
