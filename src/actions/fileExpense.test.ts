import { decideFileExpense, statedGstCents } from './fileExpense';
import { parseToCents } from '../money';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

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

describe('statedGstCents', () => {
  test('a stated figure is integer cents', () => {
    expect(statedGstCents(12.45)).toBe(1245);
    expect(statedGstCents('12.45')).toBe(1245);
  });

  test('empty, missing, or 0-from-empty is unstated', () => {
    expect(statedGstCents(null)).toBeUndefined();
    expect(statedGstCents(undefined)).toBeUndefined();
    expect(statedGstCents('')).toBeUndefined();
    expect(statedGstCents(0)).toBeUndefined();
    expect(parseToCents('')).toBe(0);
    expect(statedGstCents('')).toBeUndefined();
  });
});

describe('decideFileExpense', () => {
  test('clean Bunnings-like OCR with an exact party is do', () => {
    const result = decideFileExpense({
      extractedData: bunningOcr(),
      warnings: [],
      category: 'purchase',
      partyMatch: 'use',
      partyId: 'party-bunnings',
    });
    expect(result.tier).toBe('do');
    expect(result.gstCents).toBe(1245);
    expect(result.partyId).toBe('party-bunnings');
    expect(result.evidence.date.source).toBe('ocr');
    expect(result.evidence.amount.source).toBe('ocr');
    expect(result.evidence.party.source).toBe('record');
    expect(result.evidence.gst?.source).toBe('ocr');
  });

  test('missing date is propose', () => {
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

  test('unknown vendor is propose', () => {
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

  test('stated tax 12.45 stores gstCents 1245; empty tax omits it', () => {
    const stated = decideFileExpense({
      extractedData: bunningOcr({ tax: 12.45 }),
      warnings: [],
      category: 'purchase',
      partyMatch: 'use',
      partyId: 'party-bunnings',
    });
    expect(stated.gstCents).toBe(1245);

    const unstated = decideFileExpense({
      extractedData: bunningOcr({ tax: '' }),
      warnings: [],
      category: 'purchase',
      partyMatch: 'use',
      partyId: 'party-bunnings',
    });
    expect(unstated.gstCents).toBeUndefined();
    expect(unstated.evidence.gst).toBeUndefined();
    expect(unstated.tier).toBe('do');
  });

  test('line items that disagree with the total make amount inferred', () => {
    const result = decideFileExpense({
      extractedData: bunningOcr({
        items: [
          { totalPrice: 50 },
          { totalPrice: 50 },
        ],
      }),
      warnings: [],
      category: 'purchase',
      partyMatch: 'use',
      partyId: 'party-bunnings',
    });
    expect(result.tier).toBe('propose');
    expect(result.evidence.amount.source).toBe('inferred');
  });

  test('does not invent GST from the total', () => {
    const result = decideFileExpense({
      extractedData: bunningOcr({ tax: null, totalAmount: 110 }),
      warnings: [],
      category: 'purchase',
      partyMatch: 'use',
      partyId: 'party-bunnings',
    });
    expect(result.gstCents).toBeUndefined();
    expect(result.gstCents).not.toBe(1000);
  });
});

describe('fileExpense never derives GST', () => {
  test('src/actions never divides by 11 or calls convertGstCents', () => {
    const dir = path.join(root, 'src/actions');
    fs.readdirSync(dir).forEach((name) => {
      if (!name.endsWith('.ts') || name.endsWith('.test.ts')) return;
      const source = fs.readFileSync(path.join(dir, name), 'utf8');
      expect(source).not.toContain('convertGstCents');
      expect(source).not.toMatch(/\/\s*11\b/);
    });
  });
});
