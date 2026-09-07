/**
 * Quote stored file extracts. The quote is a slice of content/text,
 * never a paraphrase, never OCR, never a model. Original PDFs stay put.
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
} from './core';
import { contentKey, type FileRecordSnapshot, type FileTextSnapshot } from './files';

const QUOTE_CHAR_CAP = 480;
const RESULT_CAP = 4;
const SEARCHABLE = new Set(['ok', 'truncated']);
const UNREADABLE = new Set(['none', 'error', 'unsupported']);

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'from',
  'about', 'does', 'did', 'do', 'what', 'whats', 'when', 'where', 'which', 'who',
  'how', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'it', 'its', 'this',
  'that', 'these', 'those', 'say', 'says', 'said', 'tell', 'telling', 'please',
  'can', 'could', 'would', 'should', 'i', 'we', 'you', 'our', 'me', 'my', 'your',
  'file', 'files', 'document', 'documents', 'pdf', 'open', 'show', 'find',
  'here', 'there', 'any', 'some', 'just', 'also', 'into', 'over', 'under',
]);

const TYPE_HINTS: Array<{ type: (typeof JOB_FILE_TYPES)[number]; pattern: RegExp }> = [
  { type: 'plan', pattern: /\bsite plan\b/ },
  { type: 'contract', pattern: /\bcontracts?\b/ },
  { type: 'variation', pattern: /\bvariations?\b/ },
  { type: 'permit', pattern: /\bpermits?\b/ },
  { type: 'certificate', pattern: /\bcertificates?\b/ },
  { type: 'quote', pattern: /\bquotes?\b/ },
  { type: 'estimate', pattern: /\bestimates?\b/ },
  { type: 'plan', pattern: /\bplans?\b/ },
];

const inputSchema = z.object({
  scope: queryScopeSchema,
  jobId: z.string().min(1).optional(),
  question: z.string().max(500).optional(),
  text: z.string().max(500).optional(),
  type: z.enum(JOB_FILE_TYPES).optional(),
  files: z.array(z.custom<FileRecordSnapshot>()).optional(),
  content: z.record(z.string(), z.custom<FileTextSnapshot | undefined>()).optional(),
});

const passageSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  name: z.string(),
  type: z.string(),
  note: z.string().optional(),
  textStatus: z.enum(['ok', 'truncated', 'none', 'unsupported', 'error', 'missing']),
  match: z.enum(['quoted', 'weak', 'unreadable']),
  quote: z.string().optional(),
  start: z.number().int().nonnegative().optional(),
  end: z.number().int().nonnegative().optional(),
  page: z.number().int().positive().optional(),
});

export const answerFromDocumentsResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    passages: z.array(passageSchema),
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

export type AnswerFromDocumentsResult = z.infer<typeof answerFromDocumentsResultSchema>;
export type DocumentPassage = z.infer<typeof passageSchema>;

function tokensOf(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function typeFromQuestion(question: string): (typeof JOB_FILE_TYPES)[number] | undefined {
  const lower = question.toLowerCase();
  for (const hint of TYPE_HINTS) {
    if (hint.pattern.test(lower)) return hint.type;
  }
  return undefined;
}

function needlesFrom(question: string, text: string, typeHint?: string): string[] {
  const extra = needleOf(text);
  const fromQuestion = tokensOf(question).filter((token) => token !== typeHint);
  const out: string[] = [];
  const seen = new Set<string>();
  if (extra) {
    tokensOf(extra).forEach((token) => {
      if (seen.has(token)) return;
      seen.add(token);
      out.push(token);
    });
    if (extra.length >= 3 && !seen.has(extra)) {
      out.unshift(extra);
    }
  }
  fromQuestion.forEach((token) => {
    if (seen.has(token)) return;
    seen.add(token);
    out.push(token);
  });
  return out;
}

function excerptAround(text: string, at: number, matchLen: number): { quote: string; start: number; end: number } {
  const max = QUOTE_CHAR_CAP;
  let start = Math.max(0, at - 80);
  let end = Math.min(text.length, Math.max(at + matchLen, start + max));
  if (end - start > max) {
    end = Math.min(text.length, start + max);
    if (at + matchLen > end) {
      end = Math.min(text.length, at + matchLen);
      start = Math.max(0, end - max);
    }
  }
  if (start > 0) {
    const space = text.indexOf(' ', start);
    if (space > start && space < at) start = space + 1;
  }
  if (end < text.length) {
    const space = text.lastIndexOf(' ', end);
    if (space > at + matchLen) end = space;
  }
  while (start < end && /\s/.test(text.charAt(start))) start += 1;
  while (end > start && /\s/.test(text.charAt(end - 1))) end -= 1;
  return { quote: text.slice(start, end), start, end };
}

function bestQuote(text: string, needles: string[]): { quote: string; start: number; end: number; score: number } | null {
  if (!text || needles.length === 0) return null;
  const lower = text.toLowerCase();
  const unique = needles.filter((needle, index) => needles.indexOf(needle) === index);
  const phrase = unique.filter((needle) => !needle.includes(' ')).join(' ');
  const candidates: Array<{ at: number; len: number; score: number }> = [];
  if (phrase.length >= 3) {
    const at = lower.indexOf(phrase);
    if (at >= 0) candidates.push({ at, len: phrase.length, score: 200 + phrase.length });
  }
  unique.forEach((needle) => {
    const at = lower.indexOf(needle);
    if (at < 0) return;
    candidates.push({ at, len: needle.length, score: needle.length });
  });
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score || a.at - b.at);
  const hit = candidates[0];
  const excerpt = excerptAround(text, hit.at, hit.len);
  if (!excerpt.quote || !text.includes(excerpt.quote)) return null;
  if (hit.at < excerpt.start || hit.at + hit.len > excerpt.end) return null;
  return { ...excerpt, score: hit.score };
}

function statusOf(body: FileTextSnapshot | undefined): DocumentPassage['textStatus'] {
  const status = String(body?.textStatus || '');
  if (status === 'ok' || status === 'truncated' || status === 'none' || status === 'unsupported' || status === 'error') {
    return status;
  }
  return 'missing';
}

function fileRelevant(
  file: FileRecordSnapshot,
  typeHint: string | undefined,
  needles: string[],
): boolean {
  if (typeHint && file.type === typeHint) return true;
  const hay = textHaystack(file.name, file.note);
  if (typeHint && hay.includes(typeHint)) return true;
  return needles.some((needle) => hay.includes(needle));
}

function rank(match: DocumentPassage['match'], score: number): number {
  if (match === 'quoted') return 300 + score;
  if (match === 'unreadable') return 100;
  return 10;
}

export function answerFromDocuments(input: unknown): AnswerFromDocumentsResult {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return invalidInput(firstZodIssue(parsed.error));
  const question = String(parsed.data.question || '').trim();
  const text = String(parsed.data.text || '').trim();
  if (!question && !text) {
    return invalidInput('A question or a topic is required.');
  }
  const access = resolveTargetJobIds(parsed.data.scope, parsed.data.jobId);
  if (!access.ok) return access;

  const allowed = new Set(access.jobIds);
  const typeHint = parsed.data.type || typeFromQuestion(`${question} ${text}`.trim());
  const needles = needlesFrom(question, text, typeHint);
  const content = parsed.data.content || {};
  const active = (parsed.data.files || []).filter((file) => (
    Boolean(file?.id)
    && allowed.has(file.jobId)
    && (!file.status || file.status === 'active')
  ));
  const typed = typeHint ? active.filter((file) => file.type === typeHint) : [];
  const pool = typed.length ? typed : active;

  const scored: Array<{ passage: DocumentPassage; score: number }> = [];

  pool.forEach((file) => {
    const body = content[contentKey(file.jobId, file.id)];
    const textStatus = statusOf(body);
    const stored = String(body?.text || '');
    const quoted = SEARCHABLE.has(textStatus) ? bestQuote(stored, needles) : null;
    const relevant = fileRelevant(file, typeHint, needles) || Boolean(quoted);
    if (!relevant) return;

    const page = typeof body?.page === 'number' && Number.isInteger(body.page) && body.page > 0
      ? body.page
      : undefined;
    const base = {
      id: file.id,
      jobId: file.jobId,
      name: file.name,
      type: file.type,
      note: file.note,
      textStatus,
      ...(page ? { page } : {}),
    };

    if (!SEARCHABLE.has(textStatus) || UNREADABLE.has(textStatus) || textStatus === 'missing') {
      scored.push({
        score: rank('unreadable', 0),
        passage: { ...base, match: 'unreadable' },
      });
      return;
    }

    if (quoted) {
      scored.push({
        score: rank('quoted', quoted.score),
        passage: {
          ...base,
          match: 'quoted',
          quote: quoted.quote,
          start: quoted.start,
          end: quoted.end,
        },
      });
      return;
    }

    scored.push({
      score: rank('weak', 0),
      passage: { ...base, match: 'weak' },
    });
  });

  scored.sort((a, b) => b.score - a.score);
  const cappedList = scored.length > RESULT_CAP;
  const passages = scored.slice(0, RESULT_CAP).map((row) => row.passage);
  const truncatedSource = passages.some((row) => row.textStatus === 'truncated');

  return answerFromDocumentsResultSchema.parse({
    ok: true,
    passages,
    provenance: {
      query: 'answerFromDocuments',
      params: compactParams({
        jobId: parsed.data.jobId,
        type: parsed.data.type,
        text: parsed.data.text,
      }),
      source: 'files',
      rowCount: passages.length,
      capped: cappedList || truncatedSource,
    },
  });
}
