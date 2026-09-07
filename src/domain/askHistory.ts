/**
 * Ask question history. Business data, not a chat log.
 * Stores the question, the routed query + params, query provenance,
 * snapshot cents/counts, and a code-assigned refusalReason.
 * Never model sentence or reason.
 */
import { z } from 'zod';
import {
  QUERY_NAMES,
  provenanceSchema,
  type QueryName,
} from '../queries/core';
import { refusalReasonSchema, type RefusalReason } from './askRefusal';

export const ASK_HISTORY_QUERIES = [...QUERY_NAMES, 'none'] as const;
export type AskHistoryQuery = (typeof ASK_HISTORY_QUERIES)[number];

const primitive = z.union([z.string(), z.number(), z.boolean()]);

export const askHistoryParamsSchema = z
  .object({
    jobId: z.string().min(1).max(128).optional(),
    tradeId: z.string().min(1).max(80).optional(),
    trade: z.string().min(1).max(80).optional(),
    partyId: z.string().min(1).max(128).optional(),
    party: z.string().min(1).max(120).optional(),
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

export const askHistoryProvenanceSchema = z
  .object({
    query: z.enum(QUERY_NAMES),
    params: z.record(z.string(), primitive),
    source: z.enum(['rollup', 'ledger', 'files', 'mixed']),
    revision: z.number().int().nonnegative().optional(),
    rowCount: z.number().int().nonnegative(),
    capped: z.boolean(),
  })
  .strict();

export const askHistorySnapshotSchema = z
  .object({
    cents: z.number().int().nullable().optional(),
    count: z.number().int().nonnegative().nullable().optional(),
    planCents: z.number().int().nonnegative().optional(),
    actualCents: z.number().int().nonnegative().nullable().optional(),
    uncodedCents: z.number().int().nonnegative().optional(),
    uncodedCount: z.number().int().nonnegative().optional(),
    capped: z.boolean().optional(),
  })
  .strict();

export const askHistoryChoiceSchema = z
  .object({
    query: z.enum(ASK_HISTORY_QUERIES),
    params: askHistoryParamsSchema,
    provenance: askHistoryProvenanceSchema.optional(),
    snapshot: askHistorySnapshotSchema.optional(),
    refusalReason: refusalReasonSchema.optional(),
  })
  .strict();

export const askHistorySchema = z
  .object({
    id: z.string().min(1).max(80).optional(),
    uid: z.string().min(1).max(128),
    orgId: z.string().min(1).max(80),
    jobId: z.string().max(80),
    jobLabel: z.string().max(120),
    question: z.string().trim().min(1).max(500),
    askedAt: z.date(),
    choices: z.array(askHistoryChoiceSchema).min(1).max(3),
  })
  .strict();

export const askHistoryWriteSchema = askHistorySchema.omit({ id: true, askedAt: true });

export type AskHistoryParams = z.infer<typeof askHistoryParamsSchema>;
export type AskHistorySnapshot = z.infer<typeof askHistorySnapshotSchema>;
export type AskHistoryChoice = z.infer<typeof askHistoryChoiceSchema>;
export type AskHistoryRow = z.infer<typeof askHistorySchema>;
export type { RefusalReason };

const MODEL_PROSE_KEYS = [
  'sentence',
  'reason',
  'messages',
  'content',
  'reply',
  'prose',
  'chat',
  'answer',
  'role',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function primitiveParams(params: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      if (value === '') return;
      out[key] = value;
    }
  });
  return out;
}

export function historyHasModelProse(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (MODEL_PROSE_KEYS.some((key) => key in value)) return true;
  if (Array.isArray(value.choices)) {
    return value.choices.some((choice) => isRecord(choice) && MODEL_PROSE_KEYS.some((key) => key in choice));
  }
  return false;
}

export function asAskedAt(value: unknown): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    if (!Number.isNaN(date.getTime())) return date;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value);
  if (typeof value === 'string' && value) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return new Date();
}

function intOrNull(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  return undefined;
}

function sumField(rows: unknown, field: string): { count: number; cents: number } | null {
  if (!Array.isArray(rows)) return null;
  let cents = 0;
  rows.forEach((row) => {
    if (!isRecord(row)) return;
    const amount = row[field];
    if (typeof amount === 'number' && Number.isInteger(amount)) cents += amount;
  });
  return { count: rows.length, cents };
}

/** Code-computed cents/counts from a src/queries/ result. Not model prose. */
export function snapshotFromQueryResult(result: unknown): AskHistorySnapshot | undefined {
  if (!isRecord(result) || result.ok !== true) return undefined;
  const snap: AskHistorySnapshot = {};
  const provenance = isRecord(result.provenance) ? result.provenance : null;
  const uncoded = isRecord(result.uncoded) ? result.uncoded : null;
  const totals = isRecord(result.totals) ? result.totals : null;

  const cents = intOrNull(result.cents);
  if (cents !== undefined) snap.cents = cents;
  const count = intOrNull(result.count);
  if (count !== undefined) snap.count = count;
  if (typeof result.planCents === 'number' && Number.isInteger(result.planCents)) {
    snap.planCents = result.planCents;
  }
  const actual = intOrNull(result.actualCents);
  if (actual !== undefined) {
    snap.actualCents = actual;
    if (snap.cents === undefined) snap.cents = actual;
  }
  if (totals) {
    if (snap.cents === undefined) {
      snap.cents = totals.hidden ? null : intOrNull(totals.costCents) ?? undefined;
    }
    if (snap.count === undefined) {
      const live = intOrNull(totals.liveCount);
      if (live !== undefined && live !== null) snap.count = live;
    }
    if (totals.hidden) snap.capped = true;
  }
  if (snap.cents === undefined) {
    const invoices = sumField(result.invoices, 'totalCents');
    if (invoices) {
      snap.cents = invoices.cents;
      snap.count = invoices.count;
    }
  }
  if (snap.cents === undefined) {
    const expenses = sumField(result.expenses, 'cents');
    if (expenses) {
      snap.cents = expenses.cents;
      snap.count = expenses.count;
    }
  }
  if (snap.cents === undefined) {
    const quotes = sumField(result.quotes, 'tradeCents');
    if (quotes) {
      snap.cents = quotes.cents;
      snap.count = quotes.count;
    }
  }
  if (snap.count === undefined && Array.isArray(result.files)) {
    snap.count = result.files.length;
  }
  if (uncoded) {
    const uncodedCents = intOrNull(uncoded.cents);
    if (typeof uncodedCents === 'number') snap.uncodedCents = uncodedCents;
    const uncodedCount = intOrNull(uncoded.count);
    if (typeof uncodedCount === 'number') snap.uncodedCount = uncodedCount;
  }
  if (typeof provenance?.capped === 'boolean') snap.capped = provenance.capped;
  if (snap.count === undefined) {
    const rows = intOrNull(provenance?.rowCount);
    if (typeof rows === 'number') snap.count = rows;
  }

  if (Object.keys(snap).length === 0) return undefined;
  const parsed = askHistorySnapshotSchema.safeParse(snap);
  return parsed.success ? parsed.data : undefined;
}

export function storedProvenanceFrom(result: unknown): AskHistoryChoice['provenance'] {
  if (!isRecord(result)) return undefined;
  const parsed = provenanceSchema.safeParse(result.provenance);
  if (!parsed.success) return undefined;
  const stored = askHistoryProvenanceSchema.safeParse({
    query: parsed.data.query,
    params: primitiveParams(parsed.data.params as Record<string, unknown>),
    source: parsed.data.source,
    rowCount: parsed.data.rowCount,
    capped: parsed.data.capped,
    ...(parsed.data.revision != null ? { revision: parsed.data.revision } : {}),
  });
  return stored.success ? stored.data : undefined;
}

/** Drop model sentence/reason. Keep query name, params, provenance, snapshot, refusalReason. */
export function historyChoiceFromRoute(
  choice: {
    query: QueryName | 'none';
    params: Record<string, unknown>;
    refusalReason?: RefusalReason;
  },
  result: unknown,
): AskHistoryChoice {
  const params = askHistoryParamsSchema.safeParse(choice.params || {});
  const provenance = storedProvenanceFrom(result);
  const snapshot = snapshotFromQueryResult(result);
  const reason = refusalReasonSchema.safeParse(choice.refusalReason);
  const row: AskHistoryChoice = {
    query: choice.query,
    params: params.success ? params.data : {},
  };
  if (provenance) row.provenance = provenance;
  if (snapshot) row.snapshot = snapshot;
  if (reason.success) row.refusalReason = reason.data;
  const parsed = askHistoryChoiceSchema.safeParse(row);
  return parsed.success ? parsed.data : { query: choice.query, params: {} };
}
