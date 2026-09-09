/**
 * Firestore adapter for the job facts record.
 * Path: organizations/{orgId}/projects/{jobId}/facts/current
 * Do not import from App.js, PaletteHost or Header.
 */
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import {
  JOB_FACTS_COLLECTION,
  JOB_FACTS_DOC_ID,
  JOB_FACTS_SCHEMA_VERSION,
  jobFactsPatchSchema,
  mergeJobFactsPatch,
  parseJobFacts,
  type JobFactFieldName,
  type JobFacts,
  type JobFactsPatch,
  type MergeJobFactsResult,
} from '../domain/jobFacts';
import { db } from './config';
import { getActiveOrgId } from './tenancy';

export { JOB_FACTS_COLLECTION, JOB_FACTS_DOC_ID, JOB_FACTS_SCHEMA_VERSION };

function factsRef(jobId: string, orgId?: string) {
  if (!jobId) throw new Error('Missing job');
  return doc(
    db,
    'organizations',
    orgId || getActiveOrgId(),
    'projects',
    jobId,
    JOB_FACTS_COLLECTION,
    JOB_FACTS_DOC_ID,
  );
}

function validationError(issues: string[]) {
  return issues[0] || 'Those job facts are not valid';
}

function definedFields(data: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  Object.entries(data || {}).forEach(([key, value]) => {
    if (value !== undefined) out[key] = value;
  });
  return out;
}

function factsWritePayload(facts: JobFacts): Record<string, unknown> {
  const { id: _id, ...rest } = facts;
  return definedFields(rest as Record<string, unknown>);
}

export async function fetchJobFacts(
  jobId: string,
  orgId?: string,
): Promise<JobFacts | null> {
  const snap = await getDoc(factsRef(jobId, orgId));
  if (!snap.exists()) return null;

  const parsed = parseJobFacts({
    id: snap.id,
    ...snap.data(),
  });
  if (!parsed.ok) {
    throw new Error(validationError(parsed.issues));
  }
  return parsed.data;
}

export async function saveJobFacts(
  jobId: string,
  patch: JobFactsPatch,
  options?: { createdBy?: string; orgId?: string },
): Promise<MergeJobFactsResult> {
  const parsedPatch = jobFactsPatchSchema.parse(patch);
  const ref = factsRef(jobId, options?.orgId);
  let saved: MergeJobFactsResult | null = null;

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    const now = new Date();
    let current: JobFacts | null = null;

    if (snap.exists()) {
      const existing = parseJobFacts({
        id: snap.id,
        ...snap.data(),
      });
      if (!existing.ok) {
        throw new Error(validationError(existing.issues));
      }
      current = existing.data;
    }

    const merged = mergeJobFactsPatch(current, parsedPatch, {
      jobId,
      updatedAt: now,
      createdBy: options?.createdBy,
      createdAt: now,
    });

    if (current && merged.written.length === 0) {
      saved = merged;
      return;
    }

    const payload = factsWritePayload(merged.facts);
    payload.jobId = jobId;
    payload.schemaVersion = JOB_FACTS_SCHEMA_VERSION;
    payload.updatedAt = serverTimestamp();

    if (current) {
      payload.jobId = current.jobId;
      if (current.createdBy) payload.createdBy = current.createdBy;
      if (current.createdAt !== undefined) payload.createdAt = current.createdAt;
      else delete payload.createdAt;
    } else if (options?.createdBy) {
      payload.createdBy = options.createdBy;
      payload.createdAt = serverTimestamp();
    } else {
      delete payload.createdAt;
      delete payload.createdBy;
    }

    transaction.set(ref, payload);
    saved = merged;
  });

  if (!saved) throw new Error('Job facts were not saved');
  return saved;
}

export type { JobFactFieldName, JobFacts, JobFactsPatch, MergeJobFactsResult };
