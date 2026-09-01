export const JOB_KINDS = ['client', 'own'] as const;
export type JobKind = (typeof JOB_KINDS)[number];

export function normalizeJobKind(value: unknown): JobKind {
  return value === 'own' ? 'own' : 'client';
}

export function isJobKind(value: unknown): value is JobKind {
  return value === 'client' || value === 'own';
}
