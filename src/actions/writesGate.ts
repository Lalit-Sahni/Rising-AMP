/**
 * Org kill switch for assistant writes. Read at the start of every
 * mutating action. Undo is not gated here.
 */
import { actionFailure, type ActionFailure } from './core';
import type { ActionStore } from './store';

export const ASSISTANT_WRITES_OFF_MESSAGE =
  'The owner has turned off assistant writes. Nothing was changed. You can still undo what it already did.';

export const MUTATING_ACTION_NAMES = ['codeExpense', 'createExpense', 'codeExpenseBatch'] as const;

export function isMutatingActionName(name: string): boolean {
  return (MUTATING_ACTION_NAMES as readonly string[]).includes(name);
}

/** Firestore / live: only an explicit true is on. Missing, false, "yes" are off. */
export function isAssistantWritesEnabledValue(value: unknown): boolean {
  return value === true;
}

export function peekActionOrgId(input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const orgId = (input as { scope?: { orgId?: unknown } }).scope?.orgId;
  return String(orgId || '').trim();
}

export function peekActionClientKey(input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  return String((input as { clientKey?: unknown }).clientKey || '').trim();
}

export async function refuseIfAssistantWritesDisabled(
  orgId: string,
  store: ActionStore,
): Promise<ActionFailure | null> {
  const enabled = await store.assistantWritesEnabled(orgId);
  if (isAssistantWritesEnabledValue(enabled)) return null;
  return actionFailure('assistant_writes_disabled', ASSISTANT_WRITES_OFF_MESSAGE);
}

/**
 * Registry choke point. Replay of an existing clientKey still returns
 * the original receipt when the switch is off.
 */
export async function refuseMutatingActionIfDisabled(
  name: string,
  input: unknown,
  store: ActionStore,
): Promise<ActionFailure | null> {
  if (!isMutatingActionName(name)) return null;
  const orgId = peekActionOrgId(input);
  if (!orgId) return null;
  const clientKey = peekActionClientKey(input);
  if (clientKey) {
    const existing = await store.getReceiptByClientKey(orgId, clientKey);
    if (existing) return null;
  }
  return refuseIfAssistantWritesDisabled(orgId, store);
}
