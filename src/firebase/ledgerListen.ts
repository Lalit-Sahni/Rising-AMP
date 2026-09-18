import {
  collection,
  doc,
  getCountFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './config';
import { getActiveOrgId } from './tenancy';
import {
  mapExpenseSnapshot,
  mapInvoiceSnapshot,
  shouldApplyCachedSnapshot,
} from './ledgerMap';

export { shouldApplyCachedSnapshot };

export type LedgerListenMeta = {
  fromCache: boolean;
};

export type ExpenseListenResult = {
  success: true;
  expenses: Array<Record<string, unknown>>;
  expensesCapped: boolean;
  fromCache: boolean;
};

export type InvoiceListenResult = {
  success: true;
  invoices: Array<Record<string, unknown>>;
  fromCache: boolean;
};

function jobRef(jobId: string) {
  return doc(db, 'organizations', getActiveOrgId(), 'projects', jobId);
}

/**
 * Live expenses for one job. First callback is from IndexedDB when the disk
 * cache has this query; the server follows. The 1,000-row cap still hides
 * spend rather than showing a partial total. Count the collection only when
 * the page is full — a cache snapshot must not pay Iowa for getCountFromServer.
 */
export function listenJobExpenses(
  jobId: string,
  onNext: (result: ExpenseListenResult) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!jobId) return () => {};

  const projectRef = jobRef(jobId);
  const expensesCollectionRef = collection(projectRef, 'expenses');
  const expensesQuery = query(
    expensesCollectionRef,
    orderBy('timestamp', 'desc'),
    limit(1000),
  );

  let lastExpenses: Array<Record<string, unknown>> = [];
  let lastCapped = false;
  let lastFromCache = true;
  let appliedExpenses = false;

  const emit = () => {
    if (!appliedExpenses) return;
    onNext({
      success: true,
      expenses: lastExpenses,
      expensesCapped: lastCapped,
      fromCache: lastFromCache,
    });
  };

  // includeMetadataChanges: an empty cache snapshot is skipped so it cannot
  // wipe a painted list. Without metadata events, a job with no expenses never
  // fires again (empty cache and empty server look the same), so Files waits
  // forever. The follow-up fromCache=false empty snapshot is what unblocks it.
  const unsub = onSnapshot(
    expensesQuery,
    { includeMetadataChanges: true },
    (snap) => {
      const fromCache = snap.metadata.fromCache;
      if (!shouldApplyCachedSnapshot(fromCache, snap.size) && !appliedExpenses) {
        return;
      }
      lastExpenses = mapExpenseSnapshot(snap);
      lastFromCache = fromCache;
      lastCapped = snap.size >= 1000;
      appliedExpenses = true;
      emit();

      if (!fromCache && snap.size >= 1000) {
        getCountFromServer(expensesCollectionRef)
          .then((countSnap) => {
            const totalOnServer = countSnap.data().count || 0;
            lastCapped = totalOnServer > lastExpenses.length;
            lastFromCache = false;
            emit();
          })
          .catch(() => {});
      }
    },
    onError,
  );

  return unsub;
}

export function listenJobInvoices(
  jobId: string,
  onNext: (result: InvoiceListenResult) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!jobId) return () => {};

  const invoicesQuery = query(
    collection(jobRef(jobId), 'invoices'),
    orderBy('timestamp', 'desc'),
  );
  let applied = false;

  return onSnapshot(
    invoicesQuery,
    { includeMetadataChanges: true },
    (snap) => {
      const fromCache = snap.metadata.fromCache;
      if (!shouldApplyCachedSnapshot(fromCache, snap.size) && !applied) {
        return;
      }
      applied = true;
      onNext({
        success: true,
        invoices: mapInvoiceSnapshot(snap),
        fromCache,
      });
    },
    onError,
  );
}
