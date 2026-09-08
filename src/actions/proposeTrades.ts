/**
 * Propose a trade for each uncoded expense from evidence, never a model.
 * Party history on this org is strongest. A keyword in a description is a guess.
 * Already-coded rows are omitted. No evidence stays uncoded.
 */
import { INVESTOR_TRADE_ID, NOT_IN_ESTIMATE_TRADE_ID, expenseTradeId } from '../domain/costPlan';
import { isInvestorExpense } from '../domain/costPlanCore';
import { isVoidExpense } from '../utils/jobMetrics';
import { stripInstructionClauses } from './instructionText';

export type TradeRef = { id: string; name: string };

export type ProposeSource = 'record' | 'inferred' | null;
export type ProposeStatus = 'confident' | 'uncertain' | 'none';

export type TradeAlternative = {
  tradeId: string;
  tradeName: string;
  reason: string;
};

export type TradeProposal = {
  expenseId: string;
  proposedTradeId: string | null;
  proposedTradeName: string | null;
  reason: string;
  source: ProposeSource;
  alternatives?: TradeAlternative[];
  status: ProposeStatus;
};

export type ProposeTradesInput = {
  uncoded: Array<Record<string, unknown>>;
  orgCoded: Array<Record<string, unknown>>;
  trades: TradeRef[];
  sections?: TradeRef[];
};

const SPECIAL_TRADE = new Set([INVESTOR_TRADE_ID, NOT_IN_ESTIMATE_TRADE_ID]);

function asId(value: unknown): string {
  return String(value || '').trim();
}

function isLive(expense: Record<string, unknown> | null | undefined): boolean {
  return Boolean(expense) && !isVoidExpense(expense);
}

function storedTradeId(expense: Record<string, unknown> | null | undefined): string | null {
  const id = expenseTradeId(expense);
  if (!id || SPECIAL_TRADE.has(id)) return null;
  return id;
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsWholePhrase(haystack: string, phrase: string): boolean {
  const needle = phrase.trim().toLowerCase();
  if (!needle) return false;
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRe(needle)}([^a-z0-9]|$)`);
  return pattern.test(haystack);
}

const TRADE_ALIASES: Record<string, string[]> = {
  electrical: ['electrician', 'sparky'],
  plumbing: ['plumber'],
  carpentry: ['carpenter'],
  painting: ['painter'],
  roofing: ['roofer'],
  concreting: ['concreter', 'concrete'],
  brickwork: ['bricks', 'masonry', 'bricklayer'],
  hvac: ['aircon', 'air-conditioning'],
  'kitchen-joinery': ['joinery', 'kitchen'],
  plastering: ['plasterer'],
  'tiling-flooring': ['tiler', 'flooring'],
};

function sectionNameMatches(haystack: string, section: TradeRef): boolean {
  const name = String(section.name || '').trim();
  if (containsWholePhrase(haystack, name)) return true;
  const aliases = TRADE_ALIASES[asId(section.id)] || [];
  return aliases.some((alias) => containsWholePhrase(haystack, alias));
}

function expenseHaystack(expense: Record<string, unknown>): string {
  const raw = [
    expense.description,
    expense.itemName,
    expense.tradeName,
    expense.notes,
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ');
  return stripInstructionClauses(raw);
}

function tradeNameById(trades: TradeRef[], tradeId: string): string {
  const match = trades.find((trade) => trade.id === tradeId);
  return match?.name || tradeId;
}

function partyCounts(
  partyId: string,
  orgCoded: Array<Record<string, unknown>>,
): Map<string, number> {
  const counts = new Map<string, number>();
  orgCoded.forEach((row) => {
    if (!isLive(row)) return;
    if (asId(row.partyId) !== partyId) return;
    const tradeId = storedTradeId(row);
    if (!tradeId) return;
    counts.set(tradeId, (counts.get(tradeId) || 0) + 1);
  });
  return counts;
}

function uniqueLeader(counts: Map<string, number>): { tradeId: string; count: number } | null {
  let bestId = '';
  let bestCount = 0;
  let tied = false;
  counts.forEach((count, tradeId) => {
    if (count > bestCount) {
      bestId = tradeId;
      bestCount = count;
      tied = false;
      return;
    }
    if (count === bestCount && count > 0) tied = true;
  });
  if (!bestId || bestCount < 1 || tied) return null;
  return { tradeId: bestId, count: bestCount };
}

function matchingSections(haystack: string, sections: TradeRef[]): TradeRef[] {
  if (!haystack) return [];
  const hits: TradeRef[] = [];
  const seen = new Set<string>();
  sections.forEach((section) => {
    const id = asId(section.id);
    if (!id || SPECIAL_TRADE.has(id) || seen.has(id)) return;
    if (!sectionNameMatches(haystack, section)) return;
    seen.add(id);
    hits.push({ id, name: section.name });
  });
  return hits;
}

function categoryTrade(
  expense: Record<string, unknown>,
  trades: TradeRef[],
): TradeRef | null {
  if (String(expense.category || '').trim().toLowerCase() !== 'trade') return null;
  const label = String(expense.tradeName || '').trim().toLowerCase();
  if (!label) return null;
  const hits = trades.filter((trade) => (
    !SPECIAL_TRADE.has(trade.id)
    && String(trade.name || '').trim().toLowerCase() === label
  ));
  return hits.length === 1 ? hits[0] : null;
}

function noneProposal(expenseId: string, alternatives?: TradeAlternative[]): TradeProposal {
  const row: TradeProposal = {
    expenseId,
    proposedTradeId: null,
    proposedTradeName: null,
    reason: 'No evidence to code this.',
    source: null,
    status: 'none',
  };
  if (alternatives && alternatives.length > 0) row.alternatives = alternatives;
  return row;
}

function proposeOne(
  expense: Record<string, unknown>,
  orgCoded: Array<Record<string, unknown>>,
  trades: TradeRef[],
  sections: TradeRef[],
): TradeProposal {
  const expenseId = asId(expense.id);
  const partyId = asId(expense.partyId);
  if (partyId) {
    const counts = partyCounts(partyId, orgCoded);
    const leader = uniqueLeader(counts);
    if (leader && leader.count >= 2) {
      const alternatives: TradeAlternative[] = [];
      counts.forEach((count, tradeId) => {
        if (tradeId === leader.tradeId) return;
        alternatives.push({
          tradeId,
          tradeName: tradeNameById(trades, tradeId),
          reason: `Coded ${count} time${count === 1 ? '' : 's'} for this supplier.`,
        });
      });
      const row: TradeProposal = {
        expenseId,
        proposedTradeId: leader.tradeId,
        proposedTradeName: tradeNameById(trades, leader.tradeId),
        reason: `Coded to ${tradeNameById(trades, leader.tradeId)} ${leader.count} times for this supplier.`,
        source: 'record',
        status: 'confident',
      };
      if (alternatives.length > 0) row.alternatives = alternatives;
      return row;
    }
  }

  const haystack = expenseHaystack(expense);
  const sectionHits = matchingSections(haystack, sections);
  if (sectionHits.length === 1) {
    const hit = sectionHits[0];
    return {
      expenseId,
      proposedTradeId: hit.id,
      proposedTradeName: hit.name || tradeNameById(trades, hit.id),
      reason: `Description matches the ${hit.name} section.`,
      source: 'inferred',
      status: 'uncertain',
    };
  }

  const fromCategory = categoryTrade(expense, trades);
  if (fromCategory) {
    const alternatives = sectionHits.map((hit) => ({
      tradeId: hit.id,
      tradeName: hit.name,
      reason: `Description also matches ${hit.name}.`,
    }));
    const row: TradeProposal = {
      expenseId,
      proposedTradeId: fromCategory.id,
      proposedTradeName: fromCategory.name,
      reason: `Trade name matches ${fromCategory.name}.`,
      source: 'inferred',
      status: 'uncertain',
    };
    if (alternatives.length > 0) row.alternatives = alternatives;
    return row;
  }

  const alternatives = sectionHits.map((hit) => ({
    tradeId: hit.id,
    tradeName: hit.name,
    reason: `Description matches ${hit.name}.`,
  }));
  return noneProposal(expenseId, alternatives);
}

export function proposeTrades(input: ProposeTradesInput): TradeProposal[] {
  const trades = (input.trades || []).filter((trade) => trade && asId(trade.id));
  const sections = (input.sections || []).filter((section) => section && asId(section.id));
  const orgCoded = (input.orgCoded || []).filter(isLive);
  return (input.uncoded || [])
    .filter((expense) => {
      if (!expense || !asId(expense.id)) return false;
      if (!isLive(expense) || isInvestorExpense(expense)) return false;
      return !expenseTradeId(expense);
    })
    .map((expense) => proposeOne(expense, orgCoded, trades, sections));
}

export function splitTradeProposals(rows: TradeProposal[]): {
  confident: TradeProposal[];
  uncertain: TradeProposal[];
  none: TradeProposal[];
} {
  return {
    confident: rows.filter((row) => row.status === 'confident'),
    uncertain: rows.filter((row) => row.status === 'uncertain'),
    none: rows.filter((row) => row.status === 'none'),
  };
}
