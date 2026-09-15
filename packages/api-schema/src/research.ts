import { z } from 'zod';
export const toolNameSchema = z.enum(['searchWeb', 'readPage', 'getMarketRules', 'getOrderBook']);
export const agentConfigSchema = z.object({
  limits: z.object({ searches: z.number().int().min(2).max(3), pageReads: z.number().int().min(1).max(5), steps: z.number().int().min(3).max(12), durationMs: z.number().int().min(1).max(300000), outputTokens: z.number().int().min(1).max(2000), dailyRuns: z.number().int().min(1).max(6) }).strict(),
  profile: z.string().trim().min(1).max(4000),
  categoryIds: z.array(z.string().regex(/^\d+$/)).max(10),
  tools: z.array(toolNameSchema).max(4),
  intervalHours: z.number().int().min(1).max(168),
}).strict();
export const configUpdateSchema = z.object({ expectedVersion: z.number().int().positive(), config: agentConfigSchema }).strict();
export const runRequestSchema = z.object({ marketId: z.string().regex(/^\d+$/).optional() }).strict();
export const scheduleSchema = z.object({ enabled: z.boolean() }).strict();
const price = z.string().regex(/^(0(\.\d{1,8})?|1(\.0{1,8})?)$/);
export const decisionSchema = z.object({
  action: z.enum(['TRADE', 'ABSTAIN']), marketId: z.string(), outcomeId: z.string().nullable(),
  thesis: z.string().min(1).max(4000), counterEvidence: z.string().min(1).max(4000), uncertainty: z.string().min(1).max(2000),
  sourceIds: z.array(z.string()).min(1).max(20), estimatedProbability: z.number().min(0).max(1).nullable(),
  observedPrice: price.nullable(), limitPrice: price.nullable(), expiresAt: z.string().datetime().nullable(),
  abstentionReason: z.string().max(2000).nullable(),
}).strict();
export type ResearchDecisionDto = z.infer<typeof decisionSchema>;
export const agentResponseSchema = z.object({ id: z.string(), tenantId: z.string(), version: z.number().int(), config: agentConfigSchema, paused: z.boolean(), scheduleEnabled: z.boolean(), nextDueAt: z.number().nullable() });
export const runResponseSchema = z.object({ id: z.string(), tenantId: z.string(), agentId: z.string(), trigger: z.enum(['manual','schedule']), marketId: z.string().nullable(), status: z.enum(['queued','running','completed','failed','cancelled']), createdAt: z.number(), startedAt: z.number().nullable(), finishedAt: z.number().nullable(), configVersion: z.number(), config: agentConfigSchema, decision: decisionSchema.nullable(), error: z.string().nullable() });
export const eventResponseSchema = z.object({ id: z.number(), type: z.string(), data: z.unknown(), createdAt: z.number() });
export const pauseSchema = z.object({ paused: z.boolean() }).strict();
