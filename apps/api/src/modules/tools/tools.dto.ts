import { ToolListResponseSchema, ToolUsageResponseSchema } from '@voice-agent/contracts';
import { createZodDto } from 'nestjs-zod';

export class ToolListResponseDto extends createZodDto(ToolListResponseSchema) {}
export class ToolUsageResponseDto extends createZodDto(ToolUsageResponseSchema) {}
