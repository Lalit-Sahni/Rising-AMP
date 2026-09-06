'use strict';

const { isSafeProjectId } = require('./emailMatch');
const {
  LEDGER_ROLLUP_COLLECTION,
  LEDGER_ROLLUP_DOC_ID,
  computeLedgerRollup,
  commitRollupIfRevisionUnchanged,
  firestorePayload,
} = require('./ledgerRollup');

const PAGE_SIZE = 300;
const MAX_ATTEMPTS = 8;

function isSafeOrgId(orgId) {
  return /^[a-z0-9-]{3,80}$/.test(String(orgId || ''));
}

class RevisionConflict extends Error {
  constructor() {
    super('revision-conflict');
    this.code = 'revision-conflict';
  }
}

async function listAllExpenses(db, orgId, jobId, FieldPath) {
  const col = db
    .collection('organizations')
    .doc(orgId)
    .collection('projects')
    .doc(jobId)
    .collection('expenses');
  const expenses = [];
  let last = null;
  while (true) {
    let query = col.orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (last) query = query.startAfter(last);
    const snap = await query.get();
    snap.forEach((doc) => {
      expenses.push(Object.assign({ id: doc.id }, doc.data() || {}));
    });
    if (snap.size < PAGE_SIZE) break;
    last = snap.docs[snap.docs.length - 1];
  }
  return expenses;
}

/**
 * Rebuild the job's rollup from every expense, then write the complete
 * document in one set() if the revision is still the one we read.
 * A throw before set, or a failed transaction, leaves the previous totals.
 */
async function recomputeLedgerRollupForJob(db, orgId, jobId, deps) {
  if (!isSafeOrgId(orgId) || !isSafeProjectId(jobId)) {
    throw new Error('Invalid job path');
  }
  const FieldValue = deps && deps.FieldValue;
  const FieldPath = deps && deps.FieldPath;
  const listExpenses = (deps && deps.listExpenses) || listAllExpenses;
  if (!FieldValue || !FieldPath) {
    throw new Error('Missing Firestore FieldValue/FieldPath');
  }

  const rollupRef = db
    .collection('organizations')
    .doc(orgId)
    .collection('projects')
    .doc(jobId)
    .collection(LEDGER_ROLLUP_COLLECTION)
    .doc(LEDGER_ROLLUP_DOC_ID);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const previousSnap = await rollupRef.get();
    const previous = previousSnap.exists ? previousSnap.data() : null;
    const expectedRevision = previous && Number.isInteger(previous.revision) ? previous.revision : 0;
    const expenses = await listExpenses(db, orgId, jobId, FieldPath);
    const computed = computeLedgerRollup(expenses, expectedRevision);

    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(rollupRef);
        const current = snap.exists ? snap.data() : null;
        const wrote = commitRollupIfRevisionUnchanged(
          current && Number.isInteger(current.revision) ? current : null,
          expectedRevision,
          computed,
          (next) => {
            tx.set(rollupRef, firestorePayload(next, FieldValue.serverTimestamp()));
          },
        );
        if (!wrote) throw new RevisionConflict();
      });
      return computed;
    } catch (error) {
      if (error && error.code === 'revision-conflict') continue;
      throw error;
    }
  }

  throw new Error('Rollup was busy. Try again.');
}

module.exports = {
  RevisionConflict,
  listAllExpenses,
  recomputeLedgerRollupForJob,
};
