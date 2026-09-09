import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assignRefusalReason,
  copyForRefusal,
  looksLikeJobFactQuestion,
  nearestHonestQuestion,
} from './askRefusal';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('assignRefusalReason', () => {
  it('does not take model reason as the enum', () => {
    expect(assignRefusalReason({
      query: 'none',
      question: 'will we finish under budget',
      result: { reason: 'fact_missing', sentence: 'nothing_coded' },
    })).toBe('out_of_scope');
    expect(assignRefusalReason({
      query: 'none',
      question: 'legal advice on the HIA contract',
    })).toBe('out_of_scope');
  });

  it('names a missing job fact from the wording, not a documents query', () => {
    expect(looksLikeJobFactQuestion('how many square metres is the house')).toBe(true);
    expect(looksLikeJobFactQuestion('what is the floor area')).toBe(true);
    expect(looksLikeJobFactQuestion('what does the contract say about retention')).toBe(false);
    expect(looksLikeJobFactQuestion('legal advice on the HIA contract')).toBe(false);
    expect(looksLikeJobFactQuestion('how much have we spent on council')).toBe(false);
    expect(looksLikeJobFactQuestion('how much on the CDC')).toBe(false);
    expect(looksLikeJobFactQuestion('how much on bedrooms')).toBe(false);
    expect(looksLikeJobFactQuestion('what is the cost per sqm')).toBe(false);
    expect(looksLikeJobFactQuestion('how much per square metre')).toBe(false);
    expect(looksLikeJobFactQuestion('what is the sqm rate')).toBe(false);
    expect(looksLikeJobFactQuestion('what is the floor area rate')).toBe(false);
    expect(looksLikeJobFactQuestion('floor area cost')).toBe(false);
    expect(looksLikeJobFactQuestion('what is the rate for the floor area')).toBe(false);
    expect(assignRefusalReason({
      query: 'none',
      question: 'how much have we spent on council',
    })).toBe('out_of_scope');
    expect(assignRefusalReason({
      query: 'none',
      question: 'what is the cost per sqm',
    })).toBe('out_of_scope');
    expect(assignRefusalReason({
      query: 'none',
      question: 'how many square metres is the house',
    })).toBe('fact_missing');
    expect(assignRefusalReason({
      query: 'answerFromDocuments',
      question: 'what does the contract say about retention',
      result: {
        ok: true,
        passages: [{ match: 'quoted', quote: '5% retention' }],
      },
    })).toBeUndefined();
  });

  it('is nothing_coded when a named trade has zero coded expenses', () => {
    expect(assignRefusalReason({
      query: 'spendByTrade',
      params: { tradeId: 'concreting' },
      result: {
        ok: true,
        cents: 0,
        count: 0,
        buckets: [{ key: 'concreting', cents: 0, count: 0 }],
        provenance: { capped: false },
      },
    })).toBe('nothing_coded');
    expect(assignRefusalReason({
      query: 'spendByTrade',
      params: { tradeId: 'concreting' },
      result: {
        ok: true,
        cents: 4850,
        count: 1,
        buckets: [{ key: 'concreting', cents: 4850, count: 1 }],
        provenance: { capped: false },
      },
    })).toBeUndefined();
  });

  it('is unreadable_file when every passage is unreadable and none are quoted', () => {
    expect(assignRefusalReason({
      query: 'answerFromDocuments',
      result: {
        ok: true,
        passages: [{ match: 'unreadable', textStatus: 'none', name: 'site-plan.pdf' }],
      },
    })).toBe('unreadable_file');
    expect(assignRefusalReason({
      query: 'answerFromDocuments',
      result: {
        ok: true,
        passages: [{ match: 'quoted', quote: '5% retention' }],
      },
    })).toBeUndefined();
  });

  it('names the nearest honest question for out of scope', () => {
    expect(nearestHonestQuestion('will we finish under budget')).toContain('estimated');
    expect(nearestHonestQuestion('legal advice on the HIA contract')).toContain('contract');
    expect(copyForRefusal({
      reason: 'out_of_scope',
      question: 'asdfghjkl',
    }).detail).toMatch(/spend|files|invoices/i);
  });

  it('does not write facts or mention a facts record', () => {
    const source = fs.readFileSync(path.join(root, 'src/domain/askRefusal.ts'), 'utf8');
    expect(source).not.toMatch(/\bfacts\/current\b/);
    expect(source).not.toMatch(/\bsetDoc\b/);
    expect(source).not.toMatch(/\bupdateDoc\b/);
    expect(source).not.toMatch(/\baddDoc\b/);
    expect(copyForRefusal({
      reason: 'fact_missing',
      question: 'what is the floor area',
    }).title).toContain('floor area');
    expect(copyForRefusal({
      reason: 'fact_missing',
      question: 'what is the floor area',
    }).detail).toContain('Ask does not write it');
    expect(copyForRefusal({
      reason: 'fact_missing',
      question: 'what is the floor area',
    }).detail).toContain('Overview');
    expect(assignRefusalReason({
      query: 'jobFacts',
      params: { field: 'floorArea' },
      result: {
        ok: true,
        fields: [],
        provenance: { query: 'jobFacts', capped: false },
      },
      question: 'what is the floor area',
    })).toBe('fact_missing');
    expect(assignRefusalReason({
      query: 'jobFacts',
      params: { field: 'floorArea' },
      result: {
        ok: true,
        fields: [{ field: 'floorArea', display: '167.22 sqm', source: 'import', confirmed: false }],
      },
    })).toBeUndefined();
  });
});
