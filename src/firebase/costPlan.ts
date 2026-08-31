import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { costPlanSchema, parseAtBoundary, type CostPlan } from '../domain/schemas';
import { COST_PLAN_DOC_ID } from '../domain/costPlan';
import { db } from './config';
import { getActiveOrgId } from './tenancy';

type SaveTargetInput = {
  targetCents: number;
  baselineDate: string;
  createdBy: string;
  gstMode?: 'inclusive' | 'exclusive';
};

function planRef(jobId: string) {
  if (!jobId) throw new Error('Missing job');
  return doc(
    db,
    'organizations',
    getActiveOrgId(),
    'projects',
    jobId,
    'costPlan',
    COST_PLAN_DOC_ID,
  );
}

function validationError(issues: string[]) {
  return issues[0] || 'That cost plan is not valid';
}

export async function fetchCostPlan(jobId: string): Promise<CostPlan | null> {
  const snap = await getDoc(planRef(jobId));
  if (!snap.exists()) return null;

  const parsed = parseAtBoundary(costPlanSchema, {
    id: snap.id,
    ...snap.data(),
  });
  if (!parsed.ok) {
    throw new Error(validationError(parsed.issues));
  }
  return parsed.data;
}

export async function saveCostPlanTarget(
  jobId: string,
  input: SaveTargetInput,
): Promise<CostPlan> {
  const gstMode = input.gstMode || 'inclusive';
  const ref = planRef(jobId);
  let saved: CostPlan | null = null;

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    const now = new Date();

    if (snap.exists()) {
      const existing = parseAtBoundary(costPlanSchema, {
        id: snap.id,
        ...snap.data(),
      });
      if (!existing.ok) {
        throw new Error(validationError(existing.issues));
      }
      if (existing.data.status !== 'draft') {
        throw new Error('This cost plan baseline is locked and cannot be edited');
      }

      const candidate = {
        ...existing.data,
        targetCents: input.targetCents,
        baselineDate: input.baselineDate,
        gstMode,
        updatedAt: now,
      };
      const parsed = parseAtBoundary(costPlanSchema, candidate);
      if (!parsed.ok) {
        throw new Error(validationError(parsed.issues));
      }

      transaction.update(ref, {
        targetCents: parsed.data.targetCents,
        baselineDate: parsed.data.baselineDate,
        gstMode: parsed.data.gstMode,
        updatedAt: serverTimestamp(),
      });
      saved = parsed.data;
      return;
    }

    const candidate = {
      id: COST_PLAN_DOC_ID,
      jobId,
      level: 'target' as const,
      targetCents: input.targetCents,
      baselineDate: input.baselineDate,
      gstMode,
      status: 'draft' as const,
      sections: [],
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
    const parsed = parseAtBoundary(costPlanSchema, candidate);
    if (!parsed.ok) {
      throw new Error(validationError(parsed.issues));
    }

    transaction.set(ref, {
      jobId: parsed.data.jobId,
      level: parsed.data.level,
      targetCents: parsed.data.targetCents,
      baselineDate: parsed.data.baselineDate,
      gstMode: parsed.data.gstMode,
      status: parsed.data.status,
      sections: parsed.data.sections,
      createdBy: parsed.data.createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      archivedAt: null,
    });
    saved = parsed.data;
  });

  if (!saved) throw new Error('Cost plan was not saved');
  return saved;
}
