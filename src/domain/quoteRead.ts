import { isYmd } from '../dates';
import { dollarsFromUnknown } from '../money';

export type QuoteGstMode = 'inclusive' | 'exclusive';

export type QuoteFormDraft = {
  party: string;
  receivedDate: string;
  amount: string;
  amountHigh: string;
  gstMode: QuoteGstMode;
  allocations: Array<{ tradeId: string; amount: string }>;
  note: string;
};

export type QuoteReadUncertain = {
  party?: boolean;
  receivedDate?: boolean;
  amount?: boolean;
  gstMode?: boolean;
  tradeId?: boolean;
};

export type QuoteReadResult = {
  party: string;
  receivedDate: string | null;
  amount: string | null;
  amountHigh: string | null;
  gstMode: QuoteGstMode | null;
  tradeId: string | null;
  quoteNumber: string | null;
  note: string | null;
  warnings: string[];
  uncertain: QuoteReadUncertain;
};

type NamedTrade = { id: string; name?: string; status?: string };

function clip(value: unknown, max: number): string {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function asGstMode(value: unknown): QuoteGstMode | null {
  return value === 'exclusive' || value === 'inclusive' ? value : null;
}

function dollarsToForm(value: unknown): string | null {
  const dollars = dollarsFromUnknown(value);
  if (!(dollars > 0)) return null;
  if (Number.isInteger(dollars)) return String(dollars);
  return dollars.toFixed(2);
}

function dateToYmd(value: unknown): string | null {
  const text = clip(value, 32);
  if (isYmd(text)) return text;
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const ymd = `${year}-${month}-${day}`;
  return isYmd(ymd) ? ymd : null;
}

export function isQuoteReadableFile(file: { name?: string; type?: string } | null | undefined): boolean {
  if (!file) return false;
  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  if (type.startsWith('image/') && !type.includes('svg') && !type.includes('dwg')) return true;
  if (type === 'application/pdf' || name.endsWith('.pdf')) return true;
  return false;
}

export function matchQuoteTradeId(
  hint: unknown,
  trades: NamedTrade[] = [],
): string | null {
  const active = (trades || []).filter((trade) => trade && trade.id && trade.status !== 'archived');
  const raw = clip(hint, 80);
  if (!raw || active.length === 0) return null;
  const lowered = raw.toLowerCase();
  const byId = active.find((trade) => trade.id === raw || trade.id === lowered);
  if (byId) return byId.id;
  const matches = active.filter((trade) => {
    const name = String(trade.name || '').trim().toLowerCase();
    if (!name) return false;
    return name === lowered
      || (name.length >= 4 && (lowered.includes(name) || name.includes(lowered)));
  });
  return matches.length === 1 ? matches[0].id : null;
}

export function sanitizeQuoteRead(
  raw: unknown,
  trades: NamedTrade[] = [],
): QuoteReadResult {
  const row = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const warnings = Array.isArray(row.warnings)
    ? row.warnings.map((item) => clip(item, 240)).filter(Boolean).slice(0, 8)
    : [];
  const party = clip(row.party, 120);
  const receivedDate = dateToYmd(row.receivedDate);
  const amount = dollarsToForm(row.amount);
  const amountHigh = dollarsToForm(row.amountHigh);
  const gstMode = asGstMode(row.gstMode);
  const tradeId = matchQuoteTradeId(row.tradeId || row.trade, trades);
  const quoteNumber = clip(row.quoteNumber, 80) || null;
  const note = clip(row.note, 400) || null;
  const warningText = warnings.join(' ').toLowerCase();
  const uncertain: QuoteReadUncertain = {};
  if (!party || /who quoted|supplier|party|vendor/.test(warningText)) uncertain.party = true;
  if (!receivedDate || /\bdate\b/.test(warningText)) uncertain.receivedDate = true;
  if (!amount || /amount|total/.test(warningText)) uncertain.amount = true;
  if (!gstMode || /\bgst\b/.test(warningText)) uncertain.gstMode = true;
  if (!tradeId || /trade/.test(warningText)) uncertain.tradeId = true;
  return {
    party,
    receivedDate,
    amount,
    amountHigh: amountHigh && amount && Number(amountHigh) > Number(amount) ? amountHigh : null,
    gstMode,
    tradeId,
    quoteNumber,
    note,
    warnings,
    uncertain,
  };
}

function empty(value: string | null | undefined): boolean {
  return !String(value || '').trim();
}

export function applyQuoteAutofill(
  current: QuoteFormDraft,
  read: QuoteReadResult,
  options: { overwrite?: boolean; fallbackTradeId?: string | null } = {},
): QuoteFormDraft {
  const overwrite = Boolean(options.overwrite);
  const party = overwrite || empty(current.party) ? (read.party || current.party) : current.party;
  const receivedDate = overwrite || empty(current.receivedDate)
    ? (read.receivedDate || current.receivedDate)
    : current.receivedDate;
  const amount = overwrite || empty(current.amount) ? (read.amount || current.amount) : current.amount;
  const amountHigh = overwrite || empty(current.amountHigh)
    ? (read.amountHigh || current.amountHigh)
    : current.amountHigh;
  const gstMode = overwrite
    ? (read.gstMode || current.gstMode)
    : (current.gstMode === 'inclusive' && read.gstMode ? read.gstMode : current.gstMode);
  let note = current.note;
  if (overwrite || empty(current.note)) {
    note = [read.quoteNumber ? `Quote ${read.quoteNumber}` : '', read.note].filter(Boolean).join(' — ');
  }
  const currentTradeId = current.allocations[0]?.tradeId || '';
  const tradeId = overwrite || empty(currentTradeId)
    ? (read.tradeId || options.fallbackTradeId || currentTradeId)
    : currentTradeId;
  const split = current.allocations.filter((row) => row.tradeId && row.amount).length > 1;
  const allocations = !overwrite && split
    ? current.allocations
    : [{ tradeId, amount: amount || current.allocations[0]?.amount || '' }];
  return {
    party,
    receivedDate,
    amount,
    amountHigh,
    gstMode,
    allocations,
    note,
  };
}

export function quoteCheckFields(
  current: QuoteFormDraft,
  next: QuoteFormDraft,
  read: QuoteReadResult,
  overwrite = false,
): QuoteReadUncertain {
  const flags: QuoteReadUncertain = {};
  if (overwrite || empty(current.party)) {
    if (read.uncertain.party || empty(next.party)) flags.party = true;
  }
  if (overwrite || empty(current.receivedDate)) {
    if (read.uncertain.receivedDate || empty(next.receivedDate)) flags.receivedDate = true;
  }
  if (overwrite || empty(current.amount)) {
    if (read.uncertain.amount || empty(next.amount)) flags.amount = true;
  }
  if (overwrite || current.gstMode === 'inclusive') {
    if (read.uncertain.gstMode) flags.gstMode = true;
  }
  const currentTradeId = current.allocations[0]?.tradeId || '';
  if (overwrite || empty(currentTradeId)) {
    if (read.uncertain.tradeId || empty(next.allocations[0]?.tradeId)) flags.tradeId = true;
  }
  return flags;
}
