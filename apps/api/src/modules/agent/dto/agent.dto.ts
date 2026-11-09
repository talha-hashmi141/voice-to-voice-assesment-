import { TurnRequestSchema, TurnResponseSchema } from '@voice-agent/contracts';
import { createZodDto } from 'nestjs-zod';

export class TurnRequestDto extends createZodDto(TurnRequestSchema) {}
export class TurnResponseDto extends createZodDto(TurnResponseSchema) {}
