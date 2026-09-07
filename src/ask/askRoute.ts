/**
 * Typed parse of the askRisingAmp callable response.
 * Unused on first paint: do not import from App.js or PaletteHost.
 * Figures are never in this object; the client runs src/queries/ later.
 */
import { z } from 'zod';
import { QUERY_NAMES } from '../queries/core';

const NO_FIGURES = /[$£€¥0-9]/;

const askParamsSchema = z
  .object({
    jobId: z.string().min(1).max(128).optional(),
    tradeId: z.string().min(1).max(80).optional(),
    trade: z.string().min(1).max(80).optional(),
    partyId: z.string().min(1).max(128).optional(),
    party: z.string().min(1).max(80).optional(),
    category: z.string().min(1).max(40).optional(),
    status: z.string().min(1).max(40).optional(),
    type: z.string().min(1).max(40).optional(),
    text: z.string().min(1).max(500).optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    period: z.enum(['week', 'month', 'quarter']).optional(),
    olderThanDays: z.number().int().min(0).max(3650).optional(),
  })
  .strict();

const sentenceSchema = z
  .string()
  .max(240)
  .refine((value) => !NO_FIGURES.test(value), 'sentence must not contain figures');

export const askChoiceSchema = z.union([
  z.object({
    query: z.literal('none'),
    params: z.object({}).strict(),
    reason: sentenceSchema.min(1),
  }),
  z.object({
    query: z.enum(QUERY_NAMES),
    params: askParamsSchema,
    sentence: sentenceSchema.optional(),
  }),
]);

export const askCallableResponseSchema = z.object({
  ok: z.literal(true),
  model: z.literal('gpt-4o-mini'),
  choices: z.array(askChoiceSchema).min(1).max(3),
});

export type AskChoice = z.infer<typeof askChoiceSchema>;
export type AskCallableResponse = z.infer<typeof askCallableResponseSchema>;

export function parseAskCallableResponse(data: unknown): AskCallableResponse {
  return askCallableResponseSchema.parse(data);
}
