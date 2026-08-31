/** Search, type counts, and receipt overlay for the Files screen. */

import { parseCalendarDate, toYmd } from '../dates';
import type { JobFile } from './schemas';
import { HANDOVER_EXPECTED_TYPES } from './handoverPack';
import {
  JOB_FILE_TYPES,
  RECEIPT_FILE_TYPE,
  RECEIPT_FILE_TYPE_META,
  filesDrawerMeta,
  firstName,
  formatJobFileSize,
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

export type FileSortColumn = 'name' | 'type' | 'documentDate' | 'size';
export type FileSortDirection = 'asc' | 'desc';
export type FileSort = { column: FileSortColumn; direction: FileSortDirection };

export const DEFAULT_FILE_SORT: FileSort = { column: 'documentDate', direction: 'desc' };

function compareFileItems(left: FileBrowserItem, right: FileBrowserItem, column: FileSortColumn): number {
  if (column === 'name') return left.name.localeCompare(right.name);
  if (column === 'type') {
    return filesDrawerMeta(left.type).label.localeCompare(filesDrawerMeta(right.type).label);
  }
  if (column === 'size') return (left.sizeBytes || 0) - (right.sizeBytes || 0);
  return String(left.documentDate || '').localeCompare(String(right.documentDate || ''));
}

export function sortFileItems(
  items: FileBrowserItem[],
  sort: FileSort = DEFAULT_FILE_SORT,
): FileBrowserItem[] {
  const direction = sort.direction === 'asc' ? 1 : -1;
  return items.slice().sort((left, right) => {
    const primary = compareFileItems(left, right, sort.column);
    if (primary !== 0) return primary * direction;
    return left.name.localeCompare(right.name);
  });
}

export function visibleFileItems(
  items: FileBrowserItem[],
  query: string,
  type: FileTypeFilter,
  sort: FileSort = DEFAULT_FILE_SORT,
): FileBrowserItem[] {
  return sortFileItems(filterFileItems(searchFileItems(items, query), type), sort);
}

export function isSelectableFileItem(item: FileBrowserItem): boolean {
  return item.kind === 'file' && Boolean(item.fileId);
}

export type FileRegisterSummary = {
  fileCount: number;
  receiptCount: number;
  totalBytes: number;
  handoverPresent: number;
  handoverExpected: number;
};

export function fileRegisterSummary(items: FileBrowserItem[]): FileRegisterSummary {
  const files = (items || []).filter((item) => item.kind === 'file');
  const types = new Set(files.map((item) => item.type));
  return {
    fileCount: files.length,
    receiptCount: (items || []).length - files.length,
    totalBytes: files.reduce((sum, item) => sum + (Number(item.sizeBytes) || 0), 0),
    handoverPresent: HANDOVER_EXPECTED_TYPES.filter((type) => types.has(type)).length,
    handoverExpected: HANDOVER_EXPECTED_TYPES.length,
  };
}

export function formatFileRegisterSummary(summary: FileRegisterSummary): string {
  const parts: string[] = [];
  parts.push(summary.fileCount === 1 ? '1 file' : `${summary.fileCount} files`);
  if (summary.receiptCount > 0) {
    parts.push(summary.receiptCount === 1 ? '1 receipt' : `${summary.receiptCount} receipts`);
  }
  if (summary.totalBytes > 0) parts.push(formatJobFileSize(summary.totalBytes));
  parts.push(`${summary.handoverPresent} of ${summary.handoverExpected} handover types`);
  return parts.join(' · ');
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

export function fileLinkColumnLabel(
  linkedTo: JobFileLinkedTo | null | undefined,
  lookup: { expenses?: unknown[]; invoices?: unknown[] } = {},
): string {
  const label = fileLinkLabel(linkedTo, lookup);
  return label.replace(/^linked to /, '');
}

export function fileAddedByColumnLabel(
  item: FileBrowserItem,
  currentUid: string,
  currentName: string,
): string {
  if (item.kind === 'receipt') return 'Expense';
  if (item.uploadedBy && item.uploadedBy === currentUid) {
    return firstName(currentName) || 'You';
  }
  if (item.uploadedBy) return 'Teammate';
  return '';
}
