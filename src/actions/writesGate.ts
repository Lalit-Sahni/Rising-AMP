/**
 * Org kill switch for assistant writes. Only a deliberate boolean false is off;
 * missing, unreadable and junk are on. The tier and the origin decide what is
 * gated, never the function name. A propose wrote nothing, so it is never gated.
 */
import { actionFailure, type ActionFailure, type ActionOrigin, type ActionTier } from './core';
import type { ActionStore } from './store';

export const ASSISTANT_WRITES_OFF_OWNER_MESSAGE =
  'Assistant writes are off. Turn them back on in Profile.';

export const ASSISTANT_WRITES_OFF_MEMBER_MESSAGE =
  'Assistant writes are off for this organisation. Only the owner can turn them on.';

export function assistantWritesOffMessage(viewerIsOwner: boolean): string {
  return viewerIsOwner ? ASSISTANT_WRITES_OFF_OWNER_MESSAGE : ASSISTANT_WRITES_OFF_MEMBER_MESSAGE;
}

/** Only an explicit false is off. Missing, 'unknown' and junk values are on. */
export function isAssistantWritesEnabledValue(value: unknown): boolean {
  return value !== false;
}

export async function refuseIfWriteBlocked(args: {
  orgId: string;
  origin: ActionOrigin;
  tier: ActionTier;
  viewerIsOwner: boolean;
  store: ActionStore;
}): Promise<ActionFailure | null> {
  if (args.tier !== 'do' || args.origin !== 'assistant') return null;
  const stored = await args.store.assistantWritesEnabled(args.orgId);
  if (isAssistantWritesEnabledValue(stored)) return null;
  return actionFailure('assistant_writes_disabled', assistantWritesOffMessage(args.viewerIsOwner));
}
