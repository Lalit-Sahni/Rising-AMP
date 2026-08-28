import { z } from 'zod';

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

export type Expense = z.infer<typeof expenseSchema>;
export type Invoice = z.infer<typeof invoiceSchema>;
export type Job = z.infer<typeof jobSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Organisation = z.infer<typeof organisationSchema>;
export type Client = z.infer<typeof clientSchema>;
export type Supplier = z.infer<typeof supplierSchema>;

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
