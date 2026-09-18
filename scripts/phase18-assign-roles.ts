#!/usr/bin/env npx tsx
/**
 * Propose managers / Site / "ask the owner" from what each person did in
 * the last 90 days. Dry-run is the default. Writes nothing unless --apply
 * is passed on staging.
 *
 *   npx esbuild scripts/phase18-assign-roles.ts --bundle --platform=node --format=cjs --outfile=/tmp/phase18-roles.cjs
 *   node /tmp/phase18-roles.cjs --staging
 *   node /tmp/phase18-roles.cjs --apply --staging
 *
 * Refuses --production without --i-mean-production. Never --apply on production.
 * Never proposes Viewer. Missing managers/viewers stay Site (no write needed).
 */

import { canonicalEmail } from '../src/firebase/emailAddress';
import {
  actorEmailFrom,
  formatRoleProposalTable,
  inLastDays,
  mergeRoleProposals,
  parsePhase18RoleArgs,
  type PersonJobActivity,
} from '../src/domain/proposeJobRoles';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fb = require('./lib/phase1Firebase');

const ORG = 'opal-ss-constructions';
const DAYS = 90;

function decodeValue(value: any): any {
  if (!value || typeof value !== 'object') return null;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.nullValue !== undefined) return null;
  if (value.timestampValue !== undefined) return new Date(value.timestampValue);
  if (value.mapValue) {
    const out: Record<string, unknown> = {};
    Object.entries(value.mapValue.fields || {}).forEach(([key, nested]) => {
      out[key] = decodeValue(nested);
    });
    return out;
  }
  if (value.arrayValue && Array.isArray(value.arrayValue.values)) {
    return value.arrayValue.values.map(decodeValue);
  }
  return null;
}

function decodeDoc(doc: any): Record<string, unknown> {
  const parts = String(doc.name || '').split('/');
  const out: Record<string, unknown> = { id: parts[parts.length - 1] };
  Object.entries(doc.fields || {}).forEach(([key, value]) => {
    out[key] = decodeValue(value);
  });
  return out;
}

function emptyActivity(email: string, jobId: string, jobName: string): PersonJobActivity {
  return {
    email,
    jobId,
    jobName,
    expensesCreated: 0,
    expensesEdited: 0,
    invoices: 0,
    filesUploaded: 0,
    photosUploaded: 0,
    assistantReceipts: 0,
    costPlanChanges: 0,
    costPlanLocks: 0,
  };
}

async function listDecoded(
  accessToken: string,
  parentName: string,
  collectionId: string,
): Promise<Array<Record<string, unknown>>> {
  const docs = await fb.listDocuments(accessToken, parentName, collectionId);
  return (docs || []).map(decodeDoc);
}

function bump(
  byKey: Map<string, PersonJobActivity>,
  email: string | null,
  jobId: string,
  jobName: string,
  field: keyof PersonJobActivity,
) {
  if (!email || !String(email).includes('@')) return;
  const key = `${canonicalEmail(email)}:${jobId}`;
  const current = byKey.get(key) || emptyActivity(email, jobId, jobName);
  if (typeof current[field] === 'number') {
    (current[field] as number) += 1;
  }
  byKey.set(key, current);
}

async function main() {
  const flags = parsePhase18RoleArgs(process.argv.slice(2));
  const projectId = flags.production ? fb.PRODUCTION_PROJECT : fb.STAGING_PROJECT;
  const accessToken = await fb.getAccessToken();
  const parent = (path: string) => fb.docResourceName(projectId, '(default)', path);
  const now = new Date();

  const orgRes = await fb.googleFetch(
    `https://firestore.googleapis.com/v1/${parent(`organizations/${ORG}`)}`,
    { accessToken },
  );
  if (!orgRes.ok) throw new Error(`org doc read failed: ${orgRes.status}`);
  const org = decodeDoc(orgRes.json);
  const ownerEmail = String(org.ownerEmail || '');

  const projects = await listDecoded(accessToken, parent(`organizations/${ORG}`), 'projects');

  const uidToEmail = new Map<string, string>();
  const profileDocs = await fb.googleFetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`,
    {
      accessToken,
      method: 'POST',
      body: {
        structuredQuery: {
          from: [{ collectionId: 'publicProfiles' }],
          limit: 200,
        },
      },
    },
  ).catch(() => ({ ok: false, json: null }));
  if (profileDocs && profileDocs.ok && Array.isArray(profileDocs.json)) {
    profileDocs.json.forEach((row: any) => {
      const doc = row.document;
      if (!doc) return;
      const data = decodeDoc(doc);
      const uid = String(data.uid || '');
      const email = String(data.email || '').toLowerCase();
      if (uid && email.includes('@')) uidToEmail.set(uid, email);
    });
  }

  const byKey = new Map<string, PersonJobActivity>();
  const people = new Set<string>();

  for (const project of projects) {
    const jobId = String(project.id);
    const jobName = String(project.name || jobId);
    const invited = Array.isArray(project.invitedEmails) ? project.invitedEmails : [];
    invited.forEach((email) => {
      const lowered = String(email || '').toLowerCase();
      if (!lowered.includes('@')) return;
      people.add(canonicalEmail(lowered) || lowered);
      const key = `${canonicalEmail(lowered) || lowered}:${jobId}`;
      if (!byKey.has(key)) byKey.set(key, emptyActivity(lowered, jobId, jobName));
    });

    const jobParent = parent(`organizations/${ORG}/projects/${jobId}`);
    const expenses = await listDecoded(accessToken, jobParent, 'expenses');
    expenses.forEach((doc) => {
      const created = inLastDays(doc.timestamp || doc.createdAt, now, DAYS);
      const edited = inLastDays(doc.updatedAt, now, DAYS);
      if (!created && !edited) return;
      const email = actorEmailFrom(doc, uidToEmail);
      if (created) bump(byKey, email, jobId, jobName, 'expensesCreated');
      if (edited) bump(byKey, email, jobId, jobName, 'expensesEdited');
    });

    const invoices = await listDecoded(accessToken, jobParent, 'invoices');
    invoices.forEach((doc) => {
      if (!inLastDays(doc.timestamp || doc.createdAt || doc.updatedAt || doc.invoiceDate, now, DAYS)) return;
      bump(byKey, actorEmailFrom(doc, uidToEmail), jobId, jobName, 'invoices');
    });

    const files = await listDecoded(accessToken, jobParent, 'files');
    files.forEach((doc) => {
      if (!inLastDays(doc.uploadedAt || doc.createdAt, now, DAYS)) return;
      const email = actorEmailFrom(doc, uidToEmail);
      bump(byKey, email, jobId, jobName, 'filesUploaded');
      if (doc.type === 'photo') bump(byKey, email, jobId, jobName, 'photosUploaded');
    });

    const planSnap = await fb.googleFetch(
      `https://firestore.googleapis.com/v1/${parent(`organizations/${ORG}/projects/${jobId}/costPlan/current`)}`,
      { accessToken },
    );
    if (planSnap.ok && planSnap.json && planSnap.json.fields) {
      const plan = decodeDoc(planSnap.json);
      if (inLastDays(plan.updatedAt || plan.createdAt, now, DAYS)) {
        const email = actorEmailFrom(plan, uidToEmail);
        bump(byKey, email, jobId, jobName, 'costPlanChanges');
        if (plan.status === 'locked') bump(byKey, email, jobId, jobName, 'costPlanLocks');
      }
    }
  }

  const receipts = await listDecoded(accessToken, parent(`organizations/${ORG}`), 'assistantReceipts');
  receipts.forEach((doc) => {
    if (!inLastDays(doc.createdAt, now, DAYS)) return;
    const jobId = String(doc.jobId || '');
    const job = projects.find((row) => String(row.id) === jobId);
    const jobName = job ? String(job.name || jobId) : jobId;
    bump(byKey, actorEmailFrom(doc, uidToEmail), jobId, jobName, 'assistantReceipts');
  });

  const rows = Array.from(byKey.values());
  const table = mergeRoleProposals(rows);
  console.log(`Org ${ORG}  ${flags.production ? 'production' : 'staging'}  last ${DAYS} days`);
  console.log(`Owner ${ownerEmail || '(missing)'}  people ${table.length}  jobs ${projects.length}`);
  console.log(formatRoleProposalTable(table));
  console.log('');
  console.log('Proposed role "ask" is a question for the owner, not Viewer.');
  console.log('Missing managers/viewers stay Site. No document is written for Site.');

  if (!flags.apply) {
    console.log('Dry-run. 0 write(s). Pass --apply --staging to write manager arrays after the owner approves this table.');
    return;
  }

  throw new Error('Apply is implemented only after the owner approves the table. This session does not write.');
}

const isDirect = typeof require !== 'undefined' && require.main === module;
if (isDirect) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

export { main };
