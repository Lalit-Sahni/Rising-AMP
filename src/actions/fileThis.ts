/**
 * File a scanned receipt as an expense, or fall back to the existing form.
 * Lazy-loaded from Add expense / OCR. Do not import from App.js or PaletteHost.
 */
import { calendarDateToYmd } from '../dates';
import { dollarsFromUnknown, formatCents, fromCents, labourCents, lineCents, parseToCents } from '../money';
import { canonicalPartyName } from '../firebase/partyName';
import { listParties, partyHintFromExpense, resolvePartyFromList } from '../firebase/parties';
import { scopeFromMembership } from '../queries/core';
import { createExpense } from './createExpense';
import { decideFileExpense, type PartyMatch } from './fileExpense';
import { undoAction } from './undo';
import type { ActionReceipt } from './core';

export type ScanPayload = {
  category?: string;
  formData?: Record<string, unknown>;
  extractedData?: {
    vendor?: unknown;
    date?: unknown;
    totalAmount?: unknown;
    tax?: unknown;
    items?: Array<{ totalPrice?: unknown; unitPrice?: unknown; quantity?: unknown }>;
    category?: unknown;
  };
  warnings?: unknown;
  uncertainFields?: Record<string, boolean>;
  imageFile?: File;
};

export type FileExpenseFromScanInput = {
  jobId: string;
  orgId: string | null | undefined;
  allowedJobs: Array<{ projectId?: string; id?: string }> | null | undefined;
  ocr: ScanPayload;
};

export type FileExpenseFromScanResult =
  | {
    kind: 'applied';
    receipt: ActionReceipt;
    message: string;
    undo: () => Promise<void>;
  }
  | { kind: 'propose' }
  | { kind: 'error'; message: string };

function expenseTotal(category: string, formData: Record<string, unknown>): number {
  switch (category) {
    case 'labour':
      return fromCents(labourCents(formData.hours, formData.rate));
    case 'equipment':
      return dollarsFromUnknown(formData.totalPrice);
    case 'trade':
    case 'investor':
      return dollarsFromUnknown(formData.amount);
    case 'purchase':
      return fromCents(lineCents(formData.quantity, formData.unitCost));
    case 'service':
      return dollarsFromUnknown(formData.cost);
    default:
      return dollarsFromUnknown(formData.amount || formData.cost || formData.unitCost || formData.totalPrice);
  }
}

function ymdOf(value: unknown): string | undefined {
  return calendarDateToYmd(value) || undefined;
}

function vendorLabel(category: string, formData: Record<string, unknown>, vendor: unknown): string {
  const fromForm = String(
    formData.supplier || formData.tradeName || formData.workerName || formData.provider || '',
  ).trim();
  if (fromForm) return fromForm;
  return String(vendor || '').trim();
}

function clientKeyFor(jobId: string, file: File | undefined, category: string, date: string, cents: number): string {
  const stamp = file
    ? `${file.name}:${file.size}:${file.lastModified}`
    : `${category}:${date}:${cents}`;
  const raw = `createExpense:${jobId}:${stamp}`;
  return raw.slice(0, 128).padEnd(8, 'x');
}

async function loadStore() {
  const { createFirestoreActionStore } = await import('../firebase/assistantReceipts');
  return createFirestoreActionStore();
}

export async function fileExpenseFromScan(input: FileExpenseFromScanInput): Promise<FileExpenseFromScanResult> {
  const jobId = String(input.jobId || '').trim();
  if (!jobId) return { kind: 'error', message: 'Open a job first.' };
  const scope = scopeFromMembership(input.orgId, input.allowedJobs);
  if ('ok' in scope) {
    return { kind: 'error', message: scope.error.message };
  }
  const ocr = input.ocr || {};
  const category = String(ocr.category || ocr.extractedData?.category || 'purchase');
  const formData = { ...(ocr.formData || {}) };
  const extracted = ocr.extractedData || {};
  const expenseShape: Record<string, unknown> = {
    category,
    ...formData,
    date: ymdOf(formData.date) || ymdOf(extracted.date),
    startDate: ymdOf(formData.startDate),
    endDate: ymdOf(formData.endDate),
    total: expenseTotal(category, formData),
  };

  let partyMatch: PartyMatch = 'none';
  let partyId: string | undefined;
  try {
    const hint = partyHintFromExpense(expenseShape);
    if (hint) {
      const parties = await listParties();
      const resolved = resolvePartyFromList(parties, {
        canonicalName: canonicalPartyName(hint.name),
        kind: hint.kind,
      });
      partyMatch = resolved.action;
      if (resolved.action === 'use') partyId = resolved.partyId;
    }
  } catch {
    partyMatch = 'unset';
  }

  const decision = decideFileExpense({
    extractedData: extracted,
    warnings: ocr.warnings,
    category,
    partyMatch,
    partyId,
  });

  if (decision.tier !== 'do' || !decision.partyId) {
    return { kind: 'propose' };
  }

  const store = await loadStore();
  const date = String(expenseShape.date || '');
  let totalCents = 0;
  try {
    totalCents = parseToCents(expenseShape.total);
  } catch {
    totalCents = 0;
  }
  const clientKey = clientKeyFor(jobId, ocr.imageFile, category, date, totalCents);
  const expenseId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `exp-${Date.now()}`;

  let receiptImagePath: string | undefined;
  let receiptImageUrl: string | undefined;
  let receiptUploadedAt: string | undefined;
  if (ocr.imageFile && ocr.imageFile.type && ocr.imageFile.type.startsWith('image/')) {
    try {
      const { uploadReceiptImage } = await import('../firebase/storage');
      const uploaded = await uploadReceiptImage(jobId, expenseId, ocr.imageFile) as {
        success?: boolean;
        path?: string;
        url?: string;
        uploadedAt?: string;
      };
      if (uploaded?.success) {
        receiptImagePath = uploaded.path;
        receiptImageUrl = uploaded.url;
        receiptUploadedAt = uploaded.uploadedAt;
      }
    } catch {
      receiptImagePath = undefined;
    }
  }

  const payload: Record<string, unknown> = {
    scope,
    jobId,
    clientKey,
    id: expenseId,
    category,
    date: expenseShape.date,
    startDate: expenseShape.startDate,
    endDate: expenseShape.endDate,
    total: expenseShape.total,
    amount: formData.amount,
    cost: formData.cost,
    unitCost: formData.unitCost,
    quantity: formData.quantity,
    hours: formData.hours,
    rate: formData.rate,
    totalPrice: formData.totalPrice,
    dailyCost: formData.dailyCost,
    workerName: formData.workerName,
    tradeName: formData.tradeName,
    supplier: formData.supplier,
    provider: formData.provider,
    itemName: formData.itemName,
    equipmentName: formData.equipmentName,
    serviceName: formData.serviceName,
    task: formData.task,
    tradeCategory: formData.tradeCategory,
    role: formData.role,
    notes: formData.notes,
    gstCents: decision.gstCents,
    partyId: decision.partyId,
    receiptImagePath,
    receiptImageUrl,
    receiptUploadedAt,
    evidence: decision.evidence,
  };
  Object.keys(payload).forEach((key) => {
    if (payload[key] == null || payload[key] === '') delete payload[key];
  });
  payload.scope = scope;
  payload.jobId = jobId;
  payload.clientKey = clientKey;
  payload.id = expenseId;
  payload.category = category;
  payload.evidence = decision.evidence;
  const result = await createExpense(payload, store);

  if (!result.ok) {
    return { kind: 'error', message: result.error.message };
  }
  if (result.receipt.tier !== 'do' || result.receipt.status !== 'applied') {
    return { kind: 'propose' };
  }

  try {
    const { invalidateKeys, queryKeys } = await import('../query/client');
    invalidateKeys(queryKeys.expenses(String(input.orgId || ''), jobId));
  } catch {
    // Snapshot still picks the row up.
  }

  const vendor = vendorLabel(category, formData, extracted.vendor);
  const message = vendor
    ? `${vendor} ${formatCents(totalCents)} added`
    : 'Expense added from the receipt.';

  return {
    kind: 'applied',
    receipt: result.receipt,
    message,
    undo: async () => {
      await undoAction({
        scope,
        receiptId: result.receipt.id,
        clientKey: `undo-${result.receipt.id}`.slice(0, 128).padEnd(8, 'x'),
      }, store);
      try {
        const { invalidateKeys, queryKeys } = await import('../query/client');
        invalidateKeys(queryKeys.expenses(String(input.orgId || ''), jobId));
      } catch {
        // Listener still updates.
      }
    },
  };
}

export function isPdfFile(file: File | null | undefined): boolean {
  if (!file) return false;
  const type = String(file.type || '').toLowerCase();
  if (type === 'application/pdf') return true;
  return /\.pdf$/i.test(file.name || '');
}

export async function filePdfAsUnreadableInvoice(input: {
  jobId: string;
  file: File;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const jobId = String(input.jobId || '').trim();
  if (!jobId) return { ok: false, message: 'Open a job first.' };
  try {
    const { uploadJobFile } = await import('../firebase/uploadJobFile');
    const uploaded = await uploadJobFile({
      jobId,
      file: input.file,
      type: 'invoiceReceived',
    });
    if (!uploaded.success) {
      return { ok: false, message: uploaded.error || 'Could not save that file.' };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Could not save that file.',
    };
  }
}
