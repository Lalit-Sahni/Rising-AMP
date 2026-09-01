import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from './config';
import { getActiveOrgId } from './tenancy';

export async function setExpenseTradeId(
  jobId: string,
  expenseId: string,
  tradeId: string | null,
): Promise<void> {
  if (!jobId) throw new Error('Missing job');
  if (!expenseId) throw new Error('Missing expense');
  await updateDoc(
    doc(db, 'organizations', getActiveOrgId(), 'projects', jobId, 'expenses', expenseId),
    {
      tradeId,
      updatedAt: serverTimestamp(),
    },
  );
}
