import { z } from 'zod';
import {
  ALLOWED_JOB_FILE_CONTENT_TYPES,
  JOB_FILE_LINK_KINDS,
  JOB_FILE_MAX_BYTES,
  JOB_FILE_TYPES,
  isAllowedJobFileContentType,
} from './jobFiles';

const looseString = z.union([z.string(), z.number()]).optional();
const moneyInput = z.union([z.string(), z.number(), z.null()]).optional();
const dateInput = z.any().optional();

export const invoiceStatusSchema = z.enum([
  'draft',
  'sent',
  'paid',
  'overdue',
  'void',
  'pending',
  'unpaid',
]);

export const expenseSchema = z
  .object({
    id: z.string().optional(),
    category: z.string().optional(),
    total: moneyInput,
    amount: moneyInput,
    cost: moneyInput,
    totalPrice: moneyInput,
    hours: looseString,
    rate: moneyInput,
    quantity: looseString,
    unitCost: moneyInput,
    date: dateInput,
    timestamp: z.unknown().optional(),
    receiptImageUrl: z.string().optional(),
    receiptImagePath: z.string().optional(),
    status: z.string().optional(),
    jobId: z.string().optional(),
    reviewed: z.boolean().optional(),
  })
  .passthrough();

export const invoiceSchema = z
  .object({
    id: z.string().optional(),
    invoiceNumber: z.string().optional(),
    status: z.union([invoiceStatusSchema, z.string()]).optional(),
    total: moneyInput,
    invoiceDate: dateInput,
    dueDate: dateInput,
    clientName: z.string().optional(),
    jobId: z.string().optional(),
  })
  .passthrough();

export const jobSchema = z
  .object({
    projectId: z.string(),
    name: z.string(),
    orgId: z.string().optional(),
    invitedEmails: z.array(z.string()).optional(),
    status: z.enum(['active', 'archived']).optional(),
  })
  .passthrough();

export const profileSchema = z
  .object({
    uid: z.string().optional(),
    email: z.string().optional(),
    displayName: z.string().optional(),
    mobile: z.string().optional(),
    businessName: z.string().optional(),
    abn: z.string().optional(),
  })
  .passthrough();

export const organisationSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    ownerEmail: z.string().optional(),
    invitedEmails: z.array(z.string()).optional(),
  })
  .passthrough();

export const clientSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    email: z.string().optional(),
  })
  .passthrough();

export const supplierSchema = clientSchema;

export const jobFileTypeSchema = z.enum(JOB_FILE_TYPES);

export const jobFileLinkedToSchema = z.object({
  kind: z.enum(JOB_FILE_LINK_KINDS),
  id: z.string().min(1),
});

export const jobFileSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1).max(200),
    type: jobFileTypeSchema,
    storagePath: z.string().min(1),
    thumbnailPath: z.string().min(1).nullable().optional(),
    contentType: z.string().min(1).refine(isAllowedJobFileContentType, {
      message: 'That file type is not allowed',
    }),
    sizeBytes: z.number().int().nonnegative().max(JOB_FILE_MAX_BYTES),
    uploadedBy: z.string().min(1),
    uploadedAt: z.unknown().optional(),
    documentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Document date must be YYYY-MM-DD'),
    note: z.string().max(2000).optional(),
    linkedTo: jobFileLinkedToSchema.nullable().optional(),
    status: z.enum(['active', 'archived']),
    archivedAt: z.unknown().nullable().optional(),
    jobId: z.string().optional(),
  })
  .passthrough();

export const costPlanLevelSchema = z.enum(['target', 'trades', 'imported']);
export const costPlanGstModeSchema = z.enum(['inclusive', 'exclusive']);
export const costPlanStatusSchema = z.enum(['draft', 'locked', 'archived']);

export const costPlanSchema = z
  .object({
    id: z.string().optional(),
    jobId: z.string().min(1),
    level: costPlanLevelSchema,
    targetCents: z.number().int().positive(),
    baselineDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Baseline date must be YYYY-MM-DD'),
    gstMode: costPlanGstModeSchema,
    status: costPlanStatusSchema,
    sections: z.array(z.unknown()).max(250),
    createdBy: z.string().min(1),
    createdAt: z.unknown().optional(),
    updatedAt: z.unknown().optional(),
    archivedAt: z.unknown().nullable().optional(),
  })
  .passthrough();

export const JOB_FILE_CONTENT_TYPES = ALLOWED_JOB_FILE_CONTENT_TYPES;

export type Expense = z.infer<typeof expenseSchema>;
export type Invoice = z.infer<typeof invoiceSchema>;
export type Job = z.infer<typeof jobSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Organisation = z.infer<typeof organisationSchema>;
export type Client = z.infer<typeof clientSchema>;
export type Supplier = z.infer<typeof supplierSchema>;
export type JobFile = z.infer<typeof jobFileSchema>;
export type CostPlan = z.infer<typeof costPlanSchema>;

export function parseAtBoundary<T>(
  schema: z.ZodType<T>,
  value: unknown,
): { ok: true; data: T } | { ok: false; data: Record<string, unknown>; issues: string[] } {
  const result = schema.safeParse(value);
  if (result.success) return { ok: true, data: result.data };
  const raw =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : { value };
  return {
    ok: false,
    data: { ...raw, _invalid: true },
    issues: result.error.issues.map((issue) => issue.message),
  };
}
