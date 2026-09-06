import { z } from 'zod';
import { getExpenseTotalCents, isVoidExpense } from '../utils/jobMetrics';
import { expenseCalendarYmd, idBucketKey } from '../domain/ledgerRollup';
import {
  compactParams,
  firstZodIssue,
  invalidInput,
  jobsById,
  needleOf,
  provenanceSchema,
  queryScopeSchema,
  resolveTargetJobIds,
  textHaystack,
  textMatches,
  ymdSchema,
  type JobMoneySnapshot,
} from './core';
import { expenseInRange, isYmdRange } from './dates';

const inputSchema = z.object({
  scope: queryScopeSchema,
  jobId: z.string().min(1).optional(),
  partyId: z.string().max(80).optional(),
  text: z.string().max(500).optional(),
  from: ymdSchema.optional(),
  to: ymdSchema.optional(),
  jobs: z.array(z.custom<JobMoneySnapshot>()).optional(),
});

const expenseRowSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  partyId: z.string(),
  description: z.string(),
  cents: z.number().int().nonnegative(),
  date: z.string().nullable(),
  category: z.string(),
});

export const findExpensesResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    expenses: z.array(expenseRowSchema),
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

export type FindExpensesResult = z.infer<typeof findExpensesResultSchema>;

function expenseLabel(expense: Record<string, unknown>): string {
  return String(
    expense.description
    || expense.itemName
    || expense.tradeName
    || expense.supplier
    || expense.category
    || 'Expense',
  );
}

export function findExpenses(input: unknown): FindExpensesResult {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return invalidInput(firstZodIssue(parsed.error));
  if (!isYmdRange(parsed.data.from, parsed.data.to)) {
    return invalidInput('from and to must be YYYY-MM-DD calendar dates, with from not after to.');
  }
  const access = resolveTargetJobIds(parsed.data.scope, parsed.data.jobId);
  if (!access.ok) return access;

  const partyKey = parsed.data.partyId ? idBucketKey(parsed.data.partyId) : undefined;
  const needle = needleOf(parsed.data.text);
  const byJob = jobsById(parsed.data.jobs);
  const rows: Array<z.infer<typeof expenseRowSchema>> = [];
  let capped = false;

  for (const jobId of access.jobIds) {
    const job = byJob.get(jobId);
    if (job?.expensesCapped) capped = true;
    (job?.expenses || []).forEach((expense) => {
      if (!expense || isVoidExpense(expense)) return;
      if (partyKey && idBucketKey(expense.partyId) !== partyKey) return;
      if (!expenseInRange(expense, parsed.data.from, parsed.data.to)) return;
      if (needle) {
        const haystack = textHaystack(
          expense.description,
          expense.itemName,
          expense.tradeName,
          expense.supplier,
          expense.category,
          expense.serviceName,
          expense.note,
          expense.notes,
        );
        if (!textMatches(haystack, needle)) return;
      }
      rows.push({
        id: String(expense.id || ''),
        jobId,
        partyId: idBucketKey(expense.partyId),
        description: expenseLabel(expense),
        cents: getExpenseTotalCents(expense),
        date: expenseCalendarYmd(expense),
        category: String(expense.category || 'uncategorized'),
      });
    });
  }

  const expenses = rows.filter((row) => row.id);
  return findExpensesResultSchema.parse({
    ok: true,
    expenses,
    provenance: {
      query: 'findExpenses',
      params: compactParams({
        jobId: parsed.data.jobId,
        partyId: partyKey,
        text: parsed.data.text,
        from: parsed.data.from,
        to: parsed.data.to,
      }),
      source: 'ledger',
      rowCount: expenses.length,
      capped,
    },
  });
}
