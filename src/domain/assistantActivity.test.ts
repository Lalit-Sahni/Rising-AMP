import {
  ACTIVITY_LIST_LIMIT,
  activityEvidenceSummary,
  activityReceiptsForView,
  assistantDailyLineCopy,
  assistantDailyLineItem,
  assistantHistoryMarker,
  assistantYesterdayCounts,
  sortReceiptsNewestFirst,
  unconfirmedAssistantScanCount,
  withAssistantDailyLine,
} from './assistantActivity';

const now = new Date(2026, 8, 8, 10, 0, 0); // 8 Sep 2026 local

function receipt(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    jobId: 'job-a',
    action: 'createExpense',
    status: 'applied',
    createdAt: new Date(2026, 8, 7, 15, 0, 0),
    evidence: {
      party: { source: 'ocr', value: 'Bunnings' },
      amount: { source: 'ocr', value: '124.50' },
      date: { source: 'ocr', value: '2026-09-07' },
    },
    ...overrides,
  };
}

describe('activity list helper', () => {
  test('sorts newest first', () => {
    const rows = activityReceiptsForView([
      receipt({ id: 'old', createdAt: new Date(2026, 8, 6, 9, 0, 0) }),
      receipt({ id: 'new', createdAt: new Date(2026, 8, 7, 18, 0, 0) }),
      receipt({ id: 'mid', createdAt: new Date(2026, 8, 7, 8, 0, 0) }),
    ]);
    expect(rows.map((row) => row.id)).toEqual(['new', 'mid', 'old']);
  });

  test('keeps applied, proposed and undone, and drops refused', () => {
    const rows = activityReceiptsForView([
      receipt({ id: 'applied', status: 'applied' }),
      receipt({ id: 'proposed', status: 'proposed', action: 'codeExpense' }),
      receipt({ id: 'undone', status: 'undone' }),
      receipt({ id: 'refused', status: 'refused' }),
    ]);
    expect(rows.map((row) => row.id).sort()).toEqual(['applied', 'proposed', 'undone']);
  });

  test('caps at 50 after sorting newest first', () => {
    const rows = Array.from({ length: 60 }, (_, i) => receipt({
      id: `r-${String(i).padStart(2, '0')}`,
      createdAt: new Date(2026, 8, 1, 0, i, 0),
    }));
    const listed = activityReceiptsForView(rows);
    expect(listed).toHaveLength(ACTIVITY_LIST_LIMIT);
    expect(listed[0].id).toBe('r-59');
    expect(listed[49].id).toBe('r-10');
  });

  test('sortReceiptsNewestFirst is stable on equal times by id', () => {
    const when = new Date(2026, 8, 7, 12, 0, 0);
    const rows = sortReceiptsNewestFirst([
      receipt({ id: 'a', createdAt: when }),
      receipt({ id: 'b', createdAt: when }),
    ]);
    expect(rows.map((row) => row.id)).toEqual(['b', 'a']);
  });

  test('evidence summary is a quiet line', () => {
    expect(activityEvidenceSummary(receipt())).toBe('Bunnings · 124.50 · 2026-09-07');
    expect(activityEvidenceSummary(receipt({
      action: 'codeExpense',
      evidence: { tradeId: { source: 'record', value: 'concreting' } },
    }))).toBe('concreting (record)');
  });
});

describe('History marker helper', () => {
  test('marks an assistant row until confirmed, and stays quiet after', () => {
    expect(assistantHistoryMarker({
      source: 'assistant',
      assistantConfirmed: false,
    })).toEqual({ show: true, label: 'Check' });
    expect(assistantHistoryMarker({
      source: 'assistant',
    }).show).toBe(true);
    expect(assistantHistoryMarker({
      source: 'assistant',
      assistantConfirmed: true,
    }).show).toBe(false);
    expect(assistantHistoryMarker({
      source: 'assistant',
      assistantConfirmed: false,
      status: 'void',
    }).show).toBe(false);
    expect(assistantHistoryMarker({ source: 'typed' }).show).toBe(false);
    expect(assistantHistoryMarker(null).show).toBe(false);
  });
});

describe('daily line copy', () => {
  test('uses the brief wording', () => {
    expect(assistantDailyLineCopy(4, 11, 2)).toBe(
      'The assistant added 4 expenses and coded 11 yesterday. 2 need a look.',
    );
  });

  test('singular grammar, and omits when yesterday is zero', () => {
    expect(assistantDailyLineCopy(1, 1, 1)).toBe(
      'The assistant added 1 expense and coded 1 yesterday. 1 needs a look.',
    );
    expect(assistantDailyLineCopy(0, 0, 3)).toBeNull();
    expect(assistantDailyLineCopy(3, 0, 0)).toBe(
      'The assistant added 3 expenses yesterday.',
    );
    expect(assistantDailyLineCopy(0, 11, 2)).toBe(
      'The assistant coded 11 yesterday. 2 need a look.',
    );
  });

  test('counts applied create and code from yesterday on this job, local calendar', () => {
    const counts = assistantYesterdayCounts([
      receipt({ id: 'add', action: 'createExpense', status: 'applied' }),
      receipt({ id: 'code', action: 'codeExpense', status: 'applied' }),
      receipt({
        id: 'batch',
        action: 'codeExpenseBatch',
        status: 'applied',
        documentIds: { expenseIds: ['e1', 'e2'] },
      }),
      receipt({
        id: 'today',
        action: 'createExpense',
        createdAt: new Date(2026, 8, 8, 9, 0, 0),
      }),
      receipt({ id: 'other-job', jobId: 'job-b', action: 'createExpense' }),
      receipt({ id: 'undone', action: 'createExpense', status: 'undone' }),
      receipt({ id: 'proposed', action: 'createExpense', status: 'proposed' }),
    ], 'job-a', now);
    expect(counts).toEqual({ added: 1, coded: 1 });
  });

  test('omits the daily line when yesterday is quiet, even if scans still need a look', () => {
    const item = assistantDailyLineItem({
      receipts: [receipt({ createdAt: new Date(2026, 8, 8, 9, 0, 0) })],
      jobId: 'job-a',
      expenses: [{ source: 'assistant', assistantConfirmed: false }],
      now,
    });
    expect(item).toBeNull();
    expect(unconfirmedAssistantScanCount([
      { source: 'assistant', assistantConfirmed: false },
      { source: 'assistant', assistantConfirmed: false, status: 'void' },
    ])).toBe(1);
  });

  test('prepends the daily line onto what needs you', () => {
    const metrics = withAssistantDailyLine(
      {
        attentionItems: [{
          id: 'expenses-assistant-unconfirmed',
          page: 'history',
          title: '1 expense added by scan, not yet checked',
          detail: 'Filed from a receipt.',
          action: 'Review',
          tone: 'neutral',
        }],
        attentionCount: 1,
      },
      {
        receipts: [
          receipt({ id: 'add', action: 'createExpense' }),
          receipt({ id: 'code', action: 'codeExpense' }),
        ],
        jobId: 'job-a',
        expenses: [{ source: 'assistant', assistantConfirmed: false }],
        now,
      },
    );
    expect(metrics.attentionCount).toBe(2);
    expect(metrics.attentionItems?.[0].id).toBe('assistant-yesterday');
    expect(metrics.attentionItems?.[0].page).toBe('assistant-activity');
    expect(metrics.attentionItems?.[0].title).toBe(
      'The assistant added 1 expense and coded 1 yesterday. 1 needs a look.',
    );
    expect(metrics.attentionItems?.[1].id).toBe('expenses-assistant-unconfirmed');
  });
});
