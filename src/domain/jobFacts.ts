/**
 * Job facts record. One versioned document per job: facts/current.
 * Every field is optional. A missing field is honest; never invent a default.
 * Money is integer cents (see src/money.ts). Areas are a number plus unit 'sqm'.
 */
import { z } from 'zod';
import { parseAtBoundary } from './schemas';

export const JOB_FACTS_COLLECTION = 'facts';
export const JOB_FACTS_DOC_ID = 'current';
export const JOB_FACTS_SCHEMA_VERSION = 1;
export const FACT_PREVIOUS_CAP = 20;

export const FACT_SOURCES = ['owner', 'import', 'document', 'assistant'] as const;
export type FactSource = (typeof FACT_SOURCES)[number];
export type FactWriteDecision = 'write' | 'keep' | 'propose';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const JOB_FACT_FIELD_NAMES = [
  'address',
  'suburb',
  'postcode',
  'lotDp',
  'council',
  'zoning',
  'floorArea',
  'siteArea',
  'storeys',
  'bedrooms',
  'bathrooms',
  'garageSpaces',
  'buildType',
  'contractValueCents',
  'contractType',
  'depositCents',
  'retentionPercent',
  'contractSigned',
  'siteStart',
  'practicalCompletionTarget',
  'practicalCompletionActual',
  'builderLicence',
  'hbcfCertificate',
  'cdcOrDaNumber',
  'certifier',
] as const;

export type JobFactFieldName = (typeof JOB_FACT_FIELD_NAMES)[number];

export const factSourceSchema = z.enum(FACT_SOURCES);

const factProvenanceShape = {
  source: factSourceSchema,
  sourceRef: z.string().min(1).max(80).nullable(),
  confirmedBy: z.string().min(1).max(128).nullable(),
  confirmedAt: z.unknown().nullable(),
  updatedAt: z.unknown(),
};

export const stringFactSnapshotSchema = z
  .object({
    value: z.string().trim().min(1).max(200),
    ...factProvenanceShape,
  })
  .strict();

export const stringFactSchema = stringFactSnapshotSchema
  .extend({
    previous: z.array(stringFactSnapshotSchema).max(FACT_PREVIOUS_CAP).optional(),
  })
  .strict();

export const areaFactSnapshotSchema = z
  .object({
    value: z.number().finite().nonnegative(),
    unit: z.literal('sqm'),
    ...factProvenanceShape,
  })
  .strict();

export const areaFactSchema = areaFactSnapshotSchema
  .extend({
    previous: z.array(areaFactSnapshotSchema).max(FACT_PREVIOUS_CAP).optional(),
  })
  .strict();

/** Integer cents, or a non-negative count. Never dollars. */
export const intFactSnapshotSchema = z
  .object({
    value: z.number().int().nonnegative(),
    ...factProvenanceShape,
  })
  .strict();

export const intFactSchema = intFactSnapshotSchema
  .extend({
    previous: z.array(intFactSnapshotSchema).max(FACT_PREVIOUS_CAP).optional(),
  })
  .strict();

export const centsFactSnapshotSchema = intFactSnapshotSchema;
export const centsFactSchema = intFactSchema;

export const percentFactSnapshotSchema = z
  .object({
    value: z.number().finite().min(0).max(100),
    ...factProvenanceShape,
  })
  .strict();

export const percentFactSchema = percentFactSnapshotSchema
  .extend({
    previous: z.array(percentFactSnapshotSchema).max(FACT_PREVIOUS_CAP).optional(),
  })
  .strict();

export const dateFactSnapshotSchema = z
  .object({
    value: z.string().regex(ISO_DATE, 'Date must be YYYY-MM-DD'),
    ...factProvenanceShape,
  })
  .strict();

export const dateFactSchema = dateFactSnapshotSchema
  .extend({
    previous: z.array(dateFactSnapshotSchema).max(FACT_PREVIOUS_CAP).optional(),
  })
  .strict();

const jobFactsFieldsShape = {
  address: stringFactSchema.optional(),
  suburb: stringFactSchema.optional(),
  postcode: stringFactSchema.optional(),
  lotDp: stringFactSchema.optional(),
  council: stringFactSchema.optional(),
  zoning: stringFactSchema.optional(),
  floorArea: areaFactSchema.optional(),
  siteArea: areaFactSchema.optional(),
  storeys: intFactSchema.optional(),
  bedrooms: intFactSchema.optional(),
  bathrooms: intFactSchema.optional(),
  garageSpaces: intFactSchema.optional(),
  buildType: stringFactSchema.optional(),
  contractValueCents: centsFactSchema.optional(),
  contractType: stringFactSchema.optional(),
  depositCents: centsFactSchema.optional(),
  retentionPercent: percentFactSchema.optional(),
  contractSigned: dateFactSchema.optional(),
  siteStart: dateFactSchema.optional(),
  practicalCompletionTarget: dateFactSchema.optional(),
  practicalCompletionActual: dateFactSchema.optional(),
  builderLicence: stringFactSchema.optional(),
  hbcfCertificate: stringFactSchema.optional(),
  cdcOrDaNumber: stringFactSchema.optional(),
  certifier: stringFactSchema.optional(),
};

export const jobFactsSchema = z
  .object({
    id: z.string().optional(),
    jobId: z.string().min(1),
    schemaVersion: z.literal(JOB_FACTS_SCHEMA_VERSION),
    createdBy: z.string().min(1).max(128).optional(),
    createdAt: z.unknown().optional(),
    updatedAt: z.unknown(),
    ...jobFactsFieldsShape,
  })
  .strict();

export const jobFactsPatchSchema = z
  .object({
    address: stringFactSnapshotSchema.optional(),
    suburb: stringFactSnapshotSchema.optional(),
    postcode: stringFactSnapshotSchema.optional(),
    lotDp: stringFactSnapshotSchema.optional(),
    council: stringFactSnapshotSchema.optional(),
    zoning: stringFactSnapshotSchema.optional(),
    floorArea: areaFactSnapshotSchema.optional(),
    siteArea: areaFactSnapshotSchema.optional(),
    storeys: intFactSnapshotSchema.optional(),
    bedrooms: intFactSnapshotSchema.optional(),
    bathrooms: intFactSnapshotSchema.optional(),
    garageSpaces: intFactSnapshotSchema.optional(),
    buildType: stringFactSnapshotSchema.optional(),
    contractValueCents: centsFactSnapshotSchema.optional(),
    contractType: stringFactSnapshotSchema.optional(),
    depositCents: centsFactSnapshotSchema.optional(),
    retentionPercent: percentFactSnapshotSchema.optional(),
    contractSigned: dateFactSnapshotSchema.optional(),
    siteStart: dateFactSnapshotSchema.optional(),
    practicalCompletionTarget: dateFactSnapshotSchema.optional(),
    practicalCompletionActual: dateFactSnapshotSchema.optional(),
    builderLicence: stringFactSnapshotSchema.optional(),
    hbcfCertificate: stringFactSnapshotSchema.optional(),
    cdcOrDaNumber: stringFactSnapshotSchema.optional(),
    certifier: stringFactSnapshotSchema.optional(),
  })
  .strict();

export type StringFact = z.infer<typeof stringFactSchema>;
export type AreaFact = z.infer<typeof areaFactSchema>;
export type IntFact = z.infer<typeof intFactSchema>;
export type CentsFact = z.infer<typeof centsFactSchema>;
export type PercentFact = z.infer<typeof percentFactSchema>;
export type DateFact = z.infer<typeof dateFactSchema>;
export type JobFacts = z.infer<typeof jobFactsSchema>;
export type JobFactsPatch = z.infer<typeof jobFactsPatchSchema>;

export type FactLike = {
  value: unknown;
  source: FactSource;
  unit?: unknown;
  sourceRef?: string | null;
  confirmedBy?: string | null;
  confirmedAt?: unknown;
  updatedAt?: unknown;
  previous?: unknown[];
};

export type MergeJobFactsResult = {
  facts: JobFacts;
  proposed: JobFactFieldName[];
  written: JobFactFieldName[];
};

export function parseJobFacts(value: unknown) {
  return parseAtBoundary(jobFactsSchema, value);
}

export function isFactConfirmed(field: FactLike | null | undefined): boolean {
  return field != null && field.confirmedAt != null;
}

export function factValuesEqual(
  current: FactLike | null | undefined,
  incoming: FactLike,
): boolean {
  if (!current) return false;
  if (current.value !== incoming.value) return false;
  if (current.unit !== undefined || incoming.unit !== undefined) {
    return current.unit === incoming.unit;
  }
  return true;
}

/**
 * No field is ever silently overwritten.
 * Confirmed values stay unless a human (`owner`) replaces them.
 * Proposals are not persisted here — that is Part B UI.
 */
export function decideFactWrite(
  currentField: FactLike | null | undefined,
  incoming: FactLike,
): FactWriteDecision {
  if (!currentField) return 'write';
  if (!isFactConfirmed(currentField)) return 'write';
  if (factValuesEqual(currentField, incoming)) return 'keep';
  if (incoming.source === 'owner') return 'write';
  return 'propose';
}

function withoutPrevious<T extends FactLike>(field: T): Omit<T, 'previous'> {
  const { previous: _previous, ...rest } = field;
  return rest;
}

/** Replace the current value and push the old one into soft history (cap 20). */
export function applyFactWrite<T extends FactLike>(
  currentField: T | null | undefined,
  incoming: T,
): Omit<T, 'previous'> & { previous?: Array<Omit<T, 'previous'>> } {
  const next = withoutPrevious(incoming);
  if (!currentField) return next;
  const history = [
    withoutPrevious(currentField),
    ...(Array.isArray(currentField.previous) ? currentField.previous : []),
  ].slice(0, FACT_PREVIOUS_CAP) as Array<Omit<T, 'previous'>>;
  return { ...next, previous: history };
}

export function mergeJobFactsPatch(
  current: JobFacts | null | undefined,
  patch: JobFactsPatch,
  meta: {
    jobId: string;
    updatedAt: unknown;
    createdBy?: string;
    createdAt?: unknown;
  },
): MergeJobFactsResult {
  const parsedPatch = jobFactsPatchSchema.parse(patch);
  const proposed: JobFactFieldName[] = [];
  const written: JobFactFieldName[] = [];
  const next: Record<string, unknown> = current
    ? { ...current, jobId: meta.jobId, schemaVersion: JOB_FACTS_SCHEMA_VERSION }
    : { jobId: meta.jobId, schemaVersion: JOB_FACTS_SCHEMA_VERSION };

  JOB_FACT_FIELD_NAMES.forEach((name) => {
    const incoming = parsedPatch[name];
    if (incoming === undefined) return;
    const existing = current?.[name] as FactLike | undefined;
    const decision = decideFactWrite(existing, incoming);
    if (decision === 'propose') {
      proposed.push(name);
      return;
    }
    if (decision === 'keep') return;
    next[name] = applyFactWrite(existing, incoming);
    written.push(name);
  });

  if (current && written.length === 0) {
    return { facts: current, proposed, written };
  }

  next.updatedAt = meta.updatedAt;
  if (current) {
    if (current.createdBy) next.createdBy = current.createdBy;
    if (current.createdAt !== undefined) next.createdAt = current.createdAt;
  } else {
    if (meta.createdBy) next.createdBy = meta.createdBy;
    if (meta.createdAt !== undefined) next.createdAt = meta.createdAt;
  }

  const parsed = jobFactsSchema.parse(next);
  return { facts: parsed, proposed, written };
}
