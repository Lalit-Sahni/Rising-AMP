/**
 * Tier evals. The code assigns the tier; the model never does.
 * An inferred field never reaches do.
 */
import { assignTier, NEVER_ACTIONS, type ActionTier, type FieldEvidence } from './core';
import { codeExpense } from './codeExpense';
import { createExpense } from './createExpense';
import { decideFileExpense } from './fileExpense';
import { proposeTrades } from './proposeTrades';
import { createMemoryActionStore } from './store';

const SCOPE = { orgId: 'opal-ss-constructions', allowedJobIds: ['job-a', 'job-b'] };

const TRADES = [
  { id: 'concreting', name: 'Concreting' },
  { id: 'plumbing', name: 'Plumbing' },
  { id: 'electrical', name: 'Electrical' },
];
const SECTIONS = [
  { id: 'concreting', name: 'Concreting' },
  { id: 'electrical', name: 'Electrical' },
];

function evidence(fields: Record<string, FieldEvidence>): Record<string, FieldEvidence> {
  return fields;
}

const ASSIGN_CASES: Array<{
  id: string;
  action: string;
  evidence: Record<string, FieldEvidence>;
  never?: boolean;
  expected: ActionTier;
}> = [
  {
    id: 'codeExpense-user-do',
    action: 'codeExpense',
    evidence: evidence({ tradeId: { source: 'user', value: 'concreting' } }),
    expected: 'do',
  },
  {
    id: 'codeExpense-record-do',
    action: 'codeExpense',
    evidence: evidence({ tradeId: { source: 'record', value: 'plumbing' } }),
    expected: 'do',
  },
  {
    id: 'codeExpense-ocr-do',
    action: 'codeExpense',
    evidence: evidence({ tradeId: { source: 'ocr', value: 'carpentry' } }),
    expected: 'do',
  },
  {
    id: 'codeExpense-inferred-propose',
    action: 'codeExpense',
    evidence: evidence({ tradeId: { source: 'inferred', value: 'concreting' } }),
    expected: 'propose',
  },
  {
    id: 'codeExpense-mixed-inferred-propose',
    action: 'codeExpense',
    evidence: evidence({
      tradeId: { source: 'user', value: 'concreting' },
      note: { source: 'inferred', value: 'maybe' },
    }),
    expected: 'propose',
  },
  {
    id: 'codeExpense-empty-propose',
    action: 'codeExpense',
    evidence: {},
    expected: 'propose',
  },
  {
    id: 'createExpense-direct-do',
    action: 'createExpense',
    evidence: evidence({
      date: { source: 'ocr', value: '2026-08-14' },
      amount: { source: 'ocr', value: '12450' },
      party: { source: 'record', value: 'party-1' },
    }),
    expected: 'do',
  },
  {
    id: 'createExpense-date-inferred',
    action: 'createExpense',
    evidence: evidence({
      date: { source: 'inferred', value: null },
      amount: { source: 'ocr', value: '12450' },
      party: { source: 'record', value: 'party-1' },
    }),
    expected: 'propose',
  },
  {
    id: 'createExpense-amount-inferred',
    action: 'createExpense',
    evidence: evidence({
      date: { source: 'ocr', value: '2026-08-14' },
      amount: { source: 'inferred', value: null },
      party: { source: 'record', value: 'party-1' },
    }),
    expected: 'propose',
  },
  {
    id: 'createExpense-party-inferred',
    action: 'createExpense',
    evidence: evidence({
      date: { source: 'ocr', value: '2026-08-14' },
      amount: { source: 'ocr', value: '12450' },
      party: { source: 'inferred', value: 'create' },
    }),
    expected: 'propose',
  },
  {
    id: 'createExpense-gst-inferred',
    action: 'createExpense',
    evidence: evidence({
      date: { source: 'ocr', value: '2026-08-14' },
      amount: { source: 'ocr', value: '11000' },
      party: { source: 'record', value: 'party-1' },
      gst: { source: 'inferred', value: '1000' },
    }),
    expected: 'propose',
  },
  {
    id: 'createExpense-empty',
    action: 'createExpense',
    evidence: {},
    expected: 'propose',
  },
  {
    id: 'createExpense-unknown-name-inferred',
    action: 'createExpense',
    evidence: evidence({
      date: { source: 'ocr', value: '2026-08-14' },
      amount: { source: 'ocr', value: '5000' },
      party: { source: 'inferred', value: 'Mystery Pty' },
    }),
    expected: 'propose',
  },
  {
    id: 'codeExpenseBatch-user-do',
    action: 'codeExpenseBatch',
    evidence: evidence({ batch: { source: 'user', value: '2' } }),
    expected: 'do',
  },
  {
    id: 'codeExpenseBatch-record-do',
    action: 'codeExpenseBatch',
    evidence: evidence({ batch: { source: 'record', value: '2' } }),
    expected: 'do',
  },
  {
    id: 'codeExpenseBatch-inferred',
    action: 'codeExpenseBatch',
    evidence: evidence({ batch: { source: 'inferred', value: '0' } }),
    expected: 'propose',
  },
  {
    id: 'codeExpenseBatch-empty',
    action: 'codeExpenseBatch',
    evidence: {},
    expected: 'propose',
  },
  {
    id: 'undoAction-user-do',
    action: 'undoAction',
    evidence: evidence({ receiptId: { source: 'user', value: 'r1' } }),
    expected: 'do',
  },
  {
    id: 'undoAction-empty',
    action: 'undoAction',
    evidence: {},
    expected: 'propose',
  },
  {
    id: 'undoAction-inferred',
    action: 'undoAction',
    evidence: evidence({ receiptId: { source: 'inferred', value: 'r1' } }),
    expected: 'propose',
  },
  {
    id: 'never-sendEmail',
    action: 'sendEmail',
    evidence: evidence({ to: { source: 'user', value: 'a@b.c' } }),
    expected: 'refuse',
  },
  {
    id: 'never-allocateInvoiceNumber',
    action: 'allocateInvoiceNumber',
    evidence: evidence({ jobId: { source: 'user', value: 'job-a' } }),
    expected: 'refuse',
  },
  {
    id: 'never-invitePerson',
    action: 'invitePerson',
    evidence: evidence({ email: { source: 'user', value: 'sam@x' } }),
    expected: 'refuse',
  },
  {
    id: 'never-flag',
    action: 'codeExpense',
    evidence: evidence({ tradeId: { source: 'user', value: 'concreting' } }),
    never: true,
    expected: 'refuse',
  },
  {
    id: 'unknown-action',
    action: 'inventedAction',
    evidence: evidence({ tradeId: { source: 'user', value: 'concreting' } }),
    expected: 'refuse',
  },
];

function bunningOcr(overrides: Record<string, unknown> = {}) {
  return {
    vendor: 'Bunnings',
    date: '2026-08-14',
    totalAmount: 124.5,
    tax: 12.45,
    items: [{ description: 'Timber', quantity: 1, unitPrice: 124.5, totalPrice: 124.5 }],
    category: 'purchase',
    ...overrides,
  };
}

describe('tier evals — assignTier', () => {
  test.each(ASSIGN_CASES)('$id → $expected', ({ action, evidence: fields, never, expected }) => {
    expect(assignTier({ action, evidence: fields, never })).toBe(expected);
  });

  test('every NEVER name refuses even with direct evidence', () => {
    NEVER_ACTIONS.forEach((action) => {
      expect(assignTier({
        action,
        evidence: { anything: { source: 'user', value: 'yes' } },
      })).toBe('refuse');
    });
  });
});

describe('tier evals — decideFileExpense', () => {
  test('clean OCR plus exact party is do', () => {
    const result = decideFileExpense({
      extractedData: bunningOcr(),
      warnings: [],
      category: 'purchase',
      partyMatch: 'use',
      partyId: 'party-bunnings',
    });
    expect(result.tier).toBe('do');
  });

  test('inferred date never reaches do', () => {
    const result = decideFileExpense({
      extractedData: bunningOcr({ date: null }),
      warnings: ['Date could not be read from the receipt'],
      category: 'purchase',
      partyMatch: 'use',
      partyId: 'party-bunnings',
    });
    expect(result.tier).toBe('propose');
    expect(result.evidence.date.source).toBe('inferred');
  });

  test('inferred amount never reaches do', () => {
    const result = decideFileExpense({
      extractedData: bunningOcr({
        items: [{ totalPrice: 50 }, { totalPrice: 50 }],
      }),
      warnings: [],
      category: 'purchase',
      partyMatch: 'use',
      partyId: 'party-bunnings',
    });
    expect(result.tier).toBe('propose');
    expect(result.evidence.amount.source).toBe('inferred');
  });

  test('inferred party never reaches do', () => {
    const result = decideFileExpense({
      extractedData: bunningOcr(),
      warnings: [],
      category: 'purchase',
      partyMatch: 'create',
    });
    expect(result.tier).toBe('propose');
    expect(result.partyId).toBeUndefined();
    expect(result.evidence.party.source).toBe('inferred');
  });

  test('unknown vendor name is propose', () => {
    const result = decideFileExpense({
      extractedData: bunningOcr({ vendor: 'Mystery Pty' }),
      warnings: [],
      category: 'purchase',
      partyMatch: 'none',
    });
    expect(result.tier).toBe('propose');
    expect(result.partyId).toBeUndefined();
  });

  test('empty evidence / missing amount is propose', () => {
    const result = decideFileExpense({
      extractedData: { vendor: 'Bunnings' },
      warnings: [],
      category: 'purchase',
      partyMatch: 'use',
      partyId: 'party-bunnings',
    });
    expect(result.tier).toBe('propose');
    expect(result.evidence.amount.source).toBe('inferred');
  });

  test('unstated GST still does when the rest is direct', () => {
    const result = decideFileExpense({
      extractedData: bunningOcr({ tax: '' }),
      warnings: [],
      category: 'purchase',
      partyMatch: 'use',
      partyId: 'party-bunnings',
    });
    expect(result.tier).toBe('do');
    expect(result.gstCents).toBeUndefined();
  });
});

describe('tier evals — proposeTrades feeds assignTier', () => {
  test('section keyword is inferred and never reaches do', () => {
    const [row] = proposeTrades({
      uncoded: [{ id: 'e-pump', description: 'concrete pump' }],
      orgCoded: [],
      trades: TRADES,
      sections: SECTIONS,
    });
    expect(row.source).toBe('inferred');
    expect(assignTier({
      action: 'codeExpense',
      evidence: { tradeId: { source: row.source || 'inferred', value: row.proposedTradeId } },
    })).toBe('propose');
  });

  test('party history is record and may reach do', () => {
    const orgCoded = Array.from({ length: 3 }, (_, index) => ({
      id: `coded-${index}`,
      partyId: 'party-bunnings',
      tradeId: 'concreting',
      status: 'active',
    }));
    const [row] = proposeTrades({
      uncoded: [{ id: 'e-new', partyId: 'party-bunnings' }],
      orgCoded,
      trades: TRADES,
      sections: SECTIONS,
    });
    expect(row.source).toBe('record');
    expect(assignTier({
      action: 'codeExpense',
      evidence: { tradeId: { source: 'record', value: row.proposedTradeId } },
    })).toBe('do');
  });

  test('no evidence stays uncoded, not do', () => {
    const [row] = proposeTrades({
      uncoded: [{ id: 'e-none', description: 'mystery box' }],
      orgCoded: [],
      trades: TRADES,
      sections: SECTIONS,
    });
    expect(row.status).toBe('none');
    expect(assignTier({
      action: 'codeExpense',
      evidence: {},
    })).toBe('propose');
  });
});

describe('tier evals — codeExpense / createExpense', () => {
  test('inferred tradeId proposes and does not write', async () => {
    const store = createMemoryActionStore();
    store.seedExpense(SCOPE.orgId, { id: 'exp-1', jobId: 'job-a', tradeId: null });
    const result = await codeExpense({
      scope: SCOPE,
      jobId: 'job-a',
      expenseId: 'exp-1',
      tradeId: 'concreting',
      clientKey: 'tier-code-inferred',
      origin: 'human',
      evidence: { tradeId: { source: 'inferred', value: 'concreting' } },
    }, store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipt.tier).toBe('propose');
    expect(store.expenseWriteCount).toBe(0);
  });

  test('direct user evidence reaches do', async () => {
    const store = createMemoryActionStore();
    store.seedExpense(SCOPE.orgId, { id: 'exp-1', jobId: 'job-a', tradeId: null });
    const result = await codeExpense({
      scope: SCOPE,
      jobId: 'job-a',
      expenseId: 'exp-1',
      tradeId: 'concreting',
      clientKey: 'tier-code-userxxxx',
      origin: 'human',
      evidence: { tradeId: { source: 'user', value: 'concreting' } },
    }, store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipt.tier).toBe('do');
  });

  test('inferred GST never reaches do', async () => {
    const store = createMemoryActionStore();
    const result = await createExpense({
      scope: SCOPE,
      jobId: 'job-a',
      clientKey: 'tier-gst-inferredx',
      origin: 'assistant',
      category: 'purchase',
      total: 110,
      partyId: 'party-1',
      evidence: {
        date: { source: 'ocr', value: '2026-08-14' },
        amount: { source: 'ocr', value: '11000' },
        party: { source: 'record', value: 'party-1' },
        gst: { source: 'inferred', value: '1000' },
      },
      gstCents: 1000,
    }, store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipt.tier).toBe('propose');
    expect(store.expenseWriteCount).toBe(0);
  });

  test('inferred party never reaches do', async () => {
    const store = createMemoryActionStore();
    const result = await createExpense({
      scope: SCOPE,
      jobId: 'job-a',
      clientKey: 'tier-party-inferrx',
      origin: 'assistant',
      category: 'purchase',
      total: 50,
      evidence: {
        date: { source: 'ocr', value: '2026-08-14' },
        amount: { source: 'ocr', value: '5000' },
        party: { source: 'inferred', value: 'create' },
      },
    }, store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipt.tier).toBe('propose');
    expect(store.expenseWriteCount).toBe(0);
  });

  test('direct OCR plus record party reaches do', async () => {
    const store = createMemoryActionStore();
    const result = await createExpense({
      scope: SCOPE,
      jobId: 'job-a',
      clientKey: 'tier-create-doxxxx',
      origin: 'assistant',
      category: 'purchase',
      date: '2026-08-14',
      total: 124.5,
      partyId: 'party-bunnings',
      evidence: {
        date: { source: 'ocr', value: '2026-08-14' },
        amount: { source: 'ocr', value: '12450' },
        party: { source: 'record', value: 'party-bunnings' },
      },
    }, store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipt.tier).toBe('do');
  });
});

describe('tier eval count', () => {
  test('at least 30 cases', () => {
    const assignCount = ASSIGN_CASES.length + NEVER_ACTIONS.length;
    const fileCount = 7;
    const proposeCount = 3;
    const actionCount = 5;
    expect(assignCount + fileCount + proposeCount + actionCount).toBeGreaterThanOrEqual(30);
  });
});
