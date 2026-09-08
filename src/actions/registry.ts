/**
 * Dispatch one named action. Unknown names are rejected. NEVER names refuse
 * with no write. Does not run queries. Does not call a model.
 */
import { actionFailure, isNeverAction, type ActionResult } from './core';
import { codeExpense } from './codeExpense';
import { codeExpenseBatch } from './codeExpenseBatch';
import { createExpense } from './createExpense';
import type { ActionStore } from './store';
import { undoAction } from './undo';

export async function runAction(
  name: unknown,
  input: unknown,
  store: ActionStore,
): Promise<ActionResult> {
  if (typeof name !== 'string' || !name.trim()) {
    return actionFailure('unknown_action', 'That action is not on the list.');
  }
  const action = name.trim();
  if (isNeverAction(action)) {
    return actionFailure('never_action', 'The assistant cannot do that.');
  }
  if (action === 'codeExpense') return codeExpense(input, store);
  if (action === 'createExpense') return createExpense(input, store);
  if (action === 'codeExpenseBatch') return codeExpenseBatch(input, store);
  if (action === 'undoAction') return undoAction(input, store);
  return actionFailure('unknown_action', 'That action is not on the list.');
}
