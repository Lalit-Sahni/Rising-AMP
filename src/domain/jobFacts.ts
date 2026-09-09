/**
 * Job facts record. One versioned document per job: facts/current.
 * Every field is optional. A missing field is honest; never invent a default.
 * Money is integer cents (see src/money.ts). Areas are a number plus unit 'sqm'.
 */
import { z } from 'zod';
import { formatCents, parseToCents } from '../money';
import { isYmd } from '../dates';
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

export type JobFactFieldKind = 'string' | 'area' | 'cents' | 'int' | 'percent' | 'date';
export type JobFactGroupId = 'site' | 'building' | 'commercial' | 'dates' | 'compliance';

export const JOB_FACT_FIELD_KIND: Record<JobFactFieldName, JobFactFieldKind> = {
  address: 'string',
  suburb: 'string',
  postcode: 'string',
  lotDp: 'string',
  council: 'string',
  zoning: 'string',
  floorArea: 'area',
  siteArea: 'area',
  storeys: 'int',
  bedrooms: 'int',
  bathrooms: 'int',
  garageSpaces: 'int',
  buildType: 'string',
  contractValueCents: 'cents',
  contractType: 'string',
  depositCents: 'cents',
  retentionPercent: 'percent',
  contractSigned: 'date',
  siteStart: 'date',
  practicalCompletionTarget: 'date',
  practicalCompletionActual: 'date',
  builderLicence: 'string',
  hbcfCertificate: 'string',
  cdcOrDaNumber: 'string',
  certifier: 'string',
};

export const JOB_FACT_FIELD_LABELS: Record<JobFactFieldName, string> = {
  address: 'Address',
  suburb: 'Suburb',
  postcode: 'Postcode',
  lotDp: 'Lot and DP',
  council: 'Council',
  zoning: 'Zoning',
  floorArea: 'Floor area',
  siteArea: 'Site area',
  storeys: 'Storeys',
  bedrooms: 'Bedrooms',
  bathrooms: 'Bathrooms',
  garageSpaces: 'Garage spaces',
  buildType: 'Build type',
  contractValueCents: 'Contract value',
  contractType: 'Contract type',
  depositCents: 'Deposit',
  retentionPercent: 'Retention',
  contractSigned: 'Contract signed',
  siteStart: 'Site start',
  practicalCompletionTarget: 'PC target',
  practicalCompletionActual: 'Practical completion',
  builderLicence: 'Builder licence',
  hbcfCertificate: 'HBCF certificate',
  cdcOrDaNumber: 'CDC or DA number',
  certifier: 'Certifier',
};

export const JOB_FACT_GROUPS: Array<{
  id: JobFactGroupId;
  label: string;
  fields: JobFactFieldName[];
}> = [
  {
    id: 'site',
    label: 'Site',
    fields: ['address', 'suburb', 'postcode', 'lotDp', 'council', 'zoning'],
  },
  {
    id: 'building',
    label: 'Building',
    fields: ['floorArea', 'siteArea', 'storeys', 'bedrooms', 'bathrooms', 'garageSpaces', 'buildType'],
  },
  {
    id: 'commercial',
    label: 'Commercial',
    fields: ['contractValueCents', 'contractType', 'depositCents', 'retentionPercent'],
  },
  {
    id: 'dates',
    label: 'Dates',
    fields: ['contractSigned', 'siteStart', 'practicalCompletionTarget', 'practicalCompletionActual'],
  },
  {
    id: 'compliance',
    label: 'Compliance',
    fields: ['builderLicence', 'hbcfCertificate', 'cdcOrDaNumber', 'certifier'],
  },
];

export const FACT_SOURCE_LABELS: Record<FactSource, string> = {
  owner: 'Typed by you',
  import: 'From an import',
  document: 'From a document',
  assistant: 'From the assistant',
};

const FACT_DAY = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const PLACEHOLDER_MONEY = /^\$0(?:\.00)?$/;
const PLACEHOLDER_AREA = /^0(?:\.0+)?\s*sqm$/i;

export type JobFactsLead = {
  address?: string;
  floorArea?: string;
  contractValue?: string;
};

export type OwnerFactWrite =
  | { ok: true; patch: JobFactsPatch }
  | { ok: false; reason: 'empty' | 'invalid' };

function presentText(value: unknown): string {
  return String(value ?? '').trim();
}

function isPlaceholderLine(value: string): boolean {
  const text = presentText(value);
  if (!text || text === '—') return true;
  if (PLACEHOLDER_MONEY.test(text) || PLACEHOLDER_AREA.test(text)) return true;
  return false;
}

/** Count stored fields that a human has not confirmed. Missing fields do not count. */
export function unconfirmedJobFactCount(facts: JobFacts | null | undefined): number {
  if (!facts) return 0;
  return JOB_FACT_FIELD_NAMES.reduce((count, name) => {
    const field = facts[name];
    if (!field) return count;
    return isFactConfirmed(field) ? count : count + 1;
  }, 0);
}

/** `{value} sqm`. Null when the number is missing or a 0-sqm placeholder. */
export function formatAreaSqm(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  const line = `${value} sqm`;
  return isPlaceholderLine(line) ? null : line;
}

export function formatFactMoney(centsValue: number | null | undefined): string | null {
  if (centsValue == null || !Number.isFinite(centsValue) || centsValue <= 0) return null;
  const line = formatCents(centsValue);
  if (!line || isPlaceholderLine(line)) return null;
  return line;
}

export function formatFactDate(value: string | null | undefined): string | null {
  const ymd = presentText(value);
  if (!isYmd(ymd)) return null;
  const [year, month, day] = ymd.split('-').map(Number);
  return FACT_DAY.format(new Date(year, month - 1, day));
}

export function formatFactValue(
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
  if (kind === 'date') return formatFactDate(String(fact.value)) || '';
  if (kind === 'int') {
    if (!Number.isFinite(Number(fact.value))) return '';
    return String(fact.value);
  }
  return presentText(fact.value);
}

/**
 * Overview lead: address, floor area, contract value — only when stored.
 * Does not repeat an address that is already the job name. Never invents — / 0 sqm / $0.
 */
export function jobFactsLead(
  facts: JobFacts | null | undefined,
  projectName?: string | null,
): JobFactsLead {
  if (!facts) return {};
  const lead: JobFactsLead = {};
  const address = presentText(facts.address?.value);
  const name = presentText(projectName);
  if (address && address !== name) lead.address = address;
  const floorArea = formatAreaSqm(facts.floorArea?.value);
  if (floorArea) lead.floorArea = floorArea;
  const contractValue = formatFactMoney(facts.contractValueCents?.value);
  if (contractValue) lead.contractValue = contractValue;
  return lead;
}

export function jobFactsLeadParts(lead: JobFactsLead): string[] {
  return [lead.address, lead.floorArea, lead.contractValue].filter(
    (part): part is string => Boolean(part),
  );
}

export function jobFactsSiteAddress(facts: JobFacts | null | undefined): string | undefined {
  const address = presentText(facts?.address?.value);
  return address || undefined;
}

export function jobExportIdentity(
  jobName?: string | null,
  facts?: JobFacts | null,
): { jobName?: string; subtitle?: string } {
  const name = presentText(jobName);
  const parts = jobFactsLeadParts({
    address: presentText(facts?.address?.value) || undefined,
    floorArea: formatAreaSqm(facts?.floorArea?.value) || undefined,
    contractValue: formatFactMoney(facts?.contractValueCents?.value) || undefined,
  });
  return {
    ...(name ? { jobName: name } : {}),
    ...(parts.length > 0 ? { subtitle: parts.join(' · ') } : {}),
  };
}

export type HandoverFactLines = {
  address?: string;
  floorArea?: string;
  contractValue?: string;
};

/** Present facts only. Prefer facts.address; caller falls back to the client address. */
export function handoverFactLines(facts: JobFacts | null | undefined): HandoverFactLines {
  if (!facts) return {};
  const lines: HandoverFactLines = {};
  const address = presentText(facts.address?.value);
  if (address) lines.address = address;
  const floorArea = formatAreaSqm(facts.floorArea?.value);
  if (floorArea) lines.floorArea = floorArea;
  const contractValue = formatFactMoney(facts.contractValueCents?.value);
  if (contractValue) lines.contractValue = contractValue;
  return lines;
}

function ownerProvenance(uid: string, now: Date) {
  return {
    source: 'owner' as const,
    sourceRef: null,
    confirmedBy: uid,
    confirmedAt: now,
    updatedAt: now,
  };
}

export function parseOwnerFactInput(
  field: JobFactFieldName,
  raw: string,
): { ok: true; value: string | number; unit?: 'sqm' } | { ok: false; reason: 'empty' | 'invalid' } {
  const kind = JOB_FACT_FIELD_KIND[field];
  const text = presentText(raw);
  if (!text) return { ok: false, reason: 'empty' };

  if (kind === 'string') {
    if (text.length > 200) return { ok: false, reason: 'invalid' };
    return { ok: true, value: text };
  }

  if (kind === 'area') {
    const cleaned = text.replace(/,/g, '').replace(/\s*sqm$/i, '').trim();
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return { ok: false, reason: 'invalid' };
    const value = Number(cleaned);
    if (!Number.isFinite(value) || value <= 0) return { ok: false, reason: 'empty' };
    return { ok: true, value, unit: 'sqm' };
  }

  if (kind === 'cents') {
    try {
      const value = parseToCents(text);
      if (value <= 0) return { ok: false, reason: 'empty' };
      return { ok: true, value };
    } catch {
      return { ok: false, reason: 'invalid' };
    }
  }

  if (kind === 'int') {
    if (!/^\d+$/.test(text)) return { ok: false, reason: 'invalid' };
    const value = Number(text);
    if (!Number.isInteger(value) || value < 0) return { ok: false, reason: 'invalid' };
    return { ok: true, value };
  }

  if (kind === 'percent') {
    const value = Number(text.replace(/%/g, ''));
    if (!Number.isFinite(value) || value < 0 || value > 100) return { ok: false, reason: 'invalid' };
    return { ok: true, value };
  }

  if (kind === 'date') {
    if (!isYmd(text)) return { ok: false, reason: 'invalid' };
    return { ok: true, value: text };
  }

  return { ok: false, reason: 'invalid' };
}

/** In-place owner edit. Always `source: 'owner'` so a confirmed value can be replaced. */
export function buildOwnerFactPatch(
  field: JobFactFieldName,
  raw: string,
  uid: string,
  now: Date,
): OwnerFactWrite {
  const parsed = parseOwnerFactInput(field, raw);
  if (!parsed.ok) return parsed;
  const provenance = ownerProvenance(uid, now);
  if (parsed.unit === 'sqm') {
    return {
      ok: true,
      patch: {
        [field]: { value: parsed.value, unit: 'sqm' as const, ...provenance },
      } as JobFactsPatch,
    };
  }
  return {
    ok: true,
    patch: {
      [field]: { value: parsed.value, ...provenance },
    } as JobFactsPatch,
  };
}

/** Confirm an existing value in place. Keeps the original source. */
export function buildConfirmFactPatch(
  field: JobFactFieldName,
  facts: JobFacts,
  uid: string,
  now: Date,
): OwnerFactWrite {
  const current = facts[field];
  if (!current) return { ok: false, reason: 'empty' };
  const { previous: _previous, ...snapshot } = current;
  return {
    ok: true,
    patch: {
      [field]: {
        ...snapshot,
        confirmedBy: uid,
        confirmedAt: now,
        updatedAt: now,
      },
    } as JobFactsPatch,
  };
}

export function draftFromFact(field: JobFactFieldName, fact: FactLike | null | undefined): string {
  if (!fact || fact.value == null || fact.value === '') return '';
  const kind = JOB_FACT_FIELD_KIND[field];
  if (kind === 'cents') return (Number(fact.value) / 100).toFixed(2);
  return String(fact.value);
}
