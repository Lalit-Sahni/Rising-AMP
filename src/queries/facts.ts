/**
 * Recorded job facts. Reads the facts document the app already stores.
 * Never calculates (no imperial conversion, no GST derivation, no rate times qty). Never writes.
 */
import { z } from 'zod';
import {
  JOB_FACT_FIELD_KIND,
  JOB_FACT_FIELD_NAMES,
  factSourceSchema,
  formatAreaSqm,
  formatFactMoney,
  isFactConfirmed,
  type FactLike,
  type JobFactFieldName,
  type JobFacts,
} from '../domain/jobFacts';
import {
  compactParams,
  firstZodIssue,
  invalidInput,
  provenanceSchema,
  queryScopeSchema,
  resolveTargetJobIds,
} from './core';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

const LEAD_FIELDS: JobFactFieldName[] = ['address', 'floorArea', 'contractValueCents'];

const inputSchema = z.object({
  scope: queryScopeSchema,
  jobId: z.string().min(1),
  field: z.enum(JOB_FACT_FIELD_NAMES).optional(),
  facts: z.custom<JobFacts | null>().optional(),
});

const factRowSchema = z.object({
  field: z.enum(JOB_FACT_FIELD_NAMES),
  display: z.string().min(1),
  source: factSourceSchema,
  confirmed: z.boolean(),
  cents: z.number().int().positive().optional(),
});

export const jobFactsResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    fields: z.array(factRowSchema),
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

export type JobFactsQueryResult = z.infer<typeof jobFactsResultSchema>;
export type JobFactRow = z.infer<typeof factRowSchema>;

function presentText(value: unknown): string {
  return String(value ?? '').trim();
}

/** Stored value only. Never converts units. Never derives GST. */
export function displayStoredFact(
  field: JobFactFieldName,
  fact: FactLike | null | undefined,
): string {
  if (!fact || fact.value == null || fact.value === '') return '';
  const kind = JOB_FACT_FIELD_KIND[field];
  if (kind === 'area') return formatAreaSqm(Number(fact.value)) || '';
  if (kind === 'cents') return formatFactMoney(Number(fact.value)) || '';
  if (kind === 'percent') {
    if (!Number.isFinite(Number(fact.value))) return '';
    return `${fact.value}%`;
  }
  if (kind === 'date') {
    const ymd = presentText(fact.value);
    return YMD.test(ymd) ? ymd : '';
  }
  if (kind === 'int') {
    if (!Number.isFinite(Number(fact.value))) return '';
    return String(fact.value);
  }
  return presentText(fact.value);
}

function rowFromFact(field: JobFactFieldName, facts: JobFacts | null | undefined): JobFactRow | null {
  const stored = facts?.[field] as FactLike | undefined;
  const display = displayStoredFact(field, stored);
  if (!stored || !display) return null;
  const kind = JOB_FACT_FIELD_KIND[field];
  const cents = kind === 'cents' && typeof stored.value === 'number' && Number.isInteger(stored.value) && stored.value > 0
    ? stored.value
    : undefined;
  return {
    field,
    display,
    source: stored.source,
    confirmed: isFactConfirmed(stored),
    ...(cents != null ? { cents } : {}),
  };
}

export function jobFacts(input: unknown): JobFactsQueryResult {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return invalidInput(firstZodIssue(parsed.error));
  const access = resolveTargetJobIds(parsed.data.scope, parsed.data.jobId);
  if (!access.ok) return access;

  const requested = parsed.data.field;
  const names = requested ? [requested] : LEAD_FIELDS;
  const fields = names
    .map((field) => rowFromFact(field, parsed.data.facts))
    .filter((row): row is JobFactRow => Boolean(row));

  return jobFactsResultSchema.parse({
    ok: true,
    fields,
    provenance: {
      query: 'jobFacts',
      params: compactParams({
        jobId: parsed.data.jobId,
        field: requested,
      }),
      source: 'facts',
      rowCount: fields.length,
      capped: false,
    },
  });
}
