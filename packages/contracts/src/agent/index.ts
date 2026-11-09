import { z } from 'zod';
import { IdSchema } from '../common';
import { MessageSchema } from '../conversations';
import { UserContextSchema } from '../user-context';

/** Outcome of evaluating a knowledge-base retrieval, drives reformulate / abstain / clarify. */
export const RetrievalAssessmentSchema = z.enum(['strong', 'weak', 'none']);
export type RetrievalAssessment = z.infer<typeof RetrievalAssessmentSchema>;

export const TurnRequestSchema = z.object({
  conversationId: IdSchema.optional(),
  text: z.string().trim().min(1).max(2000),
  userContext: UserContextSchema.optional(),
});
export type TurnRequest = z.infer<typeof TurnRequestSchema>;

export const TurnResponseSchema = z.object({
  conversationId: IdSchema,
  turnId: z.string(),
  userMessage: MessageSchema,
  assistantMessage: MessageSchema,
});
export type TurnResponse = z.infer<typeof TurnResponseSchema>;
