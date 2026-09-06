import { z } from 'zod';
import { invoiceStatusSchema } from '../domain/schemas';
import { formatYmdInTimeZone } from '../domain/ledgerRollup';
import { LEDGER_ROLLUP_TIME_ZONE } from '../domain/ledgerRollupMeta';
import { parseCalendarDate, ymdToLocalDate } from '../dates';
import {
  getInvoiceTotalCents,
  isInvoiceOverdue,
  isVoidInvoice,
} from '../utils/jobMetrics';
import {
  compactParams,
  firstZodIssue,
  invalidInput,
  provenanceSchema,
  queryScopeSchema,
  resolveTargetJobIds,
  ymdSchema,
} from './core';

export type InvoiceSnapshot = {
  jobId: string;
  invoices: Array<Record<string, unknown>>;
};

const inputSchema = z.object({
  scope: queryScopeSchema,
  jobId: z.string().min(1).optional(),
  status: z.union([invoiceStatusSchema, z.string().min(1)]),
  olderThanDays: z.number().int().nonnegative().optional(),
  now: z.date().optional(),
  jobs: z.array(z.custom<InvoiceSnapshot>()).optional(),
});

const invoiceRowSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  status: z.string(),
  invoiceNumber: z.string().optional(),
  totalCents: z.number().int().nonnegative(),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  overdue: z.boolean(),
});

export const invoicesByStatusResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    invoices: z.array(invoiceRowSchema),
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

export type InvoicesByStatusResult = z.infer<typeof invoicesByStatusResultSchema>;

function invoiceYmd(invoice: Record<string, unknown>): string | null {
  const dated = parseCalendarDate(invoice.invoiceDate) || parseCalendarDate(invoice.dueDate);
  if (!dated) return null;
  const ymd = `${dated.getFullYear()}-${String(dated.getMonth() + 1).padStart(2, '0')}-${String(dated.getDate()).padStart(2, '0')}`;
  return ymdSchema.safeParse(ymd).success ? ymd : null;
}

function daysBetween(earlier: string, later: string): number {
  const a = ymdToLocalDate(earlier);
  const b = ymdToLocalDate(later);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function matchesStatus(invoice: Record<string, unknown>, status: string, now: Date): boolean {
  const wanted = status.toLowerCase().trim();
  const stored = String(invoice.status || '').toLowerCase();
  if (wanted === 'overdue') return isInvoiceOverdue(invoice, now);
  if (wanted === 'void') return stored === 'void';
  if (isVoidInvoice(invoice)) return false;
  return stored === wanted;
}

export function invoicesByStatus(input: unknown): InvoicesByStatusResult {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return invalidInput(firstZodIssue(parsed.error));
  const access = resolveTargetJobIds(parsed.data.scope, parsed.data.jobId);
  if (!access.ok) return access;

  const now = parsed.data.now || new Date();
  const today = formatYmdInTimeZone(now, LEDGER_ROLLUP_TIME_ZONE);
  const wantedJobs = new Set(access.jobIds);
  const rows: Array<z.infer<typeof invoiceRowSchema>> = [];

  (parsed.data.jobs || []).forEach((job) => {
    if (!wantedJobs.has(job.jobId)) return;
    (job.invoices || []).forEach((invoice) => {
      if (!matchesStatus(invoice, parsed.data.status, now)) return;
      if (parsed.data.olderThanDays != null) {
        const ymd = invoiceYmd(invoice);
        if (!ymd || daysBetween(ymd, today) < parsed.data.olderThanDays) return;
      }
      const invoiceDate = typeof invoice.invoiceDate === 'string' ? invoice.invoiceDate : undefined;
      const dueDate = typeof invoice.dueDate === 'string' ? invoice.dueDate : undefined;
      rows.push({
        id: String(invoice.id || ''),
        jobId: job.jobId,
        status: String(invoice.status || ''),
        invoiceNumber: invoice.invoiceNumber == null ? undefined : String(invoice.invoiceNumber),
        totalCents: getInvoiceTotalCents(invoice),
        invoiceDate,
        dueDate,
        overdue: isInvoiceOverdue(invoice, now),
      });
    });
  });

  return invoicesByStatusResultSchema.parse({
    ok: true,
    invoices: rows.filter((row) => row.id),
    provenance: {
      query: 'invoicesByStatus',
      params: compactParams({
        jobId: parsed.data.jobId,
        status: parsed.data.status,
        olderThanDays: parsed.data.olderThanDays,
      }),
      source: 'ledger',
      rowCount: rows.filter((row) => row.id).length,
      capped: false,
    },
  });
}
