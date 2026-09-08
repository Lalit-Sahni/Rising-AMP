/**
 * Shared types for the reversible action layer. Tiers are decided in code,
 * never by a model. Callers pass membership scope from the query layer.
 * Do not import from App.js or PaletteHost.
 */
import { z } from 'zod';
import {
  firstZodIssue,
  queryScopeSchema,
  type QueryScope,
} from '../queries/core';

export const ACTION_NAMES = ['codeExpense', 'createExpense', 'codeExpenseBatch', 'undoAction'] as const;
export type ActionName = (typeof ACTION_NAMES)[number];

export const NEVER_ACTIONS = [
  'sendEmail',
  'allocateInvoiceNumber',
  'invitePerson',
  'removePerson',
  'archiveJob',
  'deleteRecord',
  'changeSetting',
  'spendMoney',
] as const;
export type NeverActionName = (typeof NEVER_ACTIONS)[number];

export const ACTION_TIERS = ['do', 'propose', 'refuse'] as const;
export type ActionTier = (typeof ACTION_TIERS)[number];

export const RECEIPT_STATUSES = ['applied', 'proposed', 'refused', 'undone'] as const;
export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];

export const EVIDENCE_SOURCES = ['user', 'record', 'ocr', 'inferred'] as const;
export type EvidenceSource = (typeof EVIDENCE_SOURCES)[number];

const ACTION_SET = new Set<string>(ACTION_NAMES);
const NEVER_SET = new Set<string>(NEVER_ACTIONS);
const DIRECT_SOURCES = new Set<EvidenceSource>(['user', 'record', 'ocr']);

export const evidenceSourceSchema = z.enum(EVIDENCE_SOURCES);
export const fieldEvidenceSchema = z
  .object({
    source: evidenceSourceSchema,
    value: z.unknown(),
  })
  .strict();
export type FieldEvidence = z.infer<typeof fieldEvidenceSchema>;

export const actionTierSchema = z.enum(ACTION_TIERS);
export const receiptStatusSchema = z.enum(RECEIPT_STATUSES);
export const actionNameSchema = z.enum(ACTION_NAMES);

export const undoPayloadSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('restoreTradeId'),
    expenseId: z.string().min(1).max(128),
    previousTradeId: z.string().min(1).max(80).nullable(),
  }),
  z.object({
    kind: z.literal('restoreTradeIdBatch'),
    items: z.array(
      z.object({
        expenseId: z.string().min(1).max(128),
        previousTradeId: z.string().min(1).max(80).nullable(),
        receiptId: z.string().min(1).max(128),
      }).strict(),
    ).max(80),
  }),
  z.object({
    kind: z.literal('voidExpense'),
    expenseId: z.string().min(1).max(128),
  }),
  z.object({
    kind: z.literal('none'),
  }),
]);
export type UndoPayload = z.infer<typeof undoPayloadSchema>;

export const documentIdsSchema = z
  .object({
    expenseId: z.string().min(1).max(128).optional(),
    receiptId: z.string().min(1).max(128).optional(),
    expenseIds: z.array(z.string().min(1).max(128)).max(80).optional(),
    receiptIds: z.array(z.string().min(1).max(128)).max(80).optional(),
  })
  .strict();

export const tradeChangeSchema = z
  .object({
    from: z.string().min(1).max(80).nullable(),
    to: z.string().min(1).max(80).nullable(),
  })
  .strict();

export const receiptChangedSchema = z
  .object({
    tradeId: tradeChangeSchema.optional(),
  })
  .strict();

export const actionReceiptSchema = z
  .object({
    id: z.string().min(1).max(128),
    orgId: z.string().min(1).max(128),
    jobId: z.string().min(1).max(128),
    action: actionNameSchema,
    source: z.literal('assistant'),
    clientKey: z.string().min(8).max(128),
    tier: actionTierSchema,
    status: receiptStatusSchema,
    evidence: z.record(z.string(), fieldEvidenceSchema),
    documentIds: documentIdsSchema,
    changed: receiptChangedSchema.optional(),
    undo: undoPayloadSchema,
    createdAt: z.date(),
    undoneAt: z.date().optional(),
    undoReceiptId: z.string().min(1).max(128).optional(),
  })
  .strict();
export type ActionReceipt = z.infer<typeof actionReceiptSchema>;

export const actionErrorCodeSchema = z.enum([
  'job_not_allowed',
  'invalid_input',
  'org_required',
  'unknown_action',
  'never_action',
]);
export type ActionErrorCode = z.infer<typeof actionErrorCodeSchema>;

export const actionFailureSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: actionErrorCodeSchema,
    message: z.string().min(1),
  }),
});
export type ActionFailure = z.infer<typeof actionFailureSchema>;

export const actionSuccessSchema = z.object({
  ok: z.literal(true),
  receipt: actionReceiptSchema,
});
export type ActionSuccess = z.infer<typeof actionSuccessSchema>;
export type ActionResult = ActionSuccess | ActionFailure;

export function actionFailure(code: ActionErrorCode, message: string): ActionFailure {
  return actionFailureSchema.parse({ ok: false, error: { code, message } });
}

export function invalidActionInput(message: string): ActionFailure {
  return actionFailure('invalid_input', message);
}

export { firstZodIssue, queryScopeSchema };
export type { QueryScope };

export function isActionName(name: string): name is ActionName {
  return ACTION_SET.has(name);
}

export function isNeverAction(name: string): name is NeverActionName {
  return NEVER_SET.has(name);
}

export function isDirectEvidence(source: EvidenceSource): boolean {
  return DIRECT_SOURCES.has(source);
}

/**
 * Tier is decided here, never by a model. An inferred field never reaches do.
 */
export function assignTier(input: {
  action: string;
  evidence: Record<string, FieldEvidence>;
  never?: boolean;
}): ActionTier {
  if (input.never || isNeverAction(input.action) || !isActionName(input.action)) {
    return 'refuse';
  }
  const fields = Object.values(input.evidence || {});
  if (fields.length === 0) return 'propose';
  if (fields.some((field) => field.source === 'inferred' || !isDirectEvidence(field.source))) {
    return 'propose';
  }
  return 'do';
}

export function newReceiptId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `receipt-${Date.now()}`;
}

export function asTradeId(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}
