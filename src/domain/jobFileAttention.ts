/** File-derived "What needs you today" items. Silent when the fact is not there. */

import { parseCalendarDate } from '../dates';
import { parseToCents } from '../money';
import type { JobFile } from './schemas';
import type { JobFileType } from './jobFiles';

/** Paperwork drawers — photos alone do not mean the filing cabinet is in use. */
export const FILE_PAPERWORK_TYPES: JobFileType[] = [
  'variation',
  'plan',
  'permit',
  'certificate',
  'quote',
  'invoiceReceived',
];

/** Invoices below this are ordinary progress/small bills, not a paperwork gap. */
export const FILE_INVOICE_LINK_MIN_CENTS = 500000;

export const OTHER_FILE_STALE_DAYS = 7;

export type FileAttentionItem = {
  id: string;
  page: string;
  title: string;
  detail: string;
  action: string;
  tone: 'warn' | 'neutral';
};

function isVoidInvoice(invoice: unknown): boolean {
  const row = invoice && typeof invoice === 'object' ? (invoice as { status?: unknown }) : null;
  return String(row?.status || '').toLowerCase() === 'void';
}

function invoiceTotalCents(invoice: unknown): number {
  const row = invoice && typeof invoice === 'object' ? (invoice as { totalCents?: unknown; total?: unknown }) : null;
  if (!row || isVoidInvoice(row)) return 0;
  if (Number.isInteger(row.totalCents)) return row.totalCents as number;
  try {
    return parseToCents(row.total);
  } catch (error) {
    return 0;
  }
}

function formatAud(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function isActiveFile(file: JobFile | null | undefined): file is JobFile {
  return Boolean(file && file.status !== 'archived');
}

function fileUploadedAt(file: JobFile): Date | null {
  return parseCalendarDate(file.uploadedAt);
}

export function deriveFileAttentionItems(
  { files = [], invoices = [] }: { files?: JobFile[]; invoices?: unknown[] } = {},
  now = new Date(),
): FileAttentionItem[] {
  const items: FileAttentionItem[] = [];
  const active = (files || []).filter(isActiveFile);

  const hasPaperwork = active.some((file) => FILE_PAPERWORK_TYPES.includes(file.type));
  const hasContract = active.some((file) => file.type === 'contract');
  if (hasPaperwork && !hasContract) {
    items.push({
      id: 'files-no-contract',
      page: 'files',
      title: 'No signed contract on this job',
      detail: 'Everything else is filed. This one is not.',
      action: 'Add files',
      tone: 'warn',
    });
  }

  const quoteOrVariation = active.filter(
    (file) => file.type === 'quote' || file.type === 'variation',
  );
  if (quoteOrVariation.length > 0) {
    const liveInvoices = (invoices || []).filter(
      (invoice) => invoice && typeof invoice === 'object' && !isVoidInvoice(invoice),
    ) as Array<{ id?: string }>;
    const unlinked = liveInvoices.filter((invoice) => {
      if (!invoice.id) return false;
      if (invoiceTotalCents(invoice) < FILE_INVOICE_LINK_MIN_CENTS) return false;
      return !quoteOrVariation.some(
        (file) => file.linkedTo?.kind === 'invoice' && file.linkedTo.id === invoice.id,
      );
    });
    if (unlinked.length > 0) {
      const total = unlinked.reduce((sum, invoice) => sum + invoiceTotalCents(invoice), 0) / 100;
      items.push({
        id: 'files-invoice-unlinked',
        page: 'files',
        title:
          unlinked.length === 1
            ? '1 invoice has no linked quote or variation'
            : `${unlinked.length} invoices have no linked quote or variation`,
        detail: `${formatAud(total)} invoiced with no paperwork attached`,
        action: 'Link',
        tone: 'warn',
      });
    }
  }

  const weekMs = OTHER_FILE_STALE_DAYS * 24 * 60 * 60 * 1000;
  const staleOther = active.filter((file) => {
    if (file.type !== 'other') return false;
    const uploaded = fileUploadedAt(file);
    if (!uploaded) return false;
    return now.getTime() - uploaded.getTime() >= weekMs;
  });
  if (staleOther.length > 0) {
    items.push({
      id: 'files-other-stale',
      page: 'files',
      title:
        staleOther.length === 1
          ? '1 file still typed Other'
          : `${staleOther.length} files still typed Other`,
      detail: 'Give them a type so they can be found.',
      action: 'Review',
      tone: 'neutral',
    });
  }

  return items;
}
