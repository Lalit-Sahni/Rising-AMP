/**
 * Phase 18 Part B. Propose a per-job role from what a person actually did.
 * Never guesses Viewer. No writes in 90 days is a question for the owner.
 */
import { canonicalEmail, normalizeEmail } from '../firebase/emailAddress';

export type ProposedJobRole = 'manager' | 'site' | 'ask';

export type PersonJobActivity = {
  email: string;
  jobId: string;
  jobName?: string;
  expensesCreated: number;
  expensesEdited: number;
  invoices: number;
  filesUploaded: number;
  photosUploaded: number;
  assistantReceipts: number;
  costPlanChanges: number;
  costPlanLocks: number;
};

export type RoleProposalRow = {
  email: string;
  jobs: string[];
  activity: string;
  proposedRole: ProposedJobRole;
};

export function activityWriteCount(row: PersonJobActivity): number {
  return (
    row.expensesCreated
    + row.expensesEdited
    + row.invoices
    + row.filesUploaded
    + row.assistantReceipts
    + row.costPlanChanges
    + row.costPlanLocks
  );
}

export function proposeRoleFromActivity(row: PersonJobActivity): ProposedJobRole {
  if (row.invoices > 0 || row.costPlanLocks > 0) return 'manager';
  if (activityWriteCount(row) > 0) return 'site';
  return 'ask';
}

function activitySummary(rows: PersonJobActivity[]): string {
  const totals = rows.reduce((acc, row) => ({
    expenses: acc.expenses + row.expensesCreated + row.expensesEdited,
    invoices: acc.invoices + row.invoices,
    files: acc.files + row.filesUploaded,
    photos: acc.photos + row.photosUploaded,
    receipts: acc.receipts + row.assistantReceipts,
    costPlan: acc.costPlan + row.costPlanChanges,
    locks: acc.locks + row.costPlanLocks,
  }), {
    expenses: 0,
    invoices: 0,
    files: 0,
    photos: 0,
    receipts: 0,
    costPlan: 0,
    locks: 0,
  });
  const parts: string[] = [];
  if (totals.expenses) parts.push(`${totals.expenses} expense write${totals.expenses === 1 ? '' : 's'}`);
  if (totals.invoices) parts.push(`${totals.invoices} invoice${totals.invoices === 1 ? '' : 's'}`);
  if (totals.photos) parts.push(`${totals.photos} photo${totals.photos === 1 ? '' : 's'}`);
  if (totals.files - totals.photos > 0) {
    const other = totals.files - totals.photos;
    parts.push(`${other} file${other === 1 ? '' : 's'}`);
  }
  if (totals.receipts) parts.push(`${totals.receipts} assistant receipt${totals.receipts === 1 ? '' : 's'}`);
  if (totals.locks) parts.push(`${totals.locks} cost plan lock${totals.locks === 1 ? '' : 's'}`);
  else if (totals.costPlan) parts.push(`${totals.costPlan} cost plan edit${totals.costPlan === 1 ? '' : 's'}`);
  return parts.length > 0 ? parts.join(', ') : 'no writes in 90 days';
}

function strongestRole(roles: ProposedJobRole[]): ProposedJobRole {
  if (roles.includes('manager')) return 'manager';
  if (roles.includes('site')) return 'site';
  return 'ask';
}

export function mergeRoleProposals(rows: PersonJobActivity[]): RoleProposalRow[] {
  const byPerson = new Map<string, PersonJobActivity[]>();
  rows.forEach((row) => {
    const key = canonicalEmail(row.email) || normalizeEmail(row.email);
    const list = byPerson.get(key) || [];
    list.push(row);
    byPerson.set(key, list);
  });

  return Array.from(byPerson.entries())
    .map(([, list]) => {
      const jobs = Array.from(new Set(list.map((row) => row.jobName || row.jobId)));
      const proposedRole = strongestRole(list.map(proposeRoleFromActivity));
      return {
        email: list[0].email,
        jobs,
        activity: activitySummary(list),
        proposedRole,
      };
    })
    .sort((a, b) => a.email.localeCompare(b.email));
}

export function formatRoleProposalTable(rows: RoleProposalRow[]): string {
  const header = ['Person', 'Jobs', 'Activity (90 days)', 'Proposed role'];
  const body = rows.map((row) => [
    row.email,
    row.jobs.join(', ') || '—',
    row.activity,
    row.proposedRole,
  ]);
  const widths = header.map((cell, index) => (
    Math.max(cell.length, ...body.map((line) => (line[index] || '').length))
  ));
  const pad = (line: string[]) => line.map((cell, index) => cell.padEnd(widths[index])).join('  ');
  return [pad(header), pad(widths.map((width) => '-'.repeat(width))), ...body.map(pad)].join('\n');
}

export function actorEmailFrom(
  data: Record<string, unknown> | null | undefined,
  uidToEmail: Map<string, string>,
): string | null {
  if (!data) return null;
  const direct = [data.email, data.createdByEmail, data.addedBy, data.user, data.createdBy]
    .map((value) => String(value || '').trim().toLowerCase())
    .find((value) => value.includes('@'));
  if (direct) return direct;
  const uid = [data.uploadedBy, data.createdBy, data.uid, data.userId]
    .map((value) => String(value || '').trim())
    .find((value) => value && !value.includes('@') && uidToEmail.has(value));
  return uid ? uidToEmail.get(uid) || null : null;
}

export type Phase18RoleFlags = {
  apply: boolean;
  production: boolean;
  staging: boolean;
  iMeanProduction: boolean;
};

export function parsePhase18RoleArgs(argv: string[]): Phase18RoleFlags {
  const production = argv.includes('--production');
  const staging = argv.includes('--staging');
  const apply = argv.includes('--apply');
  const iMeanProduction = argv.includes('--i-mean-production');
  if (production && staging) {
    throw new Error('Pick --staging or --production, not both.');
  }
  if (production && !iMeanProduction) {
    throw new Error('Refusing --production without --i-mean-production.');
  }
  if (apply && production) {
    throw new Error('Refusing --apply on production. Propose on staging first.');
  }
  if (apply && !staging) {
    throw new Error('--apply is staging only. Pass --staging.');
  }
  if (!production && !staging) {
    throw new Error('Pass --staging (dry-run). Production also needs --i-mean-production.');
  }
  return { apply, production, staging, iMeanProduction };
}

export function inLastDays(value: unknown, now: Date, days: number): boolean {
  if (value == null) return false;
  let date: Date | null = null;
  if (value instanceof Date) date = value;
  else if (typeof value === 'object' && value && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    date = (value as { toDate: () => Date }).toDate();
  } else {
    const parsed = new Date(typeof value === 'number' ? value : String(value));
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }
  if (!date) return false;
  return now.getTime() - date.getTime() <= days * 86400000 && date.getTime() <= now.getTime() + 86400000;
}
