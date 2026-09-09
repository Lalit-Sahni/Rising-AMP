import { jobFactsSchema, type JobFacts } from './jobFacts';
import {
  jobFactsUnconfirmedItem,
  jobFactsUnconfirmedTitle,
  withJobFactsAttention,
} from './jobFactsAttention';

const NOW = new Date('2026-09-09T00:00:00Z');

function provenance(source: 'owner' | 'import' | 'document' | 'assistant') {
  return {
    source,
    sourceRef: null as string | null,
    confirmedBy: null as string | null,
    confirmedAt: null as Date | null,
    updatedAt: NOW,
  };
}

const emptyFacts: JobFacts = {
  jobId: 'job-1',
  schemaVersion: 1,
  updatedAt: NOW,
};

describe('job facts attention overlay', () => {
  test('is silent when the count is 0', () => {
    expect(jobFactsUnconfirmedItem(null)).toBeNull();
    expect(jobFactsUnconfirmedItem(emptyFacts)).toBeNull();
    const metrics = withJobFactsAttention({
      attentionItems: [{ id: 'files-no-contract', page: 'files', title: 'No signed contract on this job', detail: '', action: 'Add files', tone: 'warn' }],
      attentionCount: 1,
    }, emptyFacts);
    expect(metrics.attentionCount).toBe(1);
    expect(metrics.attentionItems?.some((item) => item.id === 'job-facts-unconfirmed')).toBe(false);
  });

  test('adds one line when five details are unconfirmed, with grammar for 1 vs N', () => {
    expect(jobFactsUnconfirmedTitle(1)).toBe('1 job detail is unconfirmed.');
    expect(jobFactsUnconfirmedTitle(5)).toBe('5 job details are unconfirmed.');

    const five = jobFactsSchema.parse({
      ...emptyFacts,
      address: { value: '12 Kelly Street', ...provenance('import') },
      suburb: { value: 'South Wentworthville', ...provenance('import') },
      postcode: { value: '2145', ...provenance('import') },
      floorArea: { value: 167.22, unit: 'sqm' as const, ...provenance('import') },
      contractType: { value: 'HIA', ...provenance('document') },
    });
    const item = jobFactsUnconfirmedItem(five);
    expect(item).toEqual({
      id: 'job-facts-unconfirmed',
      page: 'dashboard',
      title: '5 job details are unconfirmed.',
      detail: 'Saved from a file or import. Confirm them on Overview.',
      action: 'Review',
      tone: 'neutral',
    });

    const one = jobFactsSchema.parse({
      ...emptyFacts,
      floorArea: { value: 167.22, unit: 'sqm' as const, ...provenance('import') },
    });
    expect(jobFactsUnconfirmedItem(one)?.title).toBe('1 job detail is unconfirmed.');

    const next = withJobFactsAttention({
      attentionItems: [],
      attentionCount: 0,
    }, five);
    expect(next.attentionCount).toBe(1);
    expect(next.attentionItems).toHaveLength(1);
  });
});
