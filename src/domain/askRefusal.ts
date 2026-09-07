/**
 * Machine-readable Ask refusals. Assigned in code after src/queries/
 * runs. The model must not invent the enum. Copy is derived here so
 * history can reopen from the stored reason without model prose.
 *
 * Does not write. Does not create a job facts record. Does not add a facts schema.
 */
import { z } from 'zod';

export const REFUSAL_REASONS = [
  'fact_missing',
  'nothing_coded',
  'unreadable_file',
  'out_of_scope',
] as const;

export type RefusalReason = (typeof REFUSAL_REASONS)[number];

export const refusalReasonSchema = z.enum(REFUSAL_REASONS);

export type RefusalCopy = {
  title: string;
  detail: string;
  actionNote?: string;
};

type FactKind = {
  id: string;
  phrase: string;
  pattern: RegExp;
};

const JOB_FACTS: FactKind[] = [
  { id: 'floor_area', phrase: 'the floor area', pattern: /\b(floor area|floorarea|sqm|square metres?|square meters?|m²|\bm2\b)\b/i },
  { id: 'storeys', phrase: 'how many storeys', pattern: /\b(storeys?|stories|how many floors)\b/i },
  { id: 'bedrooms', phrase: 'how many bedrooms', pattern: /\bbedrooms?\b/i },
  { id: 'address', phrase: 'the address', pattern: /\b((job|site|street) address|address of|what('?s| is) the address)\b/i },
  { id: 'lot', phrase: 'the lot', pattern: /\b(lot\s*(and|&)?\s*dp|lot number|lot\/dp)\b/i },
  { id: 'council', phrase: 'the council', pattern: /\bcouncil\b/i },
  { id: 'contract_value', phrase: 'the contract value', pattern: /\bcontract (value|sum|price|amount)\b/i },
];

function clip(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function namedTrade(params: { tradeId?: string; trade?: string } | undefined): string {
  return clip(params?.tradeId || params?.trade);
}

function provenanceCapped(result: unknown): boolean {
  if (!isRecord(result) || !isRecord(result.provenance)) return false;
  return result.provenance.capped === true;
}

function spendCodedCount(result: unknown): number | null {
  if (!isRecord(result) || result.ok !== true) return null;
  if (typeof result.count !== 'number' || !Number.isInteger(result.count)) return null;
  return result.count;
}

function planCodedCount(result: unknown, tradeKey: string): number | null {
  if (!isRecord(result) || result.ok !== true) return null;
  if (result.actualCents === null) return null;
  const trades = Array.isArray(result.trades) ? result.trades : [];
  const needle = tradeKey.toLowerCase();
  const row = trades.find((item) => {
    if (!isRecord(item)) return false;
    const id = clip(item.tradeId).toLowerCase();
    return id === needle || id === needle.replace(/\s+/g, '-');
  }) || (trades.length === 1 && isRecord(trades[0]) ? trades[0] : null);
  if (row && typeof row.count === 'number' && Number.isInteger(row.count)) return row.count;
  if (typeof result.actualCents === 'number' && result.actualCents === 0 && trades.length === 0) {
    return 0;
  }
  return null;
}

function passagesOf(result: unknown): Array<Record<string, unknown>> {
  if (!isRecord(result) || result.ok !== true || !Array.isArray(result.passages)) return [];
  return result.passages.filter(isRecord);
}

/** Document questions stay on answerFromDocuments. Legal advice stays out of scope. */
export function isDocumentWording(question: string): boolean {
  const q = clip(question);
  if (/\bwhat (does|did|do)\b[\s\S]{0,80}\bsay\b/i.test(q)) return true;
  if (/\bsay(s)? about\b/i.test(q) && /\b(contract|variation|permit|certificate|plan|document)\b/i.test(q)) {
    return true;
  }
  if (/\baccording to the (contract|variation|permit|certificate|site plan)\b/i.test(q)) return true;
  return false;
}

export function isLegalAdviceWording(question: string): boolean {
  return /\b(legal advice|lawyer|solicitor|\bsue\b)\b/i.test(clip(question));
}

export function jobFactFromQuestion(question: string): FactKind | null {
  const q = clip(question);
  if (!q) return null;
  if (isDocumentWording(q) || isLegalAdviceWording(q)) return null;
  for (const fact of JOB_FACTS) {
    if (fact.pattern.test(q)) return fact;
  }
  return null;
}

export function looksLikeJobFactQuestion(question: string): boolean {
  return jobFactFromQuestion(question) != null;
}

export function nearestHonestQuestion(question: string): string {
  const q = clip(question).toLowerCase();
  if (/\b(will we finish|will this job make|forecast|predict|under budget|make a profit|next quarter|next year)\b/.test(q)) {
    return 'You can ask how estimated compares with spent on this job.';
  }
  if (/\b(sue|legal advice|lawyer|solicitor)\b/.test(q)) {
    return 'You can ask what a filed contract says.';
  }
  if (/\b(create an expense|void (this |the )?invoice|delete this|code this trade)\b/.test(q)) {
    return 'Ask does not write. You can ask how much has been spent, or estimated against spent.';
  }
  if (/\badd\b.+\band\b.+\btogether\b/.test(q)) {
    return 'Each trade is answered on its own. You can ask how much was spent on one trade.';
  }
  return 'You can ask about spend, estimated against spent, files, or invoices.';
}

export function nothingCodedCopy(tradeName: string): RefusalCopy {
  const trade = clip(tradeName).replace(/-/g, ' ').toLowerCase() || 'that trade';
  return {
    title: `No expenses are coded to ${trade} yet, so there is nothing to compare against the estimate.`,
    detail: 'Code them on Cost plan.',
  };
}

export function factMissingCopy(question: string): RefusalCopy {
  const fact = jobFactFromQuestion(question);
  const phrase = fact?.phrase || 'that fact';
  return {
    title: `I do not know ${phrase}. It is not recorded on this job.`,
    detail: 'Add it once it is stored on the job. Ask does not write it.',
  };
}

export function unreadableFileCopy(input: {
  name?: string;
  type?: string;
  textStatus?: string;
}): RefusalCopy {
  const name = clip(input.name).toLowerCase();
  const type = clip(input.type).toLowerCase();
  const isPlan = type === 'plan' || /\bsite plan\b/.test(name) || name.includes('site-plan');
  const scan = !input.textStatus || input.textStatus === 'none';
  if (scan) {
    return {
      title: isPlan
        ? 'The site plan is a scan with no text layer, so I cannot read it.'
        : 'That file is a scan with no text layer, so I cannot read it.',
      detail: 'Open the file.',
    };
  }
  return {
    title: isPlan ? 'The site plan cannot be read.' : 'That file cannot be read.',
    detail: 'Open the file.',
  };
}

export function outOfScopeCopy(question: string, hasKnownFigures: boolean): RefusalCopy {
  const nearest = nearestHonestQuestion(question);
  return {
    title: "I can't answer that honestly.",
    detail: hasKnownFigures
      ? `${nearest} Here is what it does know.`
      : nearest,
  };
}

export function copyForRefusal(input: {
  reason: RefusalReason;
  question?: string;
  tradeName?: string;
  fileName?: string;
  fileType?: string;
  textStatus?: string;
  hasKnownFigures?: boolean;
}): RefusalCopy {
  if (input.reason === 'nothing_coded') return nothingCodedCopy(input.tradeName || '');
  if (input.reason === 'fact_missing') return factMissingCopy(input.question || '');
  if (input.reason === 'unreadable_file') {
    return unreadableFileCopy({
      name: input.fileName,
      type: input.fileType,
      textStatus: input.textStatus,
    });
  }
  return outOfScopeCopy(input.question || '', Boolean(input.hasKnownFigures));
}

export function isUnreadableDocumentsResult(result: unknown): boolean {
  const passages = passagesOf(result);
  if (passages.length === 0) return false;
  if (passages.some((row) => row.match === 'quoted')) return false;
  return passages.every((row) => row.match === 'unreadable');
}

export function firstUnreadablePassage(result: unknown): Record<string, unknown> | null {
  const passages = passagesOf(result);
  return passages.find((row) => row.match === 'unreadable') || null;
}

/**
 * Pick the enum from the routed query + the code result.
 * Ignores model `reason` / `sentence`. Never reads an expectedQuery.
 */
export function assignRefusalReason(input: {
  query: string;
  params?: { tradeId?: string; trade?: string };
  result?: unknown;
  question?: string;
}): RefusalReason | undefined {
  const query = clip(input.query);
  const trade = namedTrade(input.params);
  const capped = provenanceCapped(input.result);

  if ((query === 'spendByTrade' || query === 'planVsActual') && trade && !capped) {
    const count = query === 'spendByTrade'
      ? spendCodedCount(input.result)
      : planCodedCount(input.result, trade);
    if (count === 0) return 'nothing_coded';
  }

  if (query === 'answerFromDocuments' && isUnreadableDocumentsResult(input.result)) {
    return 'unreadable_file';
  }

  if (query === 'none') {
    if (looksLikeJobFactQuestion(input.question || '')) return 'fact_missing';
    return 'out_of_scope';
  }

  return undefined;
}
