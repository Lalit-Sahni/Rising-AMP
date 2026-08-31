/** Fixed job-file drawers. There are no folders — see PHASE9.md. */

export const JOB_FILE_TYPES = [
  'contract',
  'variation',
  'plan',
  'permit',
  'certificate',
  'quote',
  'photo',
  'invoiceReceived',
  'other',
] as const;

export type JobFileType = (typeof JOB_FILE_TYPES)[number];

export const JOB_FILE_MAX_BYTES = 25 * 1024 * 1024;

/** Display-only. Receipt images stay on the expense; Files will surface them in Part D. */
export const RECEIPT_FILE_TYPE = 'receipt';

export const JOB_FILE_TYPE_META: Record<JobFileType, { label: string; color: string }> = {
  contract: { label: 'Contract', color: '#5E82A6' },
  variation: { label: 'Variation', color: '#C08A3E' },
  plan: { label: 'Plan', color: '#B5654A' },
  permit: { label: 'Permit', color: '#4E8C82' },
  certificate: { label: 'Certificate', color: '#7E9B63' },
  quote: { label: 'Quote', color: '#5E82A6' },
  photo: { label: 'Photo', color: '#8A9099' },
  invoiceReceived: { label: 'Invoice received', color: '#C08A3E' },
  other: { label: 'Other', color: '#8A9099' },
};

export const ALLOWED_JOB_FILE_CONTENT_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/tiff',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/rtf',
  'application/acad',
  'image/vnd.dwg',
  'application/dxf',
  'application/x-dxf',
] as const;

const ALLOWED_CONTENT_TYPE_SET = new Set<string>(ALLOWED_JOB_FILE_CONTENT_TYPES);

export const JOB_FILE_LINK_KINDS = ['expense', 'invoice', 'hiaContract'] as const;
export type JobFileLinkKind = (typeof JOB_FILE_LINK_KINDS)[number];

export type JobFileLinkedTo = {
  kind: JobFileLinkKind;
  id: string;
};

export function isJobFileType(value: unknown): value is JobFileType {
  return typeof value === 'string' && (JOB_FILE_TYPES as readonly string[]).includes(value);
}

export function isAllowedJobFileContentType(value: unknown): boolean {
  if (typeof value !== 'string' || !value) return false;
  const lowered = value.toLowerCase();
  if (lowered.startsWith('video/')) return false;
  return ALLOWED_CONTENT_TYPE_SET.has(lowered);
}

export function safeJobFileName(name: string): string {
  const trimmed = String(name || 'file').replace(/[/\\]+/g, '-').trim();
  return (trimmed || 'file').slice(0, 180);
}

export function jobFileStoragePath(
  orgId: string,
  jobId: string,
  fileId: string,
  fileName: string,
): string {
  return `files/${orgId}/${jobId}/${fileId}/${safeJobFileName(fileName)}`;
}

export function jobFileThumbnailPath(orgId: string, jobId: string, fileId: string): string {
  return `files/${orgId}/${jobId}/${fileId}/thumb.jpg`;
}
