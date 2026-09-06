import { cents, parseToCents, type Cents } from '../money';
import type { CostPlanLine, CostPlanSection } from './schemas';
import { APP_TRADES, sumSectionAmounts } from './costPlan';

export const IMPORT_COLUMNS = [
  'ignore',
  'code',
  'description',
  'section',
  'qty',
  'unit',
  'unitPrice',
  'amount',
] as const;

export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

export type ImportRow = {
  code: string;
  description: string;
  section: string;
  qty: number | null;
  unit: string;
  unitPriceCents: number | null;
  totalCents: number;
};

export type SourceSection = {
  key: string;
  code: string;
  name: string;
  amountCents: Cents;
  rows: ImportRow[];
  duplicateCodes: string[];
};

export type ColumnMap = Record<number, ImportColumn>;

export const IMPORT_COLUMN_STORAGE_KEY = 'risingAmp.costPlan.importColumns';

export function parseDelimitedText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const source = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',' || ch === '\t' || ch === ';') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((value) => String(value).trim())) rows.push(row);
  }
  return rows;
}

export async function parseSpreadsheetFile(file: File): Promise<{ sheetName: string; rows: string[][] }[]> {
  const name = String(file?.name || '').toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.txt') || file.type === 'text/csv' || file.type === 'text/plain') {
    const text = await file.text();
    return [{ sheetName: file.name || 'Sheet', rows: parseDelimitedText(text) }];
  }

  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);
  const sheets: { sheetName: string; rows: string[][] }[] = [];
  workbook.worksheets.forEach((sheet) => {
    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      rows.push(values.map(cellToText));
    });
    if (rows.length) sheets.push({ sheetName: sheet.name || 'Sheet', rows });
  });
  return sheets;
}

/**
 * ExcelJS does not hand back plain values. A calculated cell is
 * `{ formula, result }`, a styled one is `{ richText: [...] }`, a link is
 * `{ text, hyperlink }`. `String(value)` on any of those yields
 * "[object Object]", which parses to zero. Every Total column in a real
 * estimate is a formula, so this is the difference between reading the file
 * and reading $0.00 for the whole thing.
 */
export function cellToText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const cell = value as Record<string, unknown>;
    if ('result' in cell) return cellToText(cell.result);
    if ('error' in cell) return '';
    if (Array.isArray(cell.richText)) {
      return cell.richText.map((part) => cellToText((part as { text?: unknown }).text)).join('');
    }
    if ('text' in cell) return cellToText(cell.text);
    if ('hyperlink' in cell) return cellToText(cell.hyperlink);
    return '';
  }
  return String(value);
}

function looksLike(header: string, pattern: RegExp): boolean {
  return pattern.test(String(header || '').trim().toLowerCase());
}

export function guessColumnMap(headers: string[] = []): ColumnMap {
  const map: ColumnMap = {};
  headers.forEach((header, index) => {
    if (looksLike(header, /^(item\s*)?code$|^ref$|^no\.?$/)) map[index] = 'code';
    else if (looksLike(header, /desc|particular|item name|narrative/)) map[index] = 'description';
    else if (looksLike(header, /section|heading|trade|group/)) map[index] = 'section';
    else if (looksLike(header, /^qty$|quantity/)) map[index] = 'qty';
    else if (looksLike(header, /^unit$|^uom$/)) map[index] = 'unit';
    else if (looksLike(header, /unit.?price|rate/)) map[index] = 'unitPrice';
    else if (looksLike(header, /amount|total|cost|price/)) map[index] = 'amount';
    else map[index] = 'ignore';
  });
  return map;
}

function cell(row: string[], index: number | undefined): string {
  if (index == null) return '';
  return String(row[index] ?? '').trim();
}

function moneyCell(value: string): number {
  try {
    return parseToCents(value);
  } catch {
    return 0;
  }
}

export function applyColumnMap(
  rows: string[][],
  map: ColumnMap,
  headerRowIndex = 0,
): ImportRow[] {
  const indexes: Partial<Record<ImportColumn, number>> = {};
  Object.entries(map).forEach(([index, role]) => {
    if (role !== 'ignore') indexes[role] = Number(index);
  });
  return rows.slice(headerRowIndex + 1).map((row) => {
    const qtyRaw = cell(row, indexes.qty);
    const qty = qtyRaw === '' ? null : Number(qtyRaw.replace(/,/g, ''));
    const unitPriceRaw = cell(row, indexes.unitPrice);
    return {
      code: cell(row, indexes.code),
      description: cell(row, indexes.description),
      section: cell(row, indexes.section),
      qty: qty != null && Number.isFinite(qty) ? qty : null,
      unit: cell(row, indexes.unit),
      unitPriceCents: unitPriceRaw ? moneyCell(unitPriceRaw) : null,
      totalCents: moneyCell(cell(row, indexes.amount)),
    };
  }).filter((row) => (
    row.description || row.section || row.code || row.totalCents !== 0
  ));
}

export function groupImportRows(rows: ImportRow[]): SourceSection[] {
  const grouped = new Map<string, SourceSection>();
  const codeOwners = new Map<string, Set<string>>();
  rows.forEach((row) => {
    const name = row.section || row.description || 'Untitled section';
    const key = name.toLowerCase();
    if (row.code) {
      const owners = codeOwners.get(row.code) || new Set<string>();
      owners.add(name);
      codeOwners.set(row.code, owners);
    }
    const current = grouped.get(key) || {
      key,
      code: row.code,
      name,
      amountCents: cents(0),
      rows: [],
      duplicateCodes: [],
    };
    current.rows.push(row);
    current.amountCents = cents(current.amountCents + Math.max(0, row.totalCents));
    if (row.code && !current.code) current.code = row.code;
    grouped.set(key, current);
  });
  const duplicateCodes = Array.from(codeOwners.entries())
    .filter(([, owners]) => owners.size > 1)
    .map(([code]) => code);
  return Array.from(grouped.values()).map((section) => ({
    ...section,
    duplicateCodes: section.rows
      .map((row) => row.code)
      .filter((code) => code && duplicateCodes.includes(code)),
  }));
}

export function importWarnings(sections: SourceSection[]): string[] {
  const warnings: string[] = [];
  const seen = new Map<string, string[]>();
  sections.forEach((section) => {
    section.rows.forEach((row) => {
      if (!row.code) return;
      const owners = seen.get(row.code) || [];
      if (!owners.includes(section.name)) owners.push(section.name);
      seen.set(row.code, owners);
    });
  });
  seen.forEach((owners, code) => {
    if (owners.length > 1) {
      warnings.push(`${code} is used for ${owners.join(' and ')}. Codes are labels, not identifiers.`);
    }
  });
  const missing = sections.filter((section) => !section.code);
  if (missing.length > 0) {
    warnings.push(`${missing.length} section${missing.length === 1 ? '' : 's'} have no source code. That is fine — the name is used instead.`);
  }
  return warnings;
}

export function guessTradeIdForSection(name: string): string | null {
  const haystack = String(name || '').trim().toLowerCase();
  if (!haystack) return null;
  const matches = APP_TRADES.filter((trade) => haystack.includes(trade.name.toLowerCase()));
  if (matches.length === 1) return matches[0].id;
  return null;
}

export function isEstimateSpreadsheetFile(file: File | null | undefined): boolean {
  if (!file) return false;
  const name = String(file.name || '').toLowerCase();
  return name.endsWith('.xlsx')
    || name.endsWith('.xls')
    || name.endsWith('.csv')
    || name.endsWith('.txt')
    || file.type === 'text/csv'
    || file.type === 'text/plain'
    || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    || file.type === 'application/vnd.ms-excel';
}

/** Apply typed amounts onto source sections. Invalid text keeps the file figure. */
export function applySectionAmountEdits<T extends { key: string; amountCents: number }>(
  sections: T[],
  amountTextByKey: Record<string, string | undefined>,
): T[] {
  return sections.map((section) => {
    const text = amountTextByKey[section.key];
    if (text == null) return section;
    try {
      const parsed = parseToCents(text);
      const amountCents = parsed < 0 ? 0 : parsed;
      if (amountCents === section.amountCents) return section;
      return { ...section, amountCents };
    } catch {
      return section;
    }
  });
}

export function sectionAmountsWereEdited(
  sections: Array<{ key: string; amountCents: number }>,
  amountTextByKey: Record<string, string | undefined>,
): boolean {
  return applySectionAmountEdits(sections, amountTextByKey)
    .some((section, index) => section.amountCents !== sections[index].amountCents);
}

export function buildImportedSections(
  sections: SourceSection[],
  tradeBySection: Record<string, string>,
  tradeNames: Record<string, string>,
): CostPlanSection[] {
  const byTrade = new Map<string, CostPlanSection>();
  sections.forEach((section) => {
    const tradeId = tradeBySection[section.key];
    if (!tradeId) return;
    const current = byTrade.get(tradeId) || {
      id: tradeId,
      tradeId,
      name: tradeNames[tradeId] || section.name,
      order: byTrade.size,
      amountCents: 0,
      lines: [] as CostPlanLine[],
    };
    current.amountCents += section.amountCents;
    current.lines = [
      ...(current.lines || []),
      ...section.rows.map((row) => ({
        code: row.code || undefined,
        description: row.description || row.section || section.name,
        qty: row.qty,
        unit: row.unit || undefined,
        unitPriceCents: row.unitPriceCents,
        totalCents: row.totalCents,
      })),
    ];
    byTrade.set(tradeId, current);
  });
  return Array.from(byTrade.values()).map((section, index) => ({
    ...section,
    order: index,
    amountCents: Math.round(section.amountCents),
  }));
}

export function reconcileImportedPlan(
  sections: CostPlanSection[],
  targetCents: number | null,
): { ok: boolean; totalCents: Cents; issues: string[] } {
  const totalCents = sumSectionAmounts(sections);
  const issues: string[] = [];
  if (sections.length === 0) issues.push('Map at least one section to a trade before saving.');
  if (targetCents != null && totalCents !== targetCents) {
    issues.push(`Imported total ${totalCents} cents does not match the target ${targetCents} cents.`);
  }
  return { ok: issues.length === 0, totalCents, issues };
}
