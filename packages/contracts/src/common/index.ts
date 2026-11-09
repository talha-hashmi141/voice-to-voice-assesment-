import { z } from 'zod';

export const IdSchema = z.uuid();
export type Id = z.infer<typeof IdSchema>;

export const IsoDateTimeSchema = z.iso.datetime({ offset: true });
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>;

export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const ApiErrorSchema = z.object({
  statusCode: z.number().int(),
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  requestId: z.string().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const HealthStatusSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  uptimeSeconds: z.number(),
  provider: z.enum(['openai', 'mock']),
  checks: z.record(z.string(), z.enum(['up', 'down'])),
});
export type HealthStatus = z.infer<typeof HealthStatusSchema>;
