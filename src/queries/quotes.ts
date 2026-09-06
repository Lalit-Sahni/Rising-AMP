import { z } from 'zod';
import type { CostPlanQuote } from '../domain/schemas';
import {
  compactParams,
  firstZodIssue,
  invalidInput,
  provenanceSchema,
  queryScopeSchema,
  resolveTargetJobIds,
} from './core';

export type QuotesSnapshot = {
  jobId: string;
  quotes: CostPlanQuote[];
};

const inputSchema = z.object({
  scope: queryScopeSchema,
  jobId: z.string().min(1),
  tradeId: z.string().min(1).max(80),
  quotes: z.array(z.custom<CostPlanQuote>()).optional(),
});

const quoteRowSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  party: z.string(),
  partyId: z.string().nullable(),
  status: z.string(),
  amountCents: z.number().int().nonnegative(),
  tradeCents: z.number().int().nonnegative(),
});

export const quotesForTradeResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    quotes: z.array(quoteRowSchema),
    provenance: provenanceSchema,
  }),
  z.object({
    ok: z.literal(false),
    error: z.object({
      code: z.enum(['job_not_allowed', 'invalid_input', 'org_required']),
      message: z.string(),
    }),
  }),
]);

export type QuotesForTradeResult = z.infer<typeof quotesForTradeResultSchema>;

export function quotesForTrade(input: unknown): QuotesForTradeResult {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return invalidInput(firstZodIssue(parsed.error));
  const access = resolveTargetJobIds(parsed.data.scope, parsed.data.jobId);
  if (!access.ok) return access;

  const tradeId = parsed.data.tradeId.trim();
  const quotes = (parsed.data.quotes || [])
    .filter((quote) => quote && quote.status !== 'void')
    .map((quote) => {
      const allocation = (quote.allocations || []).find((row) => row.tradeId === tradeId);
      if (!allocation) return null;
      return {
        id: String(quote.id || ''),
        jobId: parsed.data.jobId,
        party: quote.party,
        partyId: quote.partyId ?? null,
        status: quote.status,
        amountCents: quote.amountCents,
        tradeCents: allocation.amountCents,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row && row.id));

  return quotesForTradeResultSchema.parse({
    ok: true,
    quotes,
    provenance: {
      query: 'quotesForTrade',
      params: compactParams({
        jobId: parsed.data.jobId,
        tradeId,
      }),
      source: 'ledger',
      rowCount: quotes.length,
      capped: false,
    },
  });
}
