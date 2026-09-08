/**
 * Decide do vs propose for a scanned receipt. Pure: no Firestore, no model.
 * GST is the stated figure only. Never derived from the total.
 */
import { calendarDateToYmd } from '../dates';
import { parseToCents, lineCents } from '../money';
import { detectUncertainFields } from '../utils/ocrUncertainty';
import {
  assignTier,
  type ActionTier,
  type FieldEvidence,
} from './core';
import { looksLikeInstruction } from './instructionText';

export type PartyMatch = 'use' | 'create' | 'unset' | 'none';

export type FileExpenseOcrItem = {
  totalPrice?: unknown;
  unitPrice?: unknown;
  quantity?: unknown;
};

export type FileExpenseOcr = {
  vendor?: unknown;
  name?: unknown;
  date?: unknown;
  totalAmount?: unknown;
  tax?: unknown;
  items?: FileExpenseOcrItem[];
  category?: unknown;
  text?: unknown;
  notes?: unknown;
};

export type DecideFileExpenseInput = {
  extractedData?: FileExpenseOcr | null;
  warnings?: unknown;
  category: string;
  partyMatch: PartyMatch;
  partyId?: string | null;
};

export type DecideFileExpenseResult = {
  tier: ActionTier;
  gstCents?: number;
  partyId?: string;
  evidence: {
    date: FieldEvidence;
    amount: FieldEvidence;
    party: FieldEvidence;
    gst?: FieldEvidence;
  };
};

function isBlankTax(tax: unknown): boolean {
  if (tax == null) return true;
  if (typeof tax === 'string' && !tax.trim()) return true;
  return false;
}

/**
 * Stated GST only. Empty / missing / 0-from-empty is unstated.
 * A positive parsed figure is integer cents.
 */
export function statedGstCents(tax: unknown): number | undefined {
  if (isBlankTax(tax)) return undefined;
  try {
    const parsed = parseToCents(tax);
    if (parsed <= 0) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function itemLineCents(item: FileExpenseOcrItem): number {
  if (item.totalPrice != null && item.totalPrice !== '') {
    try {
      return parseToCents(item.totalPrice);
    } catch {
      return 0;
    }
  }
  if (item.unitPrice != null && item.quantity != null && item.quantity !== '') {
    try {
      return lineCents(item.quantity, item.unitPrice);
    } catch {
      return 0;
    }
  }
  return 0;
}

function lineItemsDisagree(extracted: FileExpenseOcr): boolean {
  const items = Array.isArray(extracted.items) ? extracted.items : [];
  if (items.length === 0) return false;
  if (extracted.totalAmount == null || extracted.totalAmount === '') return false;
  let totalCents: number;
  try {
    totalCents = parseToCents(extracted.totalAmount);
  } catch {
    return true;
  }
  const sum = items.reduce((acc, item) => acc + itemLineCents(item), 0);
  return Math.abs(sum - totalCents) > 1;
}

function asEvidenceValue(value: unknown): string | null {
  if (value == null || value === '') return null;
  const ymd = calendarDateToYmd(value);
  if (ymd) return ymd;
  return String(value);
}

export function decideFileExpense(input: DecideFileExpenseInput): DecideFileExpenseResult {
  const extracted = input.extractedData || {};
  const category = String(input.category || extracted.category || 'purchase');
  const flags = detectUncertainFields({
    category,
    extractedData: extracted,
    warnings: input.warnings || [],
    formData: { date: extracted.date },
  }) as unknown as Record<string, boolean>;

  const dateUncertain = Boolean(flags.date);
  const amountUncertain = Boolean(flags.amount) || Boolean(flags.hours) || lineItemsDisagree(extracted);
  const dateYmd = calendarDateToYmd(extracted.date);
  let amountCents: number | null = null;
  try {
    if (extracted.totalAmount != null && extracted.totalAmount !== '') {
      amountCents = parseToCents(extracted.totalAmount);
    }
  } catch {
    amountCents = null;
  }

  const date: FieldEvidence = {
    source: dateUncertain ? 'inferred' : 'ocr',
    value: dateYmd || asEvidenceValue(extracted.date),
  };
  const amount: FieldEvidence = {
    source: amountUncertain || amountCents == null || amountCents <= 0 ? 'inferred' : 'ocr',
    value: amountCents == null ? null : String(amountCents),
  };

  const vendorName = String(extracted.vendor || extracted.name || '');
  const instructionNamed = looksLikeInstruction(vendorName);
  const partyId = String(input.partyId || '').trim();
  const partyOk = input.partyMatch === 'use' && Boolean(partyId) && !instructionNamed;
  const party: FieldEvidence = {
    source: partyOk ? 'record' : 'inferred',
    value: partyOk ? partyId : input.partyMatch,
  };

  const gstCents = statedGstCents(extracted.tax);
  const evidence: DecideFileExpenseResult['evidence'] = { date, amount, party };
  if (gstCents != null) {
    evidence.gst = { source: 'ocr', value: String(gstCents) };
  }

  const tier = assignTier({ action: 'createExpense', evidence: evidence });
  const result: DecideFileExpenseResult = { tier, evidence };
  if (gstCents != null) result.gstCents = gstCents;
  if (partyOk) result.partyId = partyId;
  return result;
}
