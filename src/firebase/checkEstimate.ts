import { callFunction } from './callable';
import type { EstimateCheckPayload, EstimateCheckResult } from '../domain/estimateCheck';

export function isEstimateCheckUnavailable(error: unknown): boolean {
  const code = error && typeof error === 'object' ? String((error as { code?: string }).code || '') : '';
  return code === 'functions/not-found'
    || code === 'functions/unavailable'
    || code === 'functions/failed-precondition'
    || code === 'functions/internal'
    || code === 'internal';
}

export function friendlyEstimateCheckError(error: unknown): string {
  const code = error && typeof error === 'object' ? String((error as { code?: string }).code || '') : '';
  if (code === 'functions/unauthenticated') return 'Sign in again to run the AI check.';
  if (code === 'functions/permission-denied') return 'You are not on this organisation.';
  if (isEstimateCheckUnavailable(error)) {
    return 'AI check is not on this environment yet. You can still save after you have looked over the mapping.';
  }
  if (code === 'functions/deadline-exceeded') return 'The AI check timed out. Try again, or save after you have looked over the mapping.';
  return 'Could not run the AI check. You can still save after you have looked over the mapping.';
}

export async function checkEstimateImport(payload: EstimateCheckPayload): Promise<EstimateCheckResult> {
  const result = await callFunction('checkEstimateImport', payload, { timeout: 45000 });
  if (!result || typeof result !== 'object') {
    throw new Error('The AI check did not return a usable result.');
  }
  const data = result as EstimateCheckResult;
  return {
    ok: data.ok === true && (!data.warnings || data.warnings.length === 0),
    summary: String(data.summary || '').trim() || (data.ok ? 'Looks right.' : 'Have a look at these before saving.'),
    warnings: Array.isArray(data.warnings) ? data.warnings.map((item) => String(item)).filter(Boolean).slice(0, 8) : [],
  };
}
