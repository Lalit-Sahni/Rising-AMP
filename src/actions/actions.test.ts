import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTION_NAMES, NEVER_ACTIONS, assignTier } from './core';
import { codeExpense } from './codeExpense';
import { createExpense } from './createExpense';
import { runAction } from './registry';
import { createMemoryActionStore } from './store';
import { undoAction } from './undo';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function read(relative: string) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

const SCOPE = { orgId: 'opal-ss-constructions', allowedJobIds: ['job-a', 'job-b'] };
const CLIENT_KEY = 'client-key-code-1';

function seededStore(tradeId: string | null = null) {
  const store = createMemoryActionStore();
  store.seedExpense(SCOPE.orgId, {
    id: 'exp-1',
    jobId: 'job-a',
    tradeId,
  });
  return store;
}

describe('assignTier', () => {
  test('direct user evidence reaches do', () => {
    expect(assignTier({
      action: 'codeExpense',
      evidence: { tradeId: { source: 'user', value: 'concreting' } },
    })).toBe('do');
  });

  test('record and ocr evidence reach do', () => {
    expect(assignTier({
      action: 'codeExpense',
      evidence: { tradeId: { source: 'record', value: 'plumbing' } },
    })).toBe('do');
    expect(assignTier({
      action: 'codeExpense',
      evidence: { tradeId: { source: 'ocr', value: 'carpentry' } },
    })).toBe('do');
  });

  test('inferred evidence never reaches do', () => {
    expect(assignTier({
      action: 'codeExpense',
      evidence: { tradeId: { source: 'inferred', value: 'concreting' } },
    })).toBe('propose');
  });

  test('mixed inferred and user evidence is propose', () => {
    expect(assignTier({
      action: 'codeExpense',
      evidence: {
        tradeId: { source: 'user', value: 'concreting' },
        note: { source: 'inferred', value: 'maybe' },
      },
    })).toBe('propose');
  });

  test('never list and unknown names refuse', () => {
    expect(assignTier({
      action: 'sendEmail',
      evidence: { to: { source: 'user', value: 'a@b.c' } },
    })).toBe('refuse');
    expect(assignTier({
      action: 'inventedAction',
      evidence: { tradeId: { source: 'user', value: 'concreting' } },
    })).toBe('refuse');
    expect(assignTier({
      action: 'codeExpense',
      evidence: { tradeId: { source: 'user', value: 'concreting' } },
      never: true,
    })).toBe('refuse');
  });
});

describe('codeExpense', () => {
  test('a job that is not on the invited list does not write', async () => {
    const store = seededStore();
    const result = await codeExpense({
      scope: SCOPE,
      jobId: 'phase8-isolation',
      expenseId: 'exp-1',
      tradeId: 'concreting',
      clientKey: CLIENT_KEY,
      origin: 'human',
      evidence: { tradeId: { source: 'user', value: 'concreting' } },
    }, store);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('job_not_allowed');
    expect(store.expenseWriteCount).toBe(0);
    expect(store.receiptWriteCount).toBe(0);
    const expense = await store.getExpense(SCOPE.orgId, 'job-a', 'exp-1');
    expect(expense?.tradeId).toBe(null);
  });

  test('inferred tradeId proposes and leaves the expense unchanged', async () => {
    const store = seededStore();
    const result = await codeExpense({
      scope: SCOPE,
      jobId: 'job-a',
      expenseId: 'exp-1',
      tradeId: 'concreting',
      clientKey: CLIENT_KEY,
      origin: 'human',
      evidence: { tradeId: { source: 'inferred', value: 'concreting' } },
    }, store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipt.tier).toBe('propose');
    expect(result.receipt.status).toBe('proposed');
    expect(result.receipt.undo.kind).toBe('none');
    expect(store.expenseWriteCount).toBe(0);
    const expense = await store.getExpense(SCOPE.orgId, 'job-a', 'exp-1');
    expect(expense?.tradeId).toBe(null);
    expect(expense?.source).toBeUndefined();
  });

  test('direct user evidence codes the expense and stores undo', async () => {
    const store = seededStore();
    const result = await codeExpense({
      scope: SCOPE,
      jobId: 'job-a',
      expenseId: 'exp-1',
      tradeId: 'concreting',
      clientKey: CLIENT_KEY,
      origin: 'human',
      evidence: { tradeId: { source: 'user', value: 'concreting' } },
    }, store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipt.tier).toBe('do');
    expect(result.receipt.status).toBe('applied');
    expect(result.receipt.source).toBe('assistant');
    expect(result.receipt.undo).toEqual({
      kind: 'restoreTradeId',
      expenseId: 'exp-1',
      previousTradeId: null,
    });
    expect(result.receipt.changed?.tradeId).toEqual({ from: null, to: 'concreting' });
    const expense = await store.getExpense(SCOPE.orgId, 'job-a', 'exp-1');
    expect(expense?.tradeId).toBe('concreting');
    expect(expense?.source).toBe('assistant');
    expect(expense?.assistantReceiptId).toBe(result.receipt.id);
    expect(JSON.stringify(result)).not.toMatch(/cents|amountCents|"total"/);
  });

  test('record evidence may recode a single already-coded row', async () => {
    const store = seededStore('plumbing');
    const result = await codeExpense({
      scope: SCOPE,
      jobId: 'job-a',
      expenseId: 'exp-1',
      tradeId: 'concreting',
      clientKey: 'client-key-recode-1',
      origin: 'human',
      evidence: { tradeId: { source: 'record', value: 'concreting' } },
    }, store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipt.undo).toEqual({
      kind: 'restoreTradeId',
      expenseId: 'exp-1',
      previousTradeId: 'plumbing',
    });
    const expense = await store.getExpense(SCOPE.orgId, 'job-a', 'exp-1');
    expect(expense?.tradeId).toBe('concreting');
  });

  test('the same clientKey writes once and returns the original receipt', async () => {
    const store = seededStore();
    const first = await codeExpense({
      scope: SCOPE,
      jobId: 'job-a',
      expenseId: 'exp-1',
      tradeId: 'concreting',
      clientKey: CLIENT_KEY,
      origin: 'human',
      evidence: { tradeId: { source: 'user', value: 'concreting' } },
    }, store);
    const second = await codeExpense({
      scope: SCOPE,
      jobId: 'job-a',
      expenseId: 'exp-1',
      tradeId: 'carpentry',
      clientKey: CLIENT_KEY,
      origin: 'human',
      evidence: { tradeId: { source: 'user', value: 'carpentry' } },
    }, store);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.receipt.id).toBe(first.receipt.id);
    expect(second.receipt.changed?.tradeId?.to).toBe('concreting');
    expect(store.expenseWriteCount).toBe(1);
    expect(store.receiptWriteCount).toBe(1);
    const expense = await store.getExpense(SCOPE.orgId, 'job-a', 'exp-1');
    expect(expense?.tradeId).toBe('concreting');
  });

  test('rejects money fields on the input', async () => {
    const store = seededStore();
    const result = await codeExpense({
      scope: SCOPE,
      jobId: 'job-a',
      expenseId: 'exp-1',
      tradeId: 'concreting',
      clientKey: CLIENT_KEY,
      origin: 'human',
      cents: 12450,
      evidence: { tradeId: { source: 'user', value: 'concreting' } },
    }, store);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('invalid_input');
    expect(store.expenseWriteCount).toBe(0);
  });
});

describe('undoAction', () => {
  test('restores a previous null tradeId, and a second undo is a no-op', async () => {
    const store = seededStore();
    const coded = await codeExpense({
      scope: SCOPE,
      jobId: 'job-a',
      expenseId: 'exp-1',
      tradeId: 'concreting',
      clientKey: CLIENT_KEY,
      origin: 'human',
      evidence: { tradeId: { source: 'user', value: 'concreting' } },
    }, store);
    expect(coded.ok).toBe(true);
    if (!coded.ok) return;
    const first = await undoAction({
      scope: SCOPE,
      receiptId: coded.receipt.id,
      clientKey: 'undo-key-1xxxx',
    }, store);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.receipt.status).toBe('undone');
    const afterUndo = await store.getExpense(SCOPE.orgId, 'job-a', 'exp-1');
    expect(afterUndo?.tradeId).toBe(null);
    expect(afterUndo?.source).toBeUndefined();
    expect(afterUndo?.assistantReceiptId).toBeUndefined();
    const writesAfterFirst = store.expenseWriteCount;
    const second = await undoAction({
      scope: SCOPE,
      receiptId: coded.receipt.id,
      clientKey: 'undo-key-2xxxx',
    }, store);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.receipt.status).toBe('undone');
    expect(store.expenseWriteCount).toBe(writesAfterFirst);
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'exp-1'))?.tradeId).toBe(null);
  });

  test('restores a previous coded tradeId', async () => {
    const store = seededStore('plumbing');
    const coded = await codeExpense({
      scope: SCOPE,
      jobId: 'job-a',
      expenseId: 'exp-1',
      tradeId: 'concreting',
      clientKey: 'client-key-undo-prev',
      origin: 'human',
      evidence: { tradeId: { source: 'record', value: 'concreting' } },
    }, store);
    expect(coded.ok).toBe(true);
    if (!coded.ok) return;
    const undone = await undoAction({
      scope: SCOPE,
      receiptId: coded.receipt.id,
      clientKey: 'undo-key-prev-1',
    }, store);
    expect(undone.ok).toBe(true);
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'exp-1'))?.tradeId).toBe('plumbing');
    const restored = await store.getExpense(SCOPE.orgId, 'job-a', 'exp-1');
    expect(restored?.source).toBeUndefined();
    expect(restored?.assistantReceiptId).toBeUndefined();
  });

  test('a receipt on a job that is not invited does not undo', async () => {
    const store = seededStore();
    const coded = await codeExpense({
      scope: SCOPE,
      jobId: 'job-a',
      expenseId: 'exp-1',
      tradeId: 'concreting',
      clientKey: 'client-key-undo-scope',
      origin: 'human',
      evidence: { tradeId: { source: 'user', value: 'concreting' } },
    }, store);
    expect(coded.ok).toBe(true);
    if (!coded.ok) return;
    const writes = store.expenseWriteCount;
    const result = await undoAction({
      scope: { orgId: SCOPE.orgId, allowedJobIds: ['job-b'] },
      receiptId: coded.receipt.id,
      clientKey: 'undo-key-scope-1',
    }, store);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('job_not_allowed');
    expect(store.expenseWriteCount).toBe(writes);
    const expense = await store.getExpense(SCOPE.orgId, 'job-a', 'exp-1');
    expect(expense?.tradeId).toBe('concreting');
    expect(expense?.source).toBe('assistant');
  });

  test('undo still works from a stored receipt shape after reload', async () => {
    const store = seededStore();
    const coded = await codeExpense({
      scope: SCOPE,
      jobId: 'job-a',
      expenseId: 'exp-1',
      tradeId: 'concreting',
      clientKey: 'client-key-stored-undo',
      origin: 'human',
      evidence: { tradeId: { source: 'user', value: 'concreting' } },
    }, store);
    expect(coded.ok).toBe(true);
    if (!coded.ok) return;
    const serialized = JSON.parse(JSON.stringify({
      ...coded.receipt,
      createdAt: coded.receipt.createdAt.toISOString(),
    }));
    const afterReload = createMemoryActionStore();
    afterReload.seedExpense(SCOPE.orgId, {
      id: 'exp-1',
      jobId: 'job-a',
      tradeId: 'concreting',
      source: 'assistant',
      assistantReceiptId: serialized.id,
    });
    await afterReload.putReceipt({
      ...serialized,
      createdAt: new Date(serialized.createdAt),
    });
    const undone = await undoAction({
      scope: SCOPE,
      receiptId: serialized.id,
      clientKey: 'undo-after-reload-1',
    }, afterReload);
    expect(undone.ok).toBe(true);
    if (!undone.ok) return;
    expect(undone.receipt.status).toBe('undone');
    const expense = await afterReload.getExpense(SCOPE.orgId, 'job-a', 'exp-1');
    expect(expense?.tradeId).toBe(null);
    expect(expense?.source).toBeUndefined();
    expect(expense?.assistantReceiptId).toBeUndefined();
  });
});

describe('createExpense', () => {
  const CREATE_KEY = 'client-key-create-1';

  function createInput(overrides: Record<string, unknown> = {}) {
    return {
      scope: SCOPE,
      jobId: 'job-a',
      clientKey: CREATE_KEY,
      origin: 'assistant',
      id: 'exp-new',
      category: 'purchase',
      date: '2026-08-14',
      supplier: 'Bunnings',
      unitCost: 124.5,
      quantity: 1,
      total: 124.5,
      partyId: 'party-bunnings',
      evidence: {
        date: { source: 'ocr', value: '2026-08-14' },
        amount: { source: 'ocr', value: '12450' },
        party: { source: 'record', value: 'party-bunnings' },
      },
      ...overrides,
    };
  }

  test('a job that is not on the invited list does not write', async () => {
    const store = createMemoryActionStore();
    const result = await createExpense(createInput({ jobId: 'phase8-isolation' }), store);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('job_not_allowed');
    expect(store.expenseWriteCount).toBe(0);
    expect(store.receiptWriteCount).toBe(0);
  });

  test('direct OCR plus an exact party writes an uncoded live expense', async () => {
    const store = createMemoryActionStore();
    const result = await createExpense(createInput({ gstCents: 1245, evidence: {
      date: { source: 'ocr', value: '2026-08-14' },
      amount: { source: 'ocr', value: '12450' },
      party: { source: 'record', value: 'party-bunnings' },
      gst: { source: 'ocr', value: '1245' },
    } }), store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipt.tier).toBe('do');
    expect(result.receipt.status).toBe('applied');
    expect(result.receipt.action).toBe('createExpense');
    expect(result.receipt.undo).toEqual({ kind: 'voidExpense', expenseId: 'exp-new' });
    const expense = await store.getExpense(SCOPE.orgId, 'job-a', 'exp-new');
    expect(expense?.tradeId).toBe(null);
    expect(expense?.source).toBe('assistant');
    expect(expense?.assistantConfirmed).toBe(false);
    expect(expense?.assistantReceiptId).toBe(result.receipt.id);
    expect(expense?.gstCents).toBe(1245);
    expect(expense?.partyId).toBe('party-bunnings');
    expect(expense?.reviewed).toBeUndefined();
    expect(expense?.status).not.toBe('void');
  });

  test('unstated GST is omitted', async () => {
    const store = createMemoryActionStore();
    const result = await createExpense(createInput(), store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipt.tier).toBe('do');
    const expense = await store.getExpense(SCOPE.orgId, 'job-a', 'exp-new');
    expect(expense?.gstCents).toBeUndefined();
  });

  test('inferred GST is not stored', async () => {
    const store = createMemoryActionStore();
    const result = await createExpense(createInput({
      gstCents: 1000,
      evidence: {
        date: { source: 'ocr', value: '2026-08-14' },
        amount: { source: 'ocr', value: '11000' },
        party: { source: 'record', value: 'party-bunnings' },
        gst: { source: 'inferred', value: '1000' },
      },
    }), store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipt.tier).toBe('propose');
    expect(store.expenseWriteCount).toBe(0);
    expect(await store.getExpense(SCOPE.orgId, 'job-a', 'exp-new')).toBe(null);
  });

  test('unknown vendor proposes and does not write the ledger', async () => {
    const store = createMemoryActionStore();
    const result = await createExpense(createInput({
      partyId: undefined,
      evidence: {
        date: { source: 'ocr', value: '2026-08-14' },
        amount: { source: 'ocr', value: '12450' },
        party: { source: 'inferred', value: 'create' },
      },
    }), store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipt.tier).toBe('propose');
    expect(result.receipt.undo.kind).toBe('none');
    expect(store.expenseWriteCount).toBe(0);
  });

  test('the same clientKey writes once', async () => {
    const store = createMemoryActionStore();
    const first = await createExpense(createInput(), store);
    const second = await createExpense(createInput({
      supplier: 'Someone else',
      unitCost: 50,
    }), store);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.receipt.id).toBe(first.receipt.id);
    expect(store.expenseWriteCount).toBe(1);
    expect(store.receiptWriteCount).toBe(1);
  });

  test('rejects a tradeId on the input', async () => {
    const store = createMemoryActionStore();
    const result = await createExpense(createInput({ tradeId: 'concreting' }), store);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('invalid_input');
    expect(store.expenseWriteCount).toBe(0);
  });

  test('undo voids the expense, and a second undo is a no-op', async () => {
    const store = createMemoryActionStore();
    const created = await createExpense(createInput(), store);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const first = await undoAction({
      scope: SCOPE,
      receiptId: created.receipt.id,
      clientKey: 'undo-create-1xx',
    }, store);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.receipt.status).toBe('undone');
    const voided = await store.getExpense(SCOPE.orgId, 'job-a', 'exp-new');
    expect(voided?.status).toBe('void');
    expect(voided?.source).toBe('assistant');
    const writes = store.expenseWriteCount;
    const second = await undoAction({
      scope: SCOPE,
      receiptId: created.receipt.id,
      clientKey: 'undo-create-2xx',
    }, store);
    expect(second.ok).toBe(true);
    expect(store.expenseWriteCount).toBe(writes);
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'exp-new'))?.status).toBe('void');
  });
});

describe('runAction registry', () => {
  test('NEVER actions refuse with no write', async () => {
    const store = seededStore();
    for (const name of NEVER_ACTIONS) {
      const result = await runAction(name, {
        scope: SCOPE,
        jobId: 'job-a',
        expenseId: 'exp-1',
        tradeId: 'concreting',
        clientKey: CLIENT_KEY,
        evidence: { tradeId: { source: 'user', value: 'concreting' } },
      }, store);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('never_action');
    }
    expect(store.expenseWriteCount).toBe(0);
    expect(store.receiptWriteCount).toBe(0);
  });

  test('unknown names are rejected and never repaired', async () => {
    const store = seededStore();
    const result = await runAction('code-expense', {
      scope: SCOPE,
      jobId: 'job-a',
      expenseId: 'exp-1',
      tradeId: 'concreting',
      clientKey: CLIENT_KEY,
      origin: 'human',
      evidence: { tradeId: { source: 'user', value: 'concreting' } },
    }, store);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('unknown_action');
    expect(store.expenseWriteCount).toBe(0);
  });

  test('runnable names are codeExpense, createExpense, codeExpenseBatch and undoAction', () => {
    expect(ACTION_NAMES).toEqual(['codeExpense', 'createExpense', 'codeExpenseBatch', 'undoAction']);
  });
});

describe('action layer stays off first paint and never talks to OpenAI', () => {
  test('there is no actions barrel', () => {
    expect(fs.existsSync(path.join(root, 'src/actions/index.ts'))).toBe(false);
  });

  test('action modules never call OpenAI or hard-delete', () => {
    const dir = path.join(root, 'src/actions');
    fs.readdirSync(dir).forEach((name) => {
      if (!name.endsWith('.ts') || name.endsWith('.test.ts')) return;
      const source = fs.readFileSync(path.join(dir, name), 'utf8');
      expect(source).not.toMatch(/openai/i);
      expect(source).not.toContain('api.openai.com');
      expect(source).not.toMatch(/\bdeleteDoc\b/);
    });
    const adapter = read('src/firebase/assistantReceipts.ts');
    expect(adapter).not.toMatch(/openai/i);
    expect(adapter).not.toContain('api.openai.com');
    expect(adapter).not.toMatch(/\bdeleteDoc\b/);
  });

  test('App.js and PaletteHost do not import the action layer', () => {
    const app = read('src/App.js');
    const host = read('src/components/PaletteHost.tsx');
    expect(app).not.toContain('src/actions');
    expect(app).not.toContain("from './actions");
    expect(app).not.toContain("from '../actions");
    expect(app).not.toContain('assistantReceipts');
    expect(host).not.toContain('src/actions');
    expect(host).not.toContain("from './actions");
    expect(host).not.toContain("from '../actions");
    expect(host).not.toContain('assistantReceipts');
  });

  test('Cost Plan lazy-loads the sort-to-plan sheet', () => {
    const page = read('src/components/pages/CostPlanPage.tsx');
    expect(page).not.toMatch(/from ['"][^'"]*actions/);
    expect(page).not.toContain('codeExpenseBatch');
    expect(page).toContain("lazy(() => import('../costPlan/ProposeTradesSheet'))");
    expect(page).toContain("searchParams.get('code')");
  });

  test('Add expense lazy-loads the file-this flow', () => {
    const page = read('src/components/pages/AddExpensePage.js');
    expect(page).not.toMatch(/from ['"][^'"]*actions/);
    expect(page).toContain("import('../../actions/fileThis')");
    const main = read('src/components/MainContent.js');
    expect(main).toContain("lazy(() => import('./pages/AddExpensePage'))");
  });

  test('activity view is lazy and lists receipts without orderBy', () => {
    const main = read('src/components/MainContent.js');
    expect(main).toContain("lazy(() => import('./pages/AssistantActivityPage'))");
    expect(main).toContain('/assistant-activity');
    const page = read('src/components/pages/AssistantActivityPage.tsx');
    expect(page).toContain("import('../../actions/undoStored')");
    expect(page).toContain("import('../../firebase/assistantReceipts')");
    expect(page).not.toMatch(/from ['"][^'"]*undoStored/);
    const adapter = read('src/firebase/assistantReceipts.ts');
    expect(adapter).toContain('listAssistantReceipts');
    expect(adapter).toContain('getDocs(receiptsCol(id))');
    expect(adapter).not.toMatch(/orderBy\(/);
    const dashboard = read('src/components/pages/DashboardPage.js');
    expect(dashboard).toContain("import('../../firebase/assistantReceipts')");
    expect(dashboard).not.toMatch(/from ['"][^'"]*actions/);
    const history = read('src/components/pages/HistoryPage.js');
    expect(history).toContain('assistantHistoryMarker');
    const modal = read('src/components/ExpenseModal.jsx');
    expect(modal).toContain('assistantConfirmed = true');
    expect(modal).toContain('setExpenseAssistantConfirmed');
    const sidebar = read('src/components/Sidebar.js');
    expect(sidebar).toContain('assistant-activity');
    const profile = read('src/components/pages/ProfilePage.tsx');
    expect(profile).toContain('assistant-activity');
    expect(profile).toContain('Allow the assistant to write');
    expect(profile).toContain("import('../../firebase/assistantWrites')");
    expect(profile).toContain("membership.role === 'owner'");
    expect(profile).toContain('permissionDeniedMessage');
    expect(profile).not.toMatch(/from ['"][^'"]*actions/);
    expect(read('src/components/Header.js')).not.toContain('assistantWritesEnabled');
    expect(read('src/App.js')).not.toContain('assistantWritesEnabled');
    expect(read('src/App.js')).not.toContain('neverRequest');
    expect(read('src/components/PaletteHost.tsx')).not.toContain('neverRequest');
    expect(read('src/firebase/assistantWrites.ts')).not.toMatch(/from ['"][^'"]*actions/);
  });

  test('Toaster undo is optional', () => {
    const toaster = read('src/components/ui/Toaster.tsx');
    expect(toaster).toContain('action?:');
    const ui = read('src/context/UIContext.jsx');
    expect(ui).toContain("showToast = useCallback((message, type = 'info'");
    expect(ui).toContain('extras');
  });

  test('queries still never write', () => {
    const dir = path.join(root, 'src/queries');
    fs.readdirSync(dir).forEach((name) => {
      if (!name.endsWith('.ts') || name.endsWith('.test.ts')) return;
      const source = fs.readFileSync(path.join(dir, name), 'utf8');
      expect(source).not.toMatch(/\bsetDoc\b/);
      expect(source).not.toMatch(/\bupdateDoc\b/);
      expect(source).not.toMatch(/\bcreateExpense\b/);
    });
  });
});
