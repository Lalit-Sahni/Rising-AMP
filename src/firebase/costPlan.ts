import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  type DocumentData,
  type UpdateData,
} from 'firebase/firestore';
import { costPlanSchema, parseAtBoundary, type CostPlan, type CostPlanSection } from '../domain/schemas';
import { COST_PLAN_DOC_ID, sumSectionAmounts } from '../domain/costPlan';
import { db } from './config';
import { getActiveOrgId } from './tenancy';

type SaveTargetInput = {
  targetCents: number;
  baselineDate: string;
  createdBy: string;
  gstMode?: 'inclusive' | 'exclusive';
};

type SaveTradesInput = {
  sections: CostPlanSection[];
  targetCents?: number;
  sourceFileId?: string | null;
  level?: 'trades' | 'imported';
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

function baselineNotEditable(status: CostPlan['status']): string {
  if (status === 'locked') {
    return 'This cost plan baseline is locked and cannot be edited';
  }
  if (status === 'archived') {
    return 'This cost plan was archived. Start a new one from Cost Plan.';
  }
  return 'This cost plan cannot be edited';
}

function sanitizeSection(section: CostPlanSection): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: section.id,
    tradeId: section.tradeId,
    name: section.name,
    order: section.order,
    amountCents: section.amountCents,
  };
  if (section.code) row.code = section.code;
  if (section.lines && section.lines.length > 0) {
    row.lines = section.lines.map((line) => {
      const next: Record<string, unknown> = {
        description: line.description,
        totalCents: line.totalCents,
      };
      if (line.code) next.code = line.code;
      if (line.qty != null) next.qty = line.qty;
      if (line.unit) next.unit = line.unit;
      if (line.unitPriceCents != null) next.unitPriceCents = line.unitPriceCents;
      return next;
    });
  }
  return row;
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
      if (existing.data.status === 'archived') {
        const candidate = {
          ...existing.data,
          level: 'target' as const,
          targetCents: input.targetCents,
          baselineDate: input.baselineDate,
          gstMode,
          status: 'draft' as const,
          sections: [],
          sourceFileId: null,
          archivedAt: null,
          updatedAt: now,
        };
        const parsed = parseAtBoundary(costPlanSchema, candidate);
        if (!parsed.ok) {
          throw new Error(validationError(parsed.issues));
        }
        transaction.update(ref, {
          level: parsed.data.level,
          targetCents: parsed.data.targetCents,
          baselineDate: parsed.data.baselineDate,
          gstMode: parsed.data.gstMode,
          status: parsed.data.status,
          sections: parsed.data.sections,
          sourceFileId: null,
          archivedAt: null,
          updatedAt: serverTimestamp(),
        });
        saved = parsed.data;
        return;
      }

      if (existing.data.status !== 'draft') {
        throw new Error(baselineNotEditable(existing.data.status));
      }
      if (existing.data.level !== 'target') {
        throw new Error('Change the trade amounts on Cost Plan instead of the one target number');
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

export async function saveCostPlanTrades(
  jobId: string,
  input: SaveTradesInput,
): Promise<CostPlan> {
  const ref = planRef(jobId);
  let saved: CostPlan | null = null;
  const level = input.level || 'trades';

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) {
      throw new Error('Set a target cost before breaking it into trades');
    }
    const existing = parseAtBoundary(costPlanSchema, {
      id: snap.id,
      ...snap.data(),
    });
    if (!existing.ok) {
      throw new Error(validationError(existing.issues));
    }
    if (existing.data.status !== 'draft') {
      throw new Error(baselineNotEditable(existing.data.status));
    }

    const sections = input.sections || [];
    const targetCents = input.targetCents ?? existing.data.targetCents;
    if (sections.length === 0) {
      throw new Error('Add an amount to at least one trade');
    }
    if (sumSectionAmounts(sections) !== targetCents) {
      throw new Error('Trade amounts must add up to the target cost');
    }

    const now = new Date();
    const candidate = {
      ...existing.data,
      level,
      targetCents,
      sections,
      gstMode: input.gstMode || existing.data.gstMode,
      sourceFileId: input.sourceFileId === undefined
        ? existing.data.sourceFileId
        : input.sourceFileId,
      updatedAt: now,
    };
    const parsed = parseAtBoundary(costPlanSchema, candidate);
    if (!parsed.ok) {
      throw new Error(validationError(parsed.issues));
    }

    const payload: Record<string, unknown> = {
      level: parsed.data.level,
      targetCents: parsed.data.targetCents,
      gstMode: parsed.data.gstMode,
      sections: parsed.data.sections.map(sanitizeSection),
      updatedAt: serverTimestamp(),
    };
    if (input.sourceFileId !== undefined) {
      payload.sourceFileId = parsed.data.sourceFileId ?? null;
    }
    transaction.update(ref, payload as UpdateData<DocumentData>);
    saved = parsed.data;
  });

  if (!saved) throw new Error('Cost plan was not saved');
  return saved;
}

export async function lockCostPlan(jobId: string): Promise<CostPlan> {
  const ref = planRef(jobId);
  let saved: CostPlan | null = null;

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) {
      throw new Error('There is no cost plan to lock');
    }
    const existing = parseAtBoundary(costPlanSchema, {
      id: snap.id,
      ...snap.data(),
    });
    if (!existing.ok) {
      throw new Error(validationError(existing.issues));
    }
    if (existing.data.status !== 'draft') {
      throw new Error(baselineNotEditable(existing.data.status));
    }
    const now = new Date();
    const parsed = parseAtBoundary(costPlanSchema, {
      ...existing.data,
      status: 'locked' as const,
      updatedAt: now,
    });
    if (!parsed.ok) {
      throw new Error(validationError(parsed.issues));
    }
    transaction.update(ref, {
      status: 'locked',
      updatedAt: serverTimestamp(),
    });
    saved = parsed.data;
  });

  if (!saved) throw new Error('Cost plan was not locked');
  return saved;
}

export async function archiveCostPlan(jobId: string): Promise<CostPlan> {
  const ref = planRef(jobId);
  let saved: CostPlan | null = null;

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) {
      throw new Error('There is no cost plan to archive');
    }
    const existing = parseAtBoundary(costPlanSchema, {
      id: snap.id,
      ...snap.data(),
    });
    if (!existing.ok) {
      throw new Error(validationError(existing.issues));
    }
    if (existing.data.status === 'archived') {
      throw new Error('This cost plan is already archived');
    }
    const now = new Date();
    const parsed = parseAtBoundary(costPlanSchema, {
      ...existing.data,
      status: 'archived' as const,
      archivedAt: now,
      updatedAt: now,
    });
    if (!parsed.ok) {
      throw new Error(validationError(parsed.issues));
    }
    transaction.update(ref, {
      status: 'archived',
      archivedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    saved = parsed.data;
  });

  if (!saved) throw new Error('Cost plan was not archived');
  return saved;
}
