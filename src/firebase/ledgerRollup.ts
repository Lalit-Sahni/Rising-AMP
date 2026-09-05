import { doc, onSnapshot, type DocumentSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from './config';
import { getActiveOrgId } from './tenancy';
import {
  LEDGER_ROLLUP_COLLECTION,
  LEDGER_ROLLUP_DOC_ID,
  parseCompleteRollup,
  type LedgerRollup,
} from '../domain/ledgerRollup';

export { LEDGER_ROLLUP_COLLECTION, LEDGER_ROLLUP_DOC_ID };

export function ledgerRollupRef(jobId: string, orgId?: string) {
  return doc(
    db,
    'organizations',
    orgId || getActiveOrgId(),
    'projects',
    jobId,
    LEDGER_ROLLUP_COLLECTION,
    LEDGER_ROLLUP_DOC_ID,
  );
}

export function listenLedgerRollup(
  jobId: string,
  onNext: (rollup: LedgerRollup | null, meta: { fromCache: boolean }) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!jobId) {
    onNext(null, { fromCache: false });
    return () => {};
  }

  const next = (snap: DocumentSnapshot) => {
    const parsed = snap.exists() ? parseCompleteRollup(snap.data() || {}) : null;
    onNext(parsed, { fromCache: snap.metadata.fromCache });
  };

  if (onError) {
    return onSnapshot(ledgerRollupRef(jobId), next, onError);
  }
  return onSnapshot(ledgerRollupRef(jobId), next);
}
