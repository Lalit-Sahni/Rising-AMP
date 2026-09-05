import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
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
  budget: number;
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

  let budget = 0;
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
      budget,
      fromCache: lastFromCache,
    });
  };

  const unsub = onSnapshot(
    expensesQuery,
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

  getDoc(projectRef)
    .then((snap) => {
      budget = (snap.data()?.budget as number | undefined) || 0;
      emit();
    })
    .catch(() => {});

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
