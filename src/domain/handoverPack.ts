/** Handover pack selection. Honest gaps, no invented document types. */

import { isRasterImageContentType, JOB_FILE_TYPE_META, type JobFileType } from './jobFiles';
import type { JobFile } from './schemas';

/**
 * Checked by default when that type is on the job.
 * Photos, quotes, supplier invoices and Other stay off until the user adds them.
 */
export const HANDOVER_DEFAULT_TYPES: JobFileType[] = [
  'contract',
  'variation',
  'plan',
  'permit',
  'certificate',
];

/**
 * A typical handover names these even when the job has none.
 * Variation is not here: many jobs have none, and saying so would be noise.
 */
export const HANDOVER_EXPECTED_TYPES: JobFileType[] = [
  'contract',
  'plan',
  'permit',
  'certificate',
];

export type HandoverEmbedKind = 'pdf' | 'image' | 'unsupported';

export type HandoverSkip = {
  name: string;
  reason: string;
};

export type HandoverCover = {
  jobName: string;
  jobAddress: string;
  generatedAt: Date;
  businessName: string;
  displayName: string;
  abn: string;
  addressLines: string[];
  mobile: string;
  email: string;
};

export function isActiveJobFile(file: JobFile | null | undefined): file is JobFile {
  return Boolean(file && file.status !== 'archived' && file.id);
}

export function handoverCandidates(files: JobFile[] = []): JobFile[] {
  return (files || []).filter(isActiveJobFile);
}

export function defaultHandoverSelectedIds(files: JobFile[] = []): string[] {
  return handoverCandidates(files)
    .filter((file) => HANDOVER_DEFAULT_TYPES.includes(file.type))
    .map((file) => file.id as string);
}

export function sortHandoverFiles(files: JobFile[] = []): JobFile[] {
  const rank = new Map<JobFileType, number>(
    HANDOVER_DEFAULT_TYPES.map((type, index) => [type, index]),
  );
  return [...files].sort((left, right) => {
    const leftRank = rank.has(left.type) ? (rank.get(left.type) as number) : 50;
    const rightRank = rank.has(right.type) ? (rank.get(right.type) as number) : 50;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return String(right.documentDate || '').localeCompare(String(left.documentDate || ''));
  });
}

export function missingHandoverTypes(selected: JobFile[] = []): JobFileType[] {
  const present = new Set(selected.map((file) => file.type));
  return HANDOVER_EXPECTED_TYPES.filter((type) => !present.has(type));
}

export function handoverTypeCounts(selected: JobFile[] = []): Array<{ type: JobFileType; label: string; count: number }> {
  const counts = new Map<JobFileType, number>();
  selected.forEach((file) => {
    counts.set(file.type, (counts.get(file.type) || 0) + 1);
  });
  return HANDOVER_DEFAULT_TYPES
    .concat(['quote', 'estimate', 'photo', 'invoiceReceived', 'other'])
    .filter((type, index, list) => list.indexOf(type) === index)
    .map((type) => ({
      type,
      label: JOB_FILE_TYPE_META[type].label,
      count: counts.get(type) || 0,
    }))
    .filter((row) => row.count > 0);
}

export function handoverEmbedKind(file: Pick<JobFile, 'contentType'>): HandoverEmbedKind {
  const type = String(file.contentType || '').toLowerCase();
  if (type === 'application/pdf') return 'pdf';
  if (isRasterImageContentType(type)) return 'image';
  return 'unsupported';
}

export function unsupportedHandoverReason(file: Pick<JobFile, 'name' | 'contentType'>): string {
  const kind = handoverEmbedKind(file);
  if (kind === 'unsupported') {
    return 'This file is not a PDF or photo, so it cannot go in the pack.';
  }
  return '';
}

export function formatHandoverDate(date: Date): string {
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function handoverPackFileName(jobName: string, generatedAt = new Date()): string {
  const job = String(jobName || 'job').replace(/[/\\?%*:|"<>]/g, '-').trim() || 'job';
  return `Handover pack — ${job} — ${formatHandoverDate(generatedAt)}.pdf`;
}

export function builderAddressLines(profile: {
  street?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
} | null | undefined): string[] {
  if (!profile) return [];
  const street = String(profile.street || '').trim();
  const suburb = String(profile.suburb || '').trim();
  const state = String(profile.state || '').trim();
  const postcode = String(profile.postcode || '').trim();
  const city = [suburb, state, postcode].filter(Boolean).join(' ');
  return [street, city].filter(Boolean);
}

export function jobAddressFromClients(clients: unknown[] = []): string {
  const rows = (clients || []).filter((row) => row && typeof row === 'object') as Array<{
    email?: string;
    name?: string;
    clientName?: string;
    address?: string;
    status?: string;
  }>;
  const live = rows.filter((row) => String(row.status || '').toLowerCase() !== 'void');
  const billed = live.find((row) => String(row.email || '').includes('@'))
    || live.find((row) => row.name || row.clientName);
  return billed && billed.address ? String(billed.address).trim() : '';
}

export function coverFromProfile(input: {
  jobName?: string;
  jobAddress?: string;
  generatedAt?: Date;
  profile?: {
    businessName?: string;
    displayName?: string;
    abn?: string;
    street?: string;
    suburb?: string;
    state?: string;
    postcode?: string;
    mobile?: string;
    email?: string;
  } | null;
}): HandoverCover {
  const profile = input.profile || {};
  return {
    jobName: String(input.jobName || '').trim() || 'This job',
    jobAddress: String(input.jobAddress || '').trim(),
    generatedAt: input.generatedAt || new Date(),
    businessName: String(profile.businessName || '').trim(),
    displayName: String(profile.displayName || '').trim(),
    abn: String(profile.abn || '').trim(),
    addressLines: builderAddressLines(profile),
    mobile: String(profile.mobile || '').trim(),
    email: String(profile.email || '').trim(),
  };
}
