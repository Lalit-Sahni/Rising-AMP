import { useEffect, useState } from 'react';
import { listenLedgerRollup } from '../firebase/ledgerRollup';
import type { LedgerRollup } from '../domain/ledgerRollup';

export function useLedgerRollup(
  orgId: string | null | undefined,
  jobId: string | null | undefined,
) {
  const [rollup, setRollup] = useState<LedgerRollup | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!orgId || !jobId) {
      setRollup(null);
      setLoaded(false);
      return undefined;
    }
    setLoaded(false);
    return listenLedgerRollup(
      jobId,
      (next) => {
        setRollup(next);
        setLoaded(true);
      },
      () => {
        setRollup(null);
        setLoaded(true);
      },
    );
  }, [orgId, jobId]);

  return { rollup, loaded };
}
