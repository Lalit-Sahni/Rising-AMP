/**
 * File search over the list record plus sibling content/text.
 * A missing content document is not a body match. Original blobs are never loaded.
 */
import { z } from 'zod';
import { JOB_FILE_TYPES } from '../domain/jobFiles';
import {
  compactParams,
  firstZodIssue,
  invalidInput,
  needleOf,
  provenanceSchema,
  queryScopeSchema,
  resolveTargetJobIds,
  textHaystack,
  textMatches,
} from './core';

export type FileRecordSnapshot = {
  id: string;
  jobId: string;
  name: string;
  type: string;
  note?: string;
  status?: string;
};

export type FileTextSnapshot = {
  text?: string;
  textStatus?: string;
};

const SEARCHABLE_TEXT = new Set(['ok', 'truncated']);

const inputSchema = z.object({
  scope: queryScopeSchema,
  jobId: z.string().min(1).optional(),
  type: z.enum(JOB_FILE_TYPES).optional(),
  text: z.string().max(500).optional(),
  files: z.array(z.custom<FileRecordSnapshot>()).optional(),
  content: z.record(z.string(), z.custom<FileTextSnapshot | undefined>()).optional(),
});

const fileRowSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  name: z.string(),
  type: z.string(),
  note: z.string().optional(),
  matchedOn: z.enum(['name', 'note', 'text', 'type']),
  snippet: z.string().optional(),
});

export const findFilesResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    files: z.array(fileRowSchema),
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

export type FindFilesResult = z.infer<typeof findFilesResultSchema>;

export function contentKey(jobId: string, fileId: string): string {
  return `${jobId}/${fileId}`;
}

function snippetAround(text: string, needle: string): string {
  const lower = text.toLowerCase();
  const at = lower.indexOf(needle);
  if (at < 0) return text.slice(0, 160);
  const start = Math.max(0, at - 40);
  const end = Math.min(text.length, at + needle.length + 80);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

export function findFiles(input: unknown): FindFilesResult {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return invalidInput(firstZodIssue(parsed.error));
  const access = resolveTargetJobIds(parsed.data.scope, parsed.data.jobId);
  if (!access.ok) return access;

  const allowed = new Set(access.jobIds);
  const needle = needleOf(parsed.data.text);
  const content = parsed.data.content || {};
  const files: Array<z.infer<typeof fileRowSchema>> = [];

  (parsed.data.files || []).forEach((file) => {
    if (!file?.id || !allowed.has(file.jobId)) return;
    if (file.status && file.status !== 'active') return;
    if (parsed.data.type && file.type !== parsed.data.type) return;

    if (!needle) {
      files.push({
        id: file.id,
        jobId: file.jobId,
        name: file.name,
        type: file.type,
        note: file.note,
        matchedOn: parsed.data.type ? 'type' : 'name',
      });
      return;
    }

    if (textMatches(textHaystack(file.name), needle)) {
      files.push({
        id: file.id,
        jobId: file.jobId,
        name: file.name,
        type: file.type,
        note: file.note,
        matchedOn: 'name',
      });
      return;
    }
    if (textMatches(textHaystack(file.note), needle)) {
      files.push({
        id: file.id,
        jobId: file.jobId,
        name: file.name,
        type: file.type,
        note: file.note,
        matchedOn: 'note',
      });
      return;
    }

    const body = content[contentKey(file.jobId, file.id)];
    if (!body || !SEARCHABLE_TEXT.has(String(body.textStatus || ''))) return;
    const text = String(body.text || '');
    if (!text || !textMatches(text.toLowerCase(), needle)) return;
    files.push({
      id: file.id,
      jobId: file.jobId,
      name: file.name,
      type: file.type,
      note: file.note,
      matchedOn: 'text',
      snippet: snippetAround(text, needle),
    });
  });

  return findFilesResultSchema.parse({
    ok: true,
    files,
    provenance: {
      query: 'findFiles',
      params: compactParams({
        jobId: parsed.data.jobId,
        type: parsed.data.type,
        text: parsed.data.text,
      }),
      source: 'files',
      rowCount: files.length,
      capped: false,
    },
  });
}
