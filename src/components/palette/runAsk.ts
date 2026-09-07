/**
 * Run one routed Ask choice through src/queries/. Palette chunk only.
 * Do not import from App.js or PaletteHost.
 */
import { historyChoiceFromRoute, type AskHistoryChoice } from '../../domain/askHistory';
import type { QueryScope } from '../../queries/core';
import type { TradeListRow, RoutedAskChoice, RoutedAskParams, RoutedPaletteItem } from './answers';
import { itemsFromRoutedQuery, matchTrades, shouldUsePlanForNone } from './answers';

export type RunAskInput = {
  question: string;
  orgId: string;
  jobId: string | null;
  scope: QueryScope;
  tradeList?: TradeListRow[] | null;
  jobLabel?: string;
};

function allowedJob(scope: QueryScope, jobId: string | undefined): string | undefined {
  if (!jobId) return undefined;
  return scope.allowedJobIds.includes(jobId) ? jobId : undefined;
}

function resolveTradeId(params: RoutedAskParams, tradeList: TradeListRow[] | null | undefined): string | undefined {
  if (params.tradeId) return params.tradeId;
  if (!params.trade) return undefined;
  const listed = (tradeList || []).find((row) => (
    row.id === params.trade || row.name.toLowerCase() === String(params.trade).toLowerCase()
  ));
  if (listed) return listed.id;
  const hits = matchTrades(tradeList, params.trade);
  if (hits.length === 1) return hits[0].id;
  return params.trade;
}

function resolveParams(
  choice: RoutedAskChoice,
  scope: QueryScope,
  scopedJobId: string | null,
  tradeList: TradeListRow[] | null | undefined,
): RoutedAskParams {
  const jobId = allowedJob(scope, choice.params.jobId) || allowedJob(scope, scopedJobId || undefined);
  const tradeId = resolveTradeId(choice.params, tradeList);
  const partyId = choice.params.partyId || choice.params.party;
  return {
    ...choice.params,
    jobId: choice.query === 'portfolioSummary' ? undefined : jobId,
    tradeId,
    partyId,
  };
}

function needsJob(query: RoutedAskChoice['query']): boolean {
  return query === 'planVsActual' || query === 'jobSummary' || query === 'quotesForTrade';
}

async function runRoutedQuery(
  choice: RoutedAskChoice,
  params: RoutedAskParams,
  scope: QueryScope,
): Promise<unknown> {
  if (choice.query === 'none') return null;
  if (needsJob(choice.query) && !params.jobId) {
    return { ok: false, error: { code: 'invalid_input', message: 'That question needs a job.' } };
  }
  const fetchMod = await import('../../queries/fetch');
  switch (choice.query) {
    case 'spendByTrade':
      return fetchMod.fetchSpendByTrade({
        scope,
        jobId: params.jobId,
        tradeId: params.tradeId,
        from: params.from,
        to: params.to,
      });
    case 'spendByParty':
      return fetchMod.fetchSpendByParty({
        scope,
        jobId: params.jobId,
        partyId: params.partyId,
        from: params.from,
        to: params.to,
      });
    case 'spendByCategory':
      return fetchMod.fetchSpendByCategory({
        scope,
        jobId: params.jobId,
        category: params.category,
        from: params.from,
        to: params.to,
      });
    case 'planVsActual':
      return fetchMod.fetchPlanVsActual({
        scope,
        jobId: params.jobId as string,
        tradeId: params.tradeId,
      });
    case 'invoicesByStatus':
      return fetchMod.fetchInvoicesByStatus({
        scope,
        jobId: params.jobId,
        status: params.status,
        olderThanDays: params.olderThanDays,
      });
    case 'jobSummary':
      return fetchMod.fetchJobSummary({
        scope,
        jobId: params.jobId as string,
        period: params.period,
      });
    case 'portfolioSummary':
      return fetchMod.fetchPortfolioSummary({ scope });
    case 'findFiles':
      return fetchMod.fetchFindFiles({
        scope,
        jobId: params.jobId,
        type: params.type,
        text: params.text,
      });
    case 'findExpenses':
      return fetchMod.fetchFindExpenses({
        scope,
        jobId: params.jobId,
        partyId: params.partyId,
        text: params.text,
        from: params.from,
        to: params.to,
      });
    case 'quotesForTrade':
      return fetchMod.fetchQuotesForTrade({
        scope,
        jobId: params.jobId as string,
        tradeId: params.tradeId,
      });
    default:
      return { ok: false, error: { code: 'invalid_input', message: 'That cannot be answered from the records.' } };
  }
}

/** Safe related read for a none route: planVsActual when the job has a plan, else jobSummary. */
async function loadRelatedForNone(scope: QueryScope, jobId: string | undefined): Promise<unknown> {
  const allowed = allowedJob(scope, jobId);
  if (!allowed) return null;
  const fetchMod = await import('../../queries/fetch');
  const plan = await fetchMod.fetchPlanVsActual({ scope, jobId: allowed });
  if (shouldUsePlanForNone(plan)) return plan;
  return fetchMod.fetchJobSummary({ scope, jobId: allowed });
}

export type AskExecution = {
  items: RoutedPaletteItem[];
  choices: AskHistoryChoice[];
};

export async function executeAskQuestion(input: RunAskInput): Promise<AskExecution> {
  const { callAskRisingAmp } = await import('../../ask/askRisingAmp');
  const route = await callAskRisingAmp({
    question: input.question,
    orgId: input.orgId,
    jobId: input.jobId,
  });
  const items: RoutedPaletteItem[] = [];
  const choices: AskHistoryChoice[] = [];
  for (const raw of route.choices) {
    const choice: RoutedAskChoice = raw.query === 'none'
      ? { query: 'none', params: {}, reason: raw.reason }
      : { query: raw.query, params: raw.params, sentence: raw.sentence };
    const params = resolveParams(choice, input.scope, input.jobId, input.tradeList);
    const resolved: RoutedAskChoice = choice.query === 'none'
      ? { ...choice, params: { jobId: params.jobId } }
      : { ...choice, params };
    const result = resolved.query === 'none'
      ? await loadRelatedForNone(input.scope, params.jobId)
      : await runRoutedQuery(resolved, params, input.scope);
    items.push(...itemsFromRoutedQuery({
      choice: resolved,
      result,
      tradeList: input.tradeList,
      jobLabel: input.jobLabel,
    }));
    choices.push(historyChoiceFromRoute(resolved, result));
  }
  return { items, choices };
}
