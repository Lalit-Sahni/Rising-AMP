/** Search, type counts, and receipt overlay for the Files screen. No folders. */

import { parseCalendarDate, toYmd } from '../dates';
import type { JobFile } from './schemas';
import {
  JOB_FILE_TYPES,
  RECEIPT_FILE_TYPE,
  RECEIPT_FILE_TYPE_META,
  filesDrawerMeta,
  firstName,
  type FilesDrawerType,
  type JobFileLinkKind,
  type JobFileLinkedTo,
} from './jobFiles';

export type FileBrowserKind = 'file' | 'receipt';

export type FileBrowserItem = {
  key: string;
  kind: FileBrowserKind;
  fileId?: string;
  expenseId?: string;
  name: string;
  type: FilesDrawerType;
  documentDate: string;
  sizeBytes: number | null;
  contentType: string;
  /** Lists and grids only. Never the original. */
  thumbnailPath: string | null;
  /** Viewer only. */
  originalPath: string | null;
  /** Viewer fallback for old receipts that stored a URL and no path. */
  originalUrl: string | null;
  note: string;
  uploadedBy: string;
  linkedTo: JobFileLinkedTo | null;
  readOnly: boolean;
};

export type FileTypeFilter = 'all' | FilesDrawerType;

type LooseRecord = Record<string, unknown>;

function asRecord(value: unknown): LooseRecord | null {
  return value && typeof value === 'object' ? (value as LooseRecord) : null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isVoidRecord(value: unknown): boolean {
  const row = asRecord(value);
  return String(row?.status || '').toLowerCase() === 'void';
}

function expenseHasReceipt(expense: unknown): boolean {
  const row = asRecord(expense);
  return Boolean(asString(row?.receiptImageUrl) || asString(row?.receiptImagePath));
}

export function expenseDisplayName(expense: unknown): string {
  const row = asRecord(expense);
  if (!row) return 'Expense';
  switch (asString(row.category)) {
    case 'labour':
      return asString(row.workerName) || 'Labour';
    case 'trade':
      return asString(row.tradeName) || asString(row.trade) || 'Trade';
    case 'equipment':
      return asString(row.equipmentName) || 'Equipment';
    case 'purchase':
      return asString(row.itemName) || 'Purchase';
    case 'service':
      return asString(row.serviceName) || 'Service';
    case 'installation':
      return asString(row.item) || 'Installation';
    default:
      return asString(row.category) || 'Expense';
  }
}

function expenseDocumentDate(expense: unknown): string {
  const row = asRecord(expense);
  const date = parseCalendarDate(row?.date) || parseCalendarDate(row?.timestamp);
  return date ? toYmd(date) : '';
}

export function filesLinkedTo(
  files: JobFile[],
  kind: JobFileLinkKind,
  id: string,
): JobFile[] {
  if (!id) return [];
  return (files || []).filter((file) => (
    file.status !== 'archived'
    && file.linkedTo?.kind === kind
    && file.linkedTo.id === id
  ));
}

export function jobFileToBrowserItem(file: JobFile): FileBrowserItem {
  return {
    key: `file:${file.id || file.storagePath}`,
    kind: 'file',
    fileId: file.id,
    name: file.name,
    type: file.type,
    documentDate: file.documentDate,
    sizeBytes: file.sizeBytes,
    contentType: file.contentType,
    thumbnailPath: file.thumbnailPath || null,
    originalPath: file.storagePath,
    originalUrl: null,
    note: file.note || '',
    uploadedBy: file.uploadedBy,
    linkedTo: file.linkedTo || null,
    readOnly: false,
  };
}

export function receiptsFromExpenses(expenses: unknown[]): FileBrowserItem[] {
  const items: FileBrowserItem[] = [];
  (expenses || []).forEach((expense) => {
    if (isVoidRecord(expense) || !expenseHasReceipt(expense)) return;
    const row = asRecord(expense);
    if (!row) return;
    const expenseId = asString(row.id);
    if (!expenseId) return;
    const path = asString(row.receiptImagePath) || null;
    const url = asString(row.receiptImageUrl) || null;
    const who = expenseDisplayName(expense);
    items.push({
      key: `receipt:${expenseId}`,
      kind: 'receipt',
      expenseId,
      name: `${who} receipt`,
      type: RECEIPT_FILE_TYPE,
      documentDate: expenseDocumentDate(expense),
      sizeBytes: null,
      contentType: 'image/jpeg',
      thumbnailPath: null,
      originalPath: path,
      originalUrl: url,
      note: '',
      uploadedBy: '',
      linkedTo: { kind: 'expense', id: expenseId },
      readOnly: true,
    });
  });
  return items;
}

export function combineJobFilesAndReceipts(
  files: JobFile[],
  expenses: unknown[],
): FileBrowserItem[] {
  return [
    ...(files || []).filter((file) => file.status !== 'archived').map(jobFileToBrowserItem),
    ...receiptsFromExpenses(expenses),
  ];
}

export function searchFileItems(items: FileBrowserItem[], query: string): FileBrowserItem[] {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return items.slice();
  return items.filter((item) => {
    const typeLabel = filesDrawerMeta(item.type).label.toLowerCase();
    return (
      item.name.toLowerCase().includes(needle)
      || item.note.toLowerCase().includes(needle)
      || typeLabel.includes(needle)
      || item.type.toLowerCase().includes(needle)
    );
  });
}

export function filterFileItems(
  items: FileBrowserItem[],
  type: FileTypeFilter,
): FileBrowserItem[] {
  if (!type || type === 'all') return items.slice();
  return items.filter((item) => item.type === type);
}

export function sortFileItems(items: FileBrowserItem[]): FileBrowserItem[] {
  return items.slice().sort((a, b) => {
    const byDate = String(b.documentDate || '').localeCompare(String(a.documentDate || ''));
    if (byDate !== 0) return byDate;
    return a.name.localeCompare(b.name);
  });
}

export function visibleFileItems(
  items: FileBrowserItem[],
  query: string,
  type: FileTypeFilter,
): FileBrowserItem[] {
  return sortFileItems(filterFileItems(searchFileItems(items, query), type));
}

export type FileTypeCount = { type: FileTypeFilter; label: string; color: string | null; count: number };

export function fileTypeCounts(
  items: FileBrowserItem[],
  selected: FileTypeFilter = 'all',
): FileTypeCount[] {
  const counts = new Map<FilesDrawerType, number>();
  items.forEach((item) => {
    counts.set(item.type, (counts.get(item.type) || 0) + 1);
  });
  const chips: FileTypeCount[] = [
    { type: 'all', label: 'All', color: null, count: items.length },
  ];
  JOB_FILE_TYPES.forEach((type) => {
    const count = counts.get(type) || 0;
    if (count === 0 && selected !== type) return;
    const meta = filesDrawerMeta(type);
    chips.push({ type, label: meta.label, color: meta.color, count });
  });
  const receiptCount = counts.get(RECEIPT_FILE_TYPE) || 0;
  if (receiptCount > 0 || selected === RECEIPT_FILE_TYPE) {
    chips.push({
      type: RECEIPT_FILE_TYPE,
      label: RECEIPT_FILE_TYPE_META.label,
      color: RECEIPT_FILE_TYPE_META.color,
      count: receiptCount,
    });
  }
  return chips;
}

export function fileAddedByLabel(
  item: FileBrowserItem,
  currentUid: string,
  currentName: string,
): string {
  if (item.kind === 'receipt') return 'from an expense · read only';
  if (item.uploadedBy && item.uploadedBy === currentUid) {
    const who = firstName(currentName);
    return who ? `added by ${who}` : 'added by you';
  }
  if (item.uploadedBy) return 'added by a teammate';
  return '';
}

export function fileLinkLabel(
  linkedTo: JobFileLinkedTo | null | undefined,
  lookup: { expenses?: unknown[]; invoices?: unknown[] } = {},
): string {
  if (!linkedTo) return '';
  if (linkedTo.kind === 'expense') {
    const expense = (lookup.expenses || []).find((row) => asString(asRecord(row)?.id) === linkedTo.id);
    const name = expense ? expenseDisplayName(expense) : '';
    return name ? `linked to ${name}` : 'linked to an expense';
  }
  if (linkedTo.kind === 'invoice') {
    const invoice = (lookup.invoices || []).find((row) => asString(asRecord(row)?.id) === linkedTo.id);
    const number = asString(asRecord(invoice)?.invoiceNumber);
    return number ? `linked to ${number}` : 'linked to an invoice';
  }
  if (linkedTo.kind === 'hiaContract') return 'linked to the HIA contract';
  return '';
}
