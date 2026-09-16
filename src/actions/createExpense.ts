/**
 * Create one uncoded expense from a receipted assistant action.
 * Does not invent GST. Does not guess a trade. Does not create a party.
 * The model never runs here.
 */
import { z } from 'zod';
import { calendarDateToYmd } from '../dates';
import { normalizeExpenseCategory } from '../domain/expenseCategory';
import {
  dollarsFromUnknown,
  fromCents,
  labourCents,
  lineCents,
} from '../money';
import { resolveTargetJobIds } from '../queries/core';
import {
  actionFailure,
  actionOriginSchema,
  actionReceiptSchema,
  assignTier,
  fieldEvidenceSchema,
  firstZodIssue,
  invalidActionInput,
  isDirectEvidence,
  newReceiptId,
  queryScopeSchema,
  type ActionReceipt,
  type ActionResult,
  type FieldEvidence,
} from './core';
import type { ActionStore } from './store';
import { refuseIfWriteBlocked } from './writesGate';

const moneyField = z.union([z.number(), z.string()]).optional();
const dateField = z.union([z.string(), z.date()]).optional();

export const createExpenseInputSchema = z
  .object({
    scope: queryScopeSchema,
    jobId: z.string().min(1).max(128),
    clientKey: z.string().min(8).max(128),
    origin: actionOriginSchema,
    viewerIsOwner: z.boolean().optional(),
    id: z.string().min(1).max(128).optional(),
    category: z.string().min(1).max(40),
    date: dateField,
    startDate: dateField,
    endDate: dateField,
    total: moneyField,
    amount: moneyField,
    cost: moneyField,
    unitCost: moneyField,
    quantity: moneyField,
    hours: moneyField,
    rate: moneyField,
    totalPrice: moneyField,
    dailyCost: moneyField,
    workerName: z.string().max(120).optional(),
    tradeName: z.string().max(120).optional(),
    supplier: z.string().max(120).optional(),
    provider: z.string().max(120).optional(),
    itemName: z.string().max(200).optional(),
    equipmentName: z.string().max(200).optional(),
    serviceName: z.string().max(200).optional(),
    task: z.string().max(200).optional(),
    tradeCategory: z.string().max(80).optional(),
    role: z.string().max(80).optional(),
    notes: z.string().max(2000).optional(),
    paidBy: z.string().max(120).optional(),
    gstCents: z.number().int().min(0).optional(),
    partyId: z.string().min(1).max(80).optional(),
    fileId: z.string().min(1).max(128).optional(),
    receiptImagePath: z.string().min(1).max(500).optional(),
    receiptImageUrl: z.string().min(1).max(2000).optional(),
    receiptUploadedAt: z.string().max(80).optional(),
    evidence: z
      .object({
        date: fieldEvidenceSchema,
        amount: fieldEvidenceSchema,
        party: fieldEvidenceSchema,
        gst: fieldEvidenceSchema.optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.gstCents != null && !data.evidence.gst) {
      ctx.addIssue({
        code: 'custom',
        message: 'gst evidence is required when gstCents is set',
        path: ['evidence', 'gst'],
      });
    }
  });

export type CreateExpenseInput = z.infer<typeof createExpenseInputSchema>;

function buildReceipt(row: ActionReceipt): ActionReceipt {
  return actionReceiptSchema.parse(row);
}

function newExpenseId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `exp-${Date.now()}`;
}

function asYmd(value: unknown): string | undefined {
  const ymd = calendarDateToYmd(value);
  return ymd || undefined;
}

function evidenceForStore(evidence: Record<string, FieldEvidence>): Record<string, FieldEvidence> {
  const out: Record<string, FieldEvidence> = {};
  Object.entries(evidence).forEach(([key, field]) => {
    if (!field) return;
    let value: unknown = field.value;
    if (value instanceof Date) value = calendarDateToYmd(value);
    if (value == null) value = null;
    else if (typeof value !== 'string') value = String(value);
    out[key] = { source: field.source, value };
  });
  return out;
}

function expenseTotal(category: string, data: CreateExpenseInput): number {
  if (data.total != null && data.total !== '') return dollarsFromUnknown(data.total);
  switch (category) {
    case 'labour':
      return fromCents(labourCents(data.hours, data.rate));
    case 'equipment':
      return dollarsFromUnknown(data.totalPrice);
    case 'trade':
    case 'investor':
      return dollarsFromUnknown(data.amount);
    case 'purchase':
      return fromCents(lineCents(data.quantity, data.unitCost));
    case 'service':
      return dollarsFromUnknown(data.cost);
    default:
      return dollarsFromUnknown(data.amount || data.cost || data.unitCost || data.totalPrice);
  }
}

function statedGstToStore(
  gstCents: number | undefined,
  gstEvidence: FieldEvidence | undefined,
): number | undefined {
  if (gstCents == null || gstCents <= 0) return undefined;
  const source = gstEvidence?.source;
  if (!source || source === 'inferred' || !isDirectEvidence(source)) return undefined;
  return gstCents;
}

export async function createExpense(input: unknown, store: ActionStore): Promise<ActionResult> {
  const parsed = createExpenseInputSchema.safeParse(input);
  if (!parsed.success) return invalidActionInput(firstZodIssue(parsed.error));
  const data = parsed.data;
  if (!data.scope.orgId) return actionFailure('org_required', 'An organisation is required.');

  const target = resolveTargetJobIds(data.scope, data.jobId);
  if (!target.ok) {
    return actionFailure(target.error.code, target.error.message);
  }

  const replay = await store.getReceiptByClientKey(data.scope.orgId, data.clientKey);
  if (replay) return { ok: true, receipt: replay };

  const category = normalizeExpenseCategory(data.category);
  if (!category) return invalidActionInput('Choose a category.');

  const gstInferred = data.gstCents != null && data.evidence.gst?.source === 'inferred';
  const gstCents = statedGstToStore(data.gstCents, data.evidence.gst);
  let tier = assignTier({ action: 'createExpense', evidence: data.evidence });
  if (tier === 'do') {
    const partyId = String(data.partyId || '').trim();
    if (data.evidence.party.source !== 'record' || !partyId) {
      tier = 'propose';
    }
  }
  if (gstInferred && tier === 'do') {
    tier = 'propose';
  }

  const blocked = await refuseIfWriteBlocked({
    orgId: data.scope.orgId,
    origin: data.origin,
    tier,
    viewerIsOwner: data.viewerIsOwner === true,
    store,
  });
  if (blocked) return blocked;

  const expenseId = data.id || newExpenseId();
  const createdAt = new Date();
  const id = newReceiptId();
  const storedEvidence = evidenceForStore(data.evidence);

  if (tier !== 'do') {
    const receipt = buildReceipt({
      id,
      orgId: data.scope.orgId,
      jobId: data.jobId,
      action: 'createExpense',
      source: 'assistant',
      origin: data.origin,
      clientKey: data.clientKey,
      tier,
      status: tier === 'refuse' ? 'refused' : 'proposed',
      evidence: storedEvidence,
      documentIds: { expenseId },
      undo: { kind: 'none' },
      createdAt,
    });
    await store.putReceipt(receipt);
    return { ok: true, receipt };
  }

  const date = asYmd(data.date) || asYmd(data.startDate);
  const fields: Record<string, unknown> = {
    category,
    total: expenseTotal(category, data),
    paidBy: data.paidBy || '',
  };
  if (date) fields.date = date;
  const startDate = asYmd(data.startDate);
  const endDate = asYmd(data.endDate);
  if (startDate) fields.startDate = startDate;
  if (endDate) fields.endDate = endDate;
  const copyKeys = [
    'amount',
    'cost',
    'unitCost',
    'quantity',
    'hours',
    'rate',
    'totalPrice',
    'dailyCost',
    'workerName',
    'tradeName',
    'supplier',
    'provider',
    'itemName',
    'equipmentName',
    'serviceName',
    'task',
    'tradeCategory',
    'role',
    'notes',
  ] as const;
  copyKeys.forEach((key) => {
    const value = data[key];
    if (value != null && value !== '') fields[key] = value;
  });

  const receipt = buildReceipt({
    id,
    orgId: data.scope.orgId,
    jobId: data.jobId,
    action: 'createExpense',
    source: 'assistant',
    origin: data.origin,
    clientKey: data.clientKey,
    tier: 'do',
    status: 'applied',
    evidence: storedEvidence,
    documentIds: { expenseId },
    undo: { kind: 'voidExpense', expenseId },
    createdAt,
  });

  const partyId = String(data.partyId || '').trim();
  await store.commitCreation({
    orgId: data.scope.orgId,
    jobId: data.jobId,
    expense: {
      id: expenseId,
      jobId: data.jobId,
      category,
      source: 'assistant',
      assistantReceiptId: id,
      assistantConfirmed: false,
      partyId: partyId || undefined,
      gstCents,
      receiptImagePath: data.receiptImagePath,
      receiptImageUrl: data.receiptImageUrl,
      receiptUploadedAt: data.receiptUploadedAt,
      fields,
    },
    fileId: data.fileId && store.linkFileToExpense ? data.fileId : undefined,
    receipt,
  });
  return { ok: true, receipt };
}
