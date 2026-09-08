/**
 * Typed parse of the askRisingAmp callable response.
 * Unused on first paint: do not import from App.js or PaletteHost.
 * Figures are never in this object; the client runs src/queries/ later.
 * Action choices are accepted for tests and later parts; the live prompt
 * still routes writes to none.
 */
import { z } from 'zod';
import { ACTION_NAMES, NEVER_ACTIONS } from '../actions/core';
import { QUERY_NAMES } from '../queries/core';

const NO_FIGURES = /[$£€¥0-9]/;
const ACTION_SET = new Set<string>(ACTION_NAMES);
const NEVER_SET = new Set<string>(NEVER_ACTIONS);

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

const codeExpenseParamsSchema = z
  .object({
    jobId: z.string().min(1).max(128).optional(),
    expenseId: z.string().min(1).max(128),
    tradeId: z.string().min(1).max(80).nullable(),
    clientKey: z.string().min(8).max(128).optional(),
  })
  .strict();

const undoActionParamsSchema = z
  .object({
    jobId: z.string().min(1).max(128).optional(),
    receiptId: z.string().min(1).max(128),
    clientKey: z.string().min(8).max(128).optional(),
  })
  .strict();

export const askQueryChoiceSchema = z
  .object({
    query: z.enum(QUERY_NAMES),
    params: askParamsSchema,
    sentence: sentenceSchema.optional(),
  })
  .strict();

export const askNoneChoiceSchema = z
  .object({
    query: z.literal('none'),
    params: z.object({}).strict(),
    reason: sentenceSchema.min(1),
  })
  .strict();

export const askCodeExpenseChoiceSchema = z
  .object({
    action: z.literal('codeExpense'),
    params: codeExpenseParamsSchema,
    sentence: sentenceSchema.optional(),
  })
  .strict();

export const askUndoActionChoiceSchema = z
  .object({
    action: z.literal('undoAction'),
    params: undoActionParamsSchema,
    sentence: sentenceSchema.optional(),
  })
  .strict();

export const askActionChoiceSchema = z.union([
  askCodeExpenseChoiceSchema,
  askUndoActionChoiceSchema,
]);

export const askChoiceSchema = z.union([
  askNoneChoiceSchema,
  askQueryChoiceSchema,
  askActionChoiceSchema,
]);

export const askCallableResponseSchema = z.object({
  ok: z.literal(true),
  model: z.literal('gpt-4o-mini'),
  choices: z.array(askChoiceSchema).min(1).max(3),
});

export type AskChoice = z.infer<typeof askChoiceSchema>;
export type AskActionChoice = z.infer<typeof askActionChoiceSchema>;
export type AskCallableResponse = z.infer<typeof askCallableResponseSchema>;

export class AskRouteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AskRouteError';
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function parseActionChoice(raw: unknown): AskActionChoice {
  const row = asRecord(raw);
  if (!row) throw new AskRouteError('bad-choice');
  const action = String(row.action || '').trim();
  if (!action) throw new AskRouteError('unknown-action');
  if (NEVER_SET.has(action)) throw new AskRouteError('never-action');
  if (!ACTION_SET.has(action)) throw new AskRouteError('unknown-action');
  const parsed = askActionChoiceSchema.safeParse(row);
  if (!parsed.success) throw new AskRouteError('bad-choice');
  return parsed.data;
}

function parseOneChoice(raw: unknown): AskChoice {
  const row = asRecord(raw);
  if (!row) throw new AskRouteError('bad-choice');
  if (row.action != null && String(row.action).trim()) {
    return parseActionChoice(row);
  }
  const parsed = z.union([askNoneChoiceSchema, askQueryChoiceSchema]).safeParse(row);
  if (!parsed.success) throw new AskRouteError('bad-choice');
  return parsed.data;
}

export function parseAskCallableResponse(data: unknown): AskCallableResponse {
  const row = asRecord(data);
  if (!row || row.ok !== true || row.model !== 'gpt-4o-mini' || !Array.isArray(row.choices)) {
    return askCallableResponseSchema.parse(data);
  }
  const choices = row.choices.map(parseOneChoice);
  return askCallableResponseSchema.parse({ ok: true, model: 'gpt-4o-mini', choices });
}
