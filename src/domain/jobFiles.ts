/** Fixed job-file drawers. There are no folders — see PHASE9.md. */

import { ymdToLocalDate } from '../dates';

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

/** Display-only. Receipt images stay on the expense; Files never copies them. */
export const RECEIPT_FILE_TYPE = 'receipt' as const;
export type FilesDrawerType = JobFileType | typeof RECEIPT_FILE_TYPE;

export const RECEIPT_FILE_TYPE_META = { label: 'Receipt', color: '#8A9099' };

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

export function filesDrawerMeta(type: FilesDrawerType): { label: string; color: string } {
  if (type === RECEIPT_FILE_TYPE) return RECEIPT_FILE_TYPE_META;
  return JOB_FILE_TYPE_META[type];
}

export function firstName(displayName: string): string {
  const trimmed = String(displayName || '').trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0] || '';
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

const VIDEO_EXTENSIONS = new Set([
  'mp4', 'mov', 'm4v', 'webm', 'avi', 'mkv', 'mpeg', 'mpg', '3gp', 'wmv', 'flv',
]);

const EXTENSION_TO_CONTENT_TYPE: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  rtf: 'application/rtf',
  dwg: 'image/vnd.dwg',
  dxf: 'application/dxf',
};

/** Chooser accept list. Camera uses image/* separately so iOS can open the camera. */
export const JOB_FILE_ACCEPT = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/tiff',
  'application/pdf',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
  '.rtf',
  '.dwg',
  '.dxf',
].join(',');

export function fileExtension(name: string): string {
  const base = String(name || '').split(/[/\\]/).pop() || '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  return base.slice(dot + 1).toLowerCase();
}

export function isVideoFile(file: { name?: string; type?: string }): boolean {
  const type = String(file?.type || '').toLowerCase();
  if (type.startsWith('video/')) return true;
  return VIDEO_EXTENSIONS.has(fileExtension(file?.name || ''));
}

export function contentTypeFromFileName(name: string): string | null {
  const ext = fileExtension(name);
  return EXTENSION_TO_CONTENT_TYPE[ext] || null;
}

export function resolveJobFileContentType(file: { name?: string; type?: string }): string | null {
  const declared = String(file?.type || '').toLowerCase();
  if (declared.startsWith('video/')) return null;
  if (declared && declared !== 'application/octet-stream' && isAllowedJobFileContentType(declared)) {
    return declared;
  }
  const fromName = contentTypeFromFileName(file?.name || '');
  if (fromName && isAllowedJobFileContentType(fromName)) return fromName;
  return null;
}

/** Photos we can try to compress. Drawings named as images (DWG) stay as-is. */
export function isRasterImageContentType(contentType: string): boolean {
  const type = String(contentType || '').toLowerCase();
  if (!type.startsWith('image/')) return false;
  if (type.includes('dwg') || type.includes('dxf') || type === 'image/svg+xml') return false;
  return true;
}

export function suggestJobFileType(contentType: string): JobFileType {
  return isRasterImageContentType(contentType) ? 'photo' : 'other';
}

export function validateJobFileForUpload(file: { name?: string; size?: number; type?: string }): {
  ok: true;
  contentType: string;
} | {
  ok: false;
  error: string;
} {
  if (!file || !file.name) {
    return { ok: false, error: 'Choose a file first' };
  }
  if (isVideoFile(file)) {
    return { ok: false, error: 'Video is not allowed. Photos, PDFs and documents only.' };
  }
  const size = Number(file.size) || 0;
  if (size <= 0) {
    return { ok: false, error: 'That file is empty' };
  }
  if (size > JOB_FILE_MAX_BYTES) {
    return { ok: false, error: 'Each file must be 25 MB or smaller' };
  }
  const contentType = resolveJobFileContentType(file);
  if (!contentType) {
    return { ok: false, error: 'That file type is not allowed. Photos, PDFs and common documents only.' };
  }
  return { ok: true, contentType };
}

export function formatJobFileSize(bytes: number): string {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) {
    const kb = n / 1024;
    return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  }
  const mb = n / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

export function formatJobFileDocumentDate(ymd: string): string {
  const date = ymdToLocalDate(ymd);
  if (!date) return ymd || '—';
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function jobFileTypeIconLabel(contentType: string): string {
  const type = String(contentType || '').toLowerCase();
  if (type === 'application/pdf') return 'PDF';
  if (type.includes('dwg')) return 'DWG';
  if (type.includes('dxf')) return 'DXF';
  if (type.includes('spreadsheet') || type.includes('excel') || type.includes('ms-excel')) return 'XLS';
  if (type.includes('presentation') || type.includes('powerpoint')) return 'PPT';
  if (type.includes('word') || type.includes('msword')) return 'DOC';
  if (type.startsWith('image/')) return 'IMG';
  if (type === 'text/plain') return 'TXT';
  if (type.includes('rtf')) return 'RTF';
  return 'FILE';
}

/** HEIC/TIFF often will not toBlob as themselves; ask the canvas for JPEG. */
export function jobFileCompressOutputType(contentType: string): string | null {
  const type = String(contentType || '').toLowerCase();
  if (type === 'image/heic' || type === 'image/heif' || type === 'image/tiff') {
    return 'image/jpeg';
  }
  return null;
}
