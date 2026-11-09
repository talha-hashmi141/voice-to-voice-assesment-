import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from '../common';
import { TicketPrioritySchema } from '../hr';

export const ToolNameSchema = z.enum([
  'search_knowledge_base',
  'get_current_datetime',
  'count_business_days',
  'calculate',
  'get_leave_balance',
  'get_support_tickets',
  'create_support_ticket',
]);
export type ToolName = z.infer<typeof ToolNameSchema>;
export const TOOL_NAMES = ToolNameSchema.options;

export const SearchKnowledgeBaseArgsSchema = z.object({
  queries: z
    .array(z.string().trim().min(1).max(300))
    .min(1)
    .max(3)
    .describe(
      'One to three different phrasings of what to look up. Use the conversation context to make them specific.',
    ),
  topK: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .describe('How many passages to return (default 5).'),
});
export type SearchKnowledgeBaseArgs = z.infer<typeof SearchKnowledgeBaseArgsSchema>;

export const GetCurrentDateTimeArgsSchema = z.object({
  timezone: z
    .string()
    .optional()
    .describe('IANA timezone such as "Europe/London". Defaults to the user\'s timezone.'),
});
export type GetCurrentDateTimeArgs = z.infer<typeof GetCurrentDateTimeArgsSchema>;

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, 'Use YYYY-MM-DD');

export const CountBusinessDaysArgsSchema = z.object({
  startDate: IsoDate.describe('First day of the range, inclusive (YYYY-MM-DD).'),
  endDate: IsoDate.describe('Last day of the range, inclusive (YYYY-MM-DD).'),
  holidays: z
    .array(IsoDate)
    .max(60)
    .default([])
    .describe(
      'Company holidays to exclude (YYYY-MM-DD), taken from the holiday calendar in the knowledge base.',
    ),
});
export type CountBusinessDaysArgs = z.infer<typeof CountBusinessDaysArgsSchema>;

export const CalculateArgsSchema = z.object({
  expression: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .describe('An arithmetic expression to evaluate exactly, e.g. "20 - 7 - 5" or "75 * 3".'),
});
export type CalculateArgs = z.infer<typeof CalculateArgsSchema>;

export const GetLeaveBalanceArgsSchema = z.object({
  employeeId: z
    .string()
    .optional()
    .describe('Employee id such as "E-1042". Omit to use the current user.'),
});
export type GetLeaveBalanceArgs = z.infer<typeof GetLeaveBalanceArgsSchema>;

export const GetSupportTicketsArgsSchema = z.object({
  status: z
    .enum(['open', 'in_progress', 'resolved', 'all'])
    .default('all')
    .describe('Filter by status; "all" returns every ticket of the current user.'),
  reference: z
    .string()
    .trim()
    .optional()
    .describe('A specific ticket reference such as "TCK-4F7A2C" when the user names one.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(10)
    .describe('Maximum number of tickets to return (newest first).'),
});
export type GetSupportTicketsArgs = z.infer<typeof GetSupportTicketsArgsSchema>;

export const CreateSupportTicketArgsSchema = z.object({
  title: z.string().trim().min(3).max(120).describe('Short summary of the issue.'),
  description: z
    .string()
    .trim()
    .min(3)
    .max(2000)
    .describe('What happened and what the user needs.'),
  priority: TicketPrioritySchema.default('medium').describe('low | medium | high | urgent'),
});
export type CreateSupportTicketArgs = z.infer<typeof CreateSupportTicketArgsSchema>;

export const TOOL_ARG_SCHEMAS = {
  search_knowledge_base: SearchKnowledgeBaseArgsSchema,
  get_current_datetime: GetCurrentDateTimeArgsSchema,
  count_business_days: CountBusinessDaysArgsSchema,
  calculate: CalculateArgsSchema,
  get_leave_balance: GetLeaveBalanceArgsSchema,
  get_support_tickets: GetSupportTicketsArgsSchema,
  create_support_ticket: CreateSupportTicketArgsSchema,
} as const satisfies Record<ToolName, z.ZodType>;

/** Catalogue entry describing a tool the agent can call (for the Tools dashboard and docs). */
export const ToolDefinitionSchema = z.object({
  name: ToolNameSchema,
  description: z.string(),
  /** Whether the tool has side effects (creates or changes records). */
  mutating: z.boolean(),
  timeoutMs: z.number().int(),
  /** JSON Schema of the arguments, as given to the model. */
  parameters: z.record(z.string(), z.unknown()),
});
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

export const ToolListResponseSchema = z.object({
  tools: z.array(ToolDefinitionSchema),
});
export type ToolListResponse = z.infer<typeof ToolListResponseSchema>;

export const ToolUsageSchema = z.object({
  name: z.string(),
  calls: z.number().int(),
  failures: z.number().int(),
  avgDurationMs: z.number().nullable(),
});
export type ToolUsage = z.infer<typeof ToolUsageSchema>;

export const ToolInvocationSchema = z.object({
  conversationId: IdSchema,
  messageId: IdSchema,
  name: z.string(),
  label: z.string(),
  ok: z.boolean().nullable(),
  durationMs: z.number().nullable(),
  at: IsoDateTimeSchema,
});
export type ToolInvocation = z.infer<typeof ToolInvocationSchema>;

export const ToolUsageResponseSchema = z.object({
  usage: z.array(ToolUsageSchema),
  recent: z.array(ToolInvocationSchema),
});
export type ToolUsageResponse = z.infer<typeof ToolUsageResponseSchema>;
