/**
 * Rules are authorisation. When a write is refused, say so in plain language
 * rather than swallowing the error or showing Firestore's raw string.
 */

export function isPermissionDenied(error: unknown): boolean {
  const record = error && typeof error === 'object' ? error as { code?: unknown; message?: unknown } : null;
  const code = record && record.code;
  const message = String((record && record.message) || error || '');
  return code === 'permission-denied' || /permission-denied|insufficient permissions/i.test(message);
}

export type PermissionAction =
  | 'invite'
  | 'remove'
  | 'role'
  | 'expense'
  | 'invoice'
  | 'costPlanLock'
  | 'costPlanArchive'
  | 'costPlan';

const ACTION_COPY: Record<PermissionAction, string> = {
  invite: "You don't have permission to invite people to this job.",
  remove: "You don't have permission to remove people from this job.",
  role: "You don't have permission to change roles on this job.",
  expense: "You don't have permission to change expenses on this job.",
  invoice: "You don't have permission to change invoices on this job.",
  costPlanLock: "You don't have permission to lock the cost plan.",
  costPlanArchive: "You don't have permission to archive the cost plan.",
  costPlan: "You don't have permission to change the cost plan.",
};

export function permissionDeniedMessage(error: unknown, action?: PermissionAction): string {
  if (!isPermissionDenied(error)) {
    const record = error && typeof error === 'object' ? error as { message?: unknown } : null;
    const message = String((record && record.message) || error || '').trim();
    return message || 'Something went wrong.';
  }
  if (action && ACTION_COPY[action]) return ACTION_COPY[action];
  return "You don't have permission to do that.";
}
