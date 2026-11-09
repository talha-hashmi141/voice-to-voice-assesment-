import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from '../common';
import { UserContextSchema } from '../user-context';

export const MessageRoleSchema = z.enum(['user', 'assistant']);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

/** A knowledge-base passage the assistant cited in its answer. */
export const SourceSchema = z.object({
  index: z.number().int().min(1),
  chunkId: IdSchema,
  documentId: IdSchema,
  documentSlug: z.string(),
  documentTitle: z.string(),
  sectionPath: z.string(),
  excerpt: z.string(),
  score: z.number(),
});
export type Source = z.infer<typeof SourceSchema>;

export const TurnMetricsSchema = z.object({
  sttMs: z.number().nullable(),
  firstTokenMs: z.number().nullable(),
  firstAudioMs: z.number().nullable(),
  ttsMs: z.number().nullable(),
  totalMs: z.number(),
  llmCalls: z.number().int(),
  toolCalls: z.number().int(),
});
export type TurnMetrics = z.infer<typeof TurnMetricsSchema>;

export const AgentStepTypeSchema = z.enum([
  'thinking',
  'tool_call',
  'tool_result',
  'retrieval_evaluated',
  'answer',
]);
export type AgentStepType = z.infer<typeof AgentStepTypeSchema>;

export const AgentStepSchema = z.object({
  id: z.string(),
  type: AgentStepTypeSchema,
  /** Milliseconds since the turn started. */
  at: z.number(),
  label: z.string(),
  durationMs: z.number().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});
export type AgentStep = z.infer<typeof AgentStepSchema>;

export const MessageSchema = z.object({
  id: IdSchema,
  conversationId: IdSchema,
  role: MessageRoleSchema,
  content: z.string(),
  sources: z.array(SourceSchema).default([]),
  steps: z.array(AgentStepSchema).default([]),
  metrics: TurnMetricsSchema.nullable().default(null),
  createdAt: IsoDateTimeSchema,
});
export type Message = z.infer<typeof MessageSchema>;

export const ConversationSchema = z.object({
  id: IdSchema,
  title: z.string().nullable(),
  userContext: UserContextSchema.nullable(),
  messageCount: z.number().int(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Conversation = z.infer<typeof ConversationSchema>;

export const ConversationDetailSchema = ConversationSchema.extend({
  messages: z.array(MessageSchema),
});
export type ConversationDetail = z.infer<typeof ConversationDetailSchema>;

export const CreateConversationRequestSchema = z.object({
  userContext: UserContextSchema.optional(),
  title: z.string().trim().max(200).optional(),
});
export type CreateConversationRequest = z.infer<typeof CreateConversationRequestSchema>;

export const ConversationListResponseSchema = z.object({
  conversations: z.array(ConversationSchema),
});
export type ConversationListResponse = z.infer<typeof ConversationListResponseSchema>;
