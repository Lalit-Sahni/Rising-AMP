import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { normalizeExpenseCategory } from '../domain/expenseCategory';
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

export async function setExpenseCategory(
  jobId: string,
  expenseId: string,
  category: string,
  tradeId: string | null,
): Promise<void> {
  if (!jobId) throw new Error('Missing job');
  if (!expenseId) throw new Error('Missing expense');
  const next = normalizeExpenseCategory(category);
  if (!next) throw new Error('Choose a category.');
  await updateDoc(
    doc(db, 'organizations', getActiveOrgId(), 'projects', jobId, 'expenses', expenseId),
    {
      category: next,
      tradeId,
      updatedAt: serverTimestamp(),
    },
  );
}
