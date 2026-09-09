/**
 * One "what needs you" line for unconfirmed job facts.
 * Silent when the count is 0 or there is no facts record.
 * Do not fold this into deriveJobMetrics.
 */
import { unconfirmedJobFactCount, type JobFacts } from './jobFacts';

export type JobFactsAttentionItem = {
  id: 'job-facts-unconfirmed';
  page: 'dashboard';
  title: string;
  detail: string;
  action: 'Review';
  tone: 'neutral';
};

export function jobFactsUnconfirmedTitle(count: number): string {
  if (count === 1) return '1 job detail is unconfirmed.';
  return `${count} job details are unconfirmed.`;
}

export function jobFactsUnconfirmedItem(
  facts: JobFacts | null | undefined,
): JobFactsAttentionItem | null {
  const count = unconfirmedJobFactCount(facts);
  if (count <= 0) return null;
  return {
    id: 'job-facts-unconfirmed',
    page: 'dashboard',
    title: jobFactsUnconfirmedTitle(count),
    detail: 'Saved from a file or import. Confirm them on Overview.',
    action: 'Review',
    tone: 'neutral',
  };
}

export function withJobFactsAttention<T extends {
  attentionItems?: Array<{ id: string; page: string; title: string; detail: string; action: string; tone: string }>;
  attentionCount?: number;
}>(
  metrics: T,
  facts: JobFacts | null | undefined,
): T {
  const extra = jobFactsUnconfirmedItem(facts);
  if (!metrics || !extra) return metrics;
  const attentionItems = [...(metrics.attentionItems || []), extra];
  return {
    ...metrics,
    attentionItems,
    attentionCount: attentionItems.length,
  };
}
