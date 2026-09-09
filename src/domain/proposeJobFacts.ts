/**
 * Collect job-fact proposals from records the app already has.
 * Nothing here writes. A human accepts in the review sheet; saveJobFacts
 * is the only write. The model never calculates. Squares are not converted
 * to sqm. The estimate's Date is not a job fact.
 */
import { formatCents, safeParseToCents } from '../money';
import {
  decideFactWrite,
  jobFactsPatchSchema,
  type FactLike,
  type FactSource,
  type FactWriteDecision,
  type JobFactFieldName,
  type JobFacts,
  type JobFactsPatch,
} from './jobFacts';

export type JobFactProposal = {
  field: JobFactFieldName;
  value: string | number;
  unit?: 'sqm';
  source: FactSource;
  sourceRef: string | null;
  reason: string;
};

export type ReviewedJobFactProposal = JobFactProposal & {
  decision: FactWriteDecision;
};

export type BoqCoverInput = {
  rows: string[][];
  headerRowIndex: number;
  sourceFileId?: string | null;
};

export type DocumentTextInput = {
  id: string;
  type?: string;
  text?: string;
  textStatus?: string;
  status?: string;
};

const READABLE_TEXT = new Set(['ok', 'truncated']);
const DOCUMENT_FACT_TYPES = new Set(['permit', 'certificate', 'contract']);

/** import (BOQ) > document (HIA / client / file) > job name */
const STRENGTH_IMPORT = 30;
const STRENGTH_HIA = 20;
const STRENGTH_CLIENT = 18;
const STRENGTH_FILE = 16;
const STRENGTH_JOB_NAME = 10;

const BUILT_AREA_SQM_LABEL = /built\s*area\s*\(\s*sq\.?\s*m(?:2|²)?\s*\)/i;
const IMPERIAL_OR_SQUARES = /\b(?:squares?|sq\.?\s*ft|sqft|square\s*feet)\b/i;
const INJECTION = /ignore previous|ignore all previous|also set floor area/i;

const SINGLE_STOREY = /\bsin(?:gle|lge)[\s-]+storeys?\b/i;
const DOUBLE_STOREY = /\bdouble[\s-]+storeys?\b/i;
const TWO_STOREY = /\btwo[\s-]+storeys?\b/i;

const STREET_TYPE = /\b(?:street|st|road|rd|drive|dr|avenue|ave|lane|ln|court|ct|place|pl|crescent|cres|parade|pde|close|cl|way|terrace|tce|circuit|cct|grove|gr|highway|hwy|boulevard|blvd|esplanade|esp)\b/i;
const STARTS_WITH_NUMBER = /^\s*\d+[a-z]?\s+\S/i;

const AREA_FIELDS = new Set<JobFactFieldName>(['floorArea', 'siteArea']);
const CENTS_FIELDS = new Set<JobFactFieldName>(['contractValueCents', 'depositCents']);
const INT_FIELDS = new Set<JobFactFieldName>(['storeys', 'bedrooms', 'bathrooms', 'garageSpaces']);
const PERCENT_FIELDS = new Set<JobFactFieldName>(['retentionPercent']);

const DATE_FIELDS = new Set<JobFactFieldName>([
  'contractSigned',
  'siteStart',
  'practicalCompletionTarget',
  'practicalCompletionActual',
]);

type Ranked = JobFactProposal & { strength: number };

function cell(value: unknown): string {
  return String(value ?? '').trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function isLive(value: unknown): boolean {
  const row = asRecord(value);
  if (!row) return false;
  return String(row.status || '').toLowerCase() !== 'void';
}

function isArchivedFile(value: unknown): boolean {
  const row = asRecord(value);
  return String(row?.status || '').toLowerCase() === 'archived';
}

function clipRef(value: string | null | undefined): string | null {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 80);
}

function clipString(value: string): string | null {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 200);
}

function coverRows(rows: string[][], headerRowIndex: number): string[][] {
  const end = Math.max(0, Math.min(headerRowIndex, rows.length));
  return rows.slice(0, end);
}

function parseSqmNumber(raw: string): number | null {
  const text = cell(raw);
  if (!text || INJECTION.test(text)) return null;
  if (IMPERIAL_OR_SQUARES.test(text) && !/\bsqm\b/i.test(text)) return null;
  const cleaned = text
    .replace(/,/g, '')
    .replace(/\s*(?:sqm|sq\.?\s*m|m2|m²)\s*$/i, '')
    .trim();
  if (!/^\d+(?:\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function buildTypeFromTitle(text: string): string | null {
  if (!text || INJECTION.test(text)) return null;
  const hits: string[] = [];
  if (SINGLE_STOREY.test(text)) hits.push('single storey');
  if (DOUBLE_STOREY.test(text)) hits.push('double storey');
  if (TWO_STOREY.test(text)) hits.push('two storey');
  const unique = [...new Set(hits)];
  return unique.length === 1 ? unique[0] : null;
}

export function jobNameLooksLikeAddress(name: string | null | undefined): boolean {
  const text = cell(name);
  if (!text) return false;
  if (STARTS_WITH_NUMBER.test(text)) return true;
  return STREET_TYPE.test(text) && text.split(/\s+/).length >= 2;
}

function normAddress(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function uniqueAddress(
  entries: Array<{ value: string; sourceRef: string | null }>,
): { value: string; sourceRef: string | null } | null {
  const live = entries
    .map((entry) => ({ value: clipString(entry.value), sourceRef: entry.sourceRef }))
    .filter((entry): entry is { value: string; sourceRef: string | null } => Boolean(entry.value));
  if (live.length === 0) return null;
  const keys = new Set(live.map((entry) => normAddress(entry.value)));
  if (keys.size !== 1) return null;
  return live[0];
}

function uniqueString(values: string[]): string | null {
  const live = values.map((value) => clipString(value)).filter((value): value is string => Boolean(value));
  if (live.length === 0) return null;
  const keys = new Set(live.map((value) => value.toLowerCase()));
  if (keys.size !== 1) return null;
  return live[0];
}

function uniqueNumber(values: number[]): number | null {
  const live = values.filter((value) => Number.isFinite(value) && value > 0);
  if (live.length === 0) return null;
  if (new Set(live).size !== 1) return null;
  return live[0];
}

function proposalValueKey(proposal: JobFactProposal): string {
  return proposal.unit ? `${proposal.value}|${proposal.unit}` : String(proposal.value);
}

function mergeRanked(list: Ranked[]): JobFactProposal[] {
  const byField = new Map<JobFactFieldName, Ranked[]>();
  list.forEach((item) => {
    const group = byField.get(item.field) || [];
    group.push(item);
    byField.set(item.field, group);
  });
  const out: JobFactProposal[] = [];
  byField.forEach((group) => {
    const max = Math.max(...group.map((item) => item.strength));
    const top = group.filter((item) => item.strength === max);
    const keys = new Set(top.map(proposalValueKey));
    if (keys.size !== 1) return;
    const winner = top[0];
    const { strength: _strength, ...proposal } = winner;
    out.push(proposal);
  });
  return out;
}

function incomingFromProposal(proposal: JobFactProposal): FactLike {
  if (proposal.unit) {
    return {
      value: proposal.value,
      unit: proposal.unit,
      source: proposal.source,
      sourceRef: proposal.sourceRef,
    };
  }
  return {
    value: proposal.value,
    source: proposal.source,
    sourceRef: proposal.sourceRef,
  };
}

export function proposeFromBoqCover(input: BoqCoverInput): JobFactProposal[] {
  const rows = Array.isArray(input.rows) ? input.rows : [];
  const cover = coverRows(rows, Number(input.headerRowIndex) || 0);
  const sourceRef = clipRef(input.sourceFileId);
  const out: JobFactProposal[] = [];

  let floorArea: number | null = null;
  cover.forEach((row) => {
    (row || []).forEach((raw, index) => {
      const label = cell(raw);
      if (!label || !BUILT_AREA_SQM_LABEL.test(label) || INJECTION.test(label)) return;
      const sameCell = parseSqmNumber(label.replace(BUILT_AREA_SQM_LABEL, ' ').trim());
      const next = parseSqmNumber(cell(row[index + 1]));
      const value = next ?? sameCell;
      if (value != null) floorArea = value;
    });
  });

  if (floorArea != null) {
    out.push({
      field: 'floorArea',
      value: floorArea,
      unit: 'sqm',
      source: 'import',
      sourceRef,
      reason: `From your cost sheet: floor area ${floorArea} sqm.`,
    });
  }

  let buildType: string | null = null;
  cover.forEach((row) => {
    (row || []).forEach((raw) => {
      if (buildType) return;
      const text = cell(raw);
      if (!text) return;
      buildType = buildTypeFromTitle(text);
    });
  });

  if (buildType) {
    out.push({
      field: 'buildType',
      value: buildType,
      source: 'import',
      sourceRef,
      reason: `From your cost sheet: ${buildType}.`,
    });
  }

  return out;
}

function hiaAddress(row: Record<string, unknown>): string {
  const details = asRecord(row.clientDetails);
  const fromDetails = cell(details?.clientAddress);
  if (fromDetails) return fromDetails;
  return cell(row.clientAddress);
}

export function proposeFromHiaContracts(contracts: unknown[] = []): JobFactProposal[] {
  const live = (contracts || []).map(asRecord).filter((row): row is Record<string, unknown> => (
    row != null && isLive(row)
  ));
  if (live.length === 0) return [];

  const out: JobFactProposal[] = [];
  const centsValues: number[] = [];
  const addresses: Array<{ value: string; sourceRef: string | null }> = [];

  live.forEach((row) => {
    const cents = safeParseToCents(row.totalAmount);
    if (cents > 0) centsValues.push(cents);
    const address = hiaAddress(row);
    if (address) {
      addresses.push({ value: address, sourceRef: clipRef(String(row.id || '')) });
    }
  });

  const valueCents = uniqueNumber(centsValues);
  const valueRow = live.find((row) => valueCents != null && safeParseToCents(row.totalAmount) === valueCents);
  if (valueCents != null) {
    out.push({
      field: 'contractValueCents',
      value: valueCents,
      source: 'document',
      sourceRef: clipRef(String(valueRow?.id || '')),
      reason: `From the HIA contract: ${formatCents(valueCents)}.`,
    });
  }

  out.push({
    field: 'contractType',
    value: 'HIA',
    source: 'document',
    sourceRef: clipRef(String(live[0].id || '')),
    reason: 'From the HIA contract: HIA.',
  });

  const address = uniqueAddress(addresses);
  if (address) {
    out.push({
      field: 'address',
      value: address.value,
      source: 'document',
      sourceRef: address.sourceRef,
      reason: 'From the HIA contract.',
    });
  }

  return out;
}

function clientAddress(row: Record<string, unknown>): string {
  return cell(row.address) || cell(row.clientAddress);
}

export function proposeFromClientsAndInvoices(input: {
  clients?: unknown[];
  invoices?: unknown[];
} = {}): JobFactProposal[] {
  const entries: Array<{ value: string; sourceRef: string | null; kind: 'client' | 'invoice' }> = [];

  (input.clients || []).forEach((item) => {
    const row = asRecord(item);
    if (!row || !isLive(row)) return;
    const address = clientAddress(row);
    if (!address) return;
    entries.push({ value: address, sourceRef: clipRef(String(row.id || '')), kind: 'client' });
  });

  (input.invoices || []).forEach((item) => {
    const row = asRecord(item);
    if (!row || !isLive(row)) return;
    const address = cell(row.clientAddress);
    if (!address) return;
    entries.push({ value: address, sourceRef: clipRef(String(row.id || '')), kind: 'invoice' });
  });

  const unique = uniqueAddress(entries);
  if (!unique) return [];
  const winner = entries.find((entry) => clipString(entry.value) === unique.value) || entries[0];
  const fromInvoice = winner.kind === 'invoice';
  return [{
    field: 'address',
    value: unique.value,
    source: 'document',
    sourceRef: unique.sourceRef,
    reason: fromInvoice ? 'From an invoice.' : 'From the client record.',
  }];
}

function labelledCdcOrDa(text: string): string | null {
  const labelled = text.match(
    /(?:cdc|da|complying development|development application|permit)\s*(?:or\s*da)?\s*(?:no\.?|number|#)?\s*[:]\s*((?:CDC|DA)[\s/-]*\d[\d\s/-]*)/i,
  );
  if (labelled) return clipString(labelled[1].replace(/\s+/g, ''));
  const lines = text.split(/\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || INJECTION.test(trimmed) || /also set /i.test(trimmed)) continue;
    if (/^certifier\b/i.test(trimmed)) continue;
    const stand = trimmed.match(/^(?:CDC|DA)\s*[-/]\s*\d{2,4}\s*[-/]\s*\d{1,6}$/i)
      || trimmed.match(/^(?:CDC|DA)\s*[-/]\s*\d{4,10}$/i);
    if (stand) return clipString(trimmed.replace(/\s+/g, ''));
  }
  return null;
}

function labelledLicence(text: string): string | null {
  const match = text.match(
    /(?:builder'?s?\s+)?licen[cs]e\s*(?:no\.?|number|#)?\s*[:]\s*(\d{5,7}[A-Z]?)\b/i,
  );
  return match ? clipString(match[1]) : null;
}

function labelledCertifier(text: string): string | null {
  const match = text.match(
    /(?:accredited\s+)?certifier\s*(?:name)?\s*[:]\s*([^\n]{2,80})/i,
  );
  if (!match) return null;
  const name = clipString(match[1].replace(/\s+/g, ' '));
  if (!name || !/^[A-Z]/.test(name) || /^cdc\b/i.test(name)) return null;
  return name;
}

export function proposeFromDocuments(files: DocumentTextInput[] = []): JobFactProposal[] {
  const cdc: Array<{ value: string; sourceRef: string | null }> = [];
  const licences: Array<{ value: string; sourceRef: string | null }> = [];
  const certifiers: Array<{ value: string; sourceRef: string | null }> = [];

  (files || []).forEach((file) => {
    if (!file || !file.id) return;
    if (String(file.type || '') === 'plan') return;
    if (isArchivedFile(file)) return;
    if (!DOCUMENT_FACT_TYPES.has(String(file.type || ''))) return;
    const status = String(file.textStatus || '');
    if (!READABLE_TEXT.has(status)) return;
    const text = String(file.text || '');
    if (!text.trim()) return;
    const sourceRef = clipRef(file.id);
    const cdcValue = labelledCdcOrDa(text);
    if (cdcValue) cdc.push({ value: cdcValue, sourceRef });
    const licence = labelledLicence(text);
    if (licence) licences.push({ value: licence, sourceRef });
    const certifier = labelledCertifier(text);
    if (certifier) certifiers.push({ value: certifier, sourceRef });
  });

  const out: JobFactProposal[] = [];
  const cdcUnique = uniqueString(cdc.map((row) => row.value));
  if (cdcUnique) {
    const row = cdc.find((item) => item.value.toLowerCase() === cdcUnique.toLowerCase());
    out.push({
      field: 'cdcOrDaNumber',
      value: cdcUnique,
      source: 'document',
      sourceRef: row?.sourceRef || null,
      reason: `From a permit or certificate: ${cdcUnique}.`,
    });
  }
  const licenceUnique = uniqueString(licences.map((row) => row.value));
  if (licenceUnique) {
    const row = licences.find((item) => item.value.toLowerCase() === licenceUnique.toLowerCase());
    out.push({
      field: 'builderLicence',
      value: licenceUnique,
      source: 'document',
      sourceRef: row?.sourceRef || null,
      reason: `From a permit or certificate: builder licence ${licenceUnique}.`,
    });
  }
  const certifierUnique = uniqueString(certifiers.map((row) => row.value));
  if (certifierUnique) {
    const row = certifiers.find((item) => item.value.toLowerCase() === certifierUnique.toLowerCase());
    out.push({
      field: 'certifier',
      value: certifierUnique,
      source: 'document',
      sourceRef: row?.sourceRef || null,
      reason: `From a permit or certificate: certifier ${certifierUnique}.`,
    });
  }
  return out;
}

export function proposeFromJobName(jobName: string | null | undefined): JobFactProposal[] {
  const name = clipString(cell(jobName) || '');
  if (!name || !jobNameLooksLikeAddress(name)) return [];
  return [{
    field: 'address',
    value: name,
    source: 'document',
    sourceRef: null,
    reason: 'From the job name.',
  }];
}

function withStrength(list: JobFactProposal[], strength: number): Ranked[] {
  return list.map((item) => ({ ...item, strength }));
}

export function collectJobFactProposals(input: {
  boq?: BoqCoverInput | null;
  hiaContracts?: unknown[];
  clients?: unknown[];
  invoices?: unknown[];
  documents?: DocumentTextInput[];
  jobName?: string | null;
  current?: JobFacts | null;
} = {}): ReviewedJobFactProposal[] {
  const ranked: Ranked[] = [
    ...withStrength(input.boq ? proposeFromBoqCover(input.boq) : [], STRENGTH_IMPORT),
    ...withStrength(proposeFromHiaContracts(input.hiaContracts), STRENGTH_HIA),
    ...withStrength(proposeFromClientsAndInvoices({
      clients: input.clients,
      invoices: input.invoices,
    }), STRENGTH_CLIENT),
    ...withStrength(proposeFromDocuments(input.documents), STRENGTH_FILE),
    ...withStrength(proposeFromJobName(input.jobName), STRENGTH_JOB_NAME),
  ];

  return mergeRanked(ranked).flatMap((proposal) => {
    const incoming = incomingFromProposal(proposal);
    const currentField = input.current?.[proposal.field] as FactLike | undefined;
    const decision = decideFactWrite(currentField, incoming);
    if (decision === 'keep') return [];
    return [{ ...proposal, decision }];
  });
}

export function applyProposalEdit(
  proposal: JobFactProposal,
  draftValue: string,
): JobFactProposal | null {
  const text = String(draftValue ?? '').trim();
  if (!text) return null;
  if (AREA_FIELDS.has(proposal.field)) {
    const value = parseSqmNumber(text);
    if (value == null) return null;
    return {
      ...proposal,
      value,
      unit: 'sqm',
      source: 'owner',
      sourceRef: null,
    };
  }
  if (CENTS_FIELDS.has(proposal.field)) {
    const value = safeParseToCents(text);
    if (value <= 0) return null;
    return {
      ...proposal,
      value,
      source: 'owner',
      sourceRef: null,
    };
  }
  if (INT_FIELDS.has(proposal.field)) {
    if (!/^\d+$/.test(text)) return null;
    const value = Number(text);
    if (!Number.isInteger(value) || value < 0) return null;
    return {
      ...proposal,
      value,
      source: 'owner',
      sourceRef: null,
    };
  }
  if (PERCENT_FIELDS.has(proposal.field)) {
    const value = Number(text);
    if (!Number.isFinite(value) || value < 0 || value > 100) return null;
    return {
      ...proposal,
      value,
      source: 'owner',
      sourceRef: null,
    };
  }
  if (DATE_FIELDS.has(proposal.field)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
    return {
      ...proposal,
      value: text,
      source: 'owner',
      sourceRef: null,
    };
  }
  const value = clipString(text);
  if (!value) return null;
  return {
    ...proposal,
    value,
    source: 'owner',
    sourceRef: null,
  };
}

export function reviewEditedProposal(
  proposal: JobFactProposal,
  current: JobFacts | null | undefined,
  draftValue: string | null,
): { decision: FactWriteDecision; incoming: JobFactProposal } | null {
  const incoming = draftValue == null
    ? proposal
    : applyProposalEdit(proposal, draftValue);
  if (!incoming) return null;
  const decision = decideFactWrite(
    current?.[incoming.field] as FactLike | undefined,
    incomingFromProposal(incoming),
  );
  return { decision, incoming };
}

export function jobFactsPatchFromProposals(
  proposals: JobFactProposal[],
  confirmation: { confirmedBy: string; confirmedAt: Date; updatedAt: Date },
): JobFactsPatch {
  const patch: Record<string, unknown> = {};
  proposals.forEach((proposal) => {
    const base = {
      source: proposal.source,
      sourceRef: proposal.source === 'owner' ? null : proposal.sourceRef,
      confirmedBy: confirmation.confirmedBy,
      confirmedAt: confirmation.confirmedAt,
      updatedAt: confirmation.updatedAt,
    };
    if (AREA_FIELDS.has(proposal.field)) {
      patch[proposal.field] = {
        value: Number(proposal.value),
        unit: 'sqm' as const,
        ...base,
      };
      return;
    }
    if (
      CENTS_FIELDS.has(proposal.field)
      || INT_FIELDS.has(proposal.field)
      || PERCENT_FIELDS.has(proposal.field)
    ) {
      patch[proposal.field] = { value: Number(proposal.value), ...base };
      return;
    }
    patch[proposal.field] = { value: String(proposal.value), ...base };
  });
  return jobFactsPatchSchema.parse(patch);
}

export function writableProposals(
  rows: Array<ReviewedJobFactProposal & { edited?: boolean; draftValue?: string }>,
  current?: JobFacts | null,
): JobFactProposal[] {
  return rows.flatMap((row) => {
    if (row.edited && row.draftValue != null) {
      const reviewed = reviewEditedProposal(row, current, row.draftValue);
      if (!reviewed || reviewed.decision !== 'write') return [];
      return [reviewed.incoming];
    }
    if (row.decision !== 'write') return [];
    return [row];
  });
}

export const FACT_PROPOSAL_LABELS: Partial<Record<JobFactFieldName, string>> = {
  address: 'address',
  floorArea: 'floor area',
  buildType: 'build type',
  contractValueCents: 'contract value',
  contractType: 'contract type',
  builderLicence: 'builder licence',
  cdcOrDaNumber: 'CDC or DA number',
  certifier: 'certifier',
};
