import { describe, expect, test, vi } from 'vitest';
import { partySchema } from '../domain/schemas';
import { canonicalPartyName, namesMatch } from './partyName';

vi.mock('./config', () => ({ db: {} }));
vi.mock('./tenancy', () => ({
  getActiveOrgId: () => 'test-org',
  isPermissionDenied: () => false,
}));
vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  serverTimestamp: vi.fn(),
  updateDoc: vi.fn(),
}));

import {
  followMergedParty,
  partyHintFromExpense,
  partyHintFromInvoice,
  partyKindFromDirectory,
  resolvePartyFromList,
  type PartyRecord,
} from './parties';

function party(partial: Partial<PartyRecord> & Pick<PartyRecord, 'id' | 'canonicalName' | 'kind'>): PartyRecord {
  return {
    displayName: partial.displayName || partial.canonicalName,
    status: 'active',
    mergedInto: null,
    ...partial,
  };
}

describe('party identity', () => {
  test('namesMatch still over-merges Smith into Smithson, but identity does not', () => {
    expect(namesMatch('Smith', 'Smithson Electrical')).toBe(true);
    expect(canonicalPartyName('Smith')).toBe('smith');
    expect(canonicalPartyName('Smithson Electrical')).toBe('smithson electrical');
    const parties = [
      party({ id: 'smithson', canonicalName: 'smithson electrical', kind: 'supplier', displayName: 'Smithson Electrical' }),
    ];
    expect(resolvePartyFromList(parties, { canonicalName: 'smith', kind: 'supplier' })).toEqual({ action: 'create' });
  });

  test('namesMatch still treats Lalit as Lalit Sahni, but identity does not', () => {
    expect(namesMatch('Lalit', 'Lalit Sahni')).toBe(true);
    expect(canonicalPartyName('Lalit')).toBe('lalit');
    expect(canonicalPartyName('Lalit Sahni')).toBe('lalit sahni');
    const parties = [
      party({ id: 'lalit-sahni', canonicalName: 'lalit sahni', kind: 'worker', displayName: 'Lalit Sahni' }),
    ];
    expect(resolvePartyFromList(parties, { canonicalName: 'lalit', kind: 'worker' })).toEqual({ action: 'create' });
  });

  test('Mark Joinery spellings stay apart on both fuzzy and exact canonical', () => {
    expect(namesMatch("Mark's Joinery", 'Mark Joinery Pty Ltd')).toBe(false);
    expect(canonicalPartyName("Mark's Joinery")).toBe('mark s joinery');
    expect(canonicalPartyName('Mark Joinery Pty Ltd')).toBe('mark joinery');
  });

  test('exact canonical match of one active party is used', () => {
    const parties = [
      party({ id: 'b1', canonicalName: 'bunnings', kind: 'supplier', displayName: 'Bunnings' }),
    ];
    expect(resolvePartyFromList(parties, {
      canonicalName: canonicalPartyName('Bunnings Warehouse'),
      kind: 'supplier',
    })).toEqual({ action: 'use', partyId: 'b1' });
  });

  test('same canonical name on two actives of the same kind is left unset', () => {
    const parties = [
      party({ id: 'a', canonicalName: 'metro', kind: 'supplier' }),
      party({ id: 'b', canonicalName: 'metro', kind: 'supplier' }),
    ];
    expect(resolvePartyFromList(parties, { canonicalName: 'metro', kind: 'supplier' })).toEqual({ action: 'unset' });
  });

  test('does not guess across kinds when the kind is unknown', () => {
    const parties = [
      party({ id: 'as-supplier', canonicalName: 'asif', kind: 'supplier' }),
      party({ id: 'as-trade', canonicalName: 'asif', kind: 'trade' }),
    ];
    expect(resolvePartyFromList(parties, { canonicalName: 'asif' })).toEqual({ action: 'unset' });
    expect(resolvePartyFromList(parties, { canonicalName: 'asif', kind: 'trade' })).toEqual({
      action: 'use',
      partyId: 'as-trade',
    });
  });

  test('follows mergedInto to the survivor', () => {
    const parties = [
      party({
        id: 'old',
        canonicalName: 'mark joinery',
        kind: 'trade',
        status: 'merged',
        mergedInto: 'live',
      }),
      party({ id: 'live', canonicalName: 'marks joinery', kind: 'trade', displayName: "Mark's Joinery" }),
    ];
    expect(followMergedParty(parties, 'old')?.id).toBe('live');
    expect(resolvePartyFromList(parties, { canonicalName: 'mark joinery', kind: 'trade' })).toEqual({
      action: 'use',
      partyId: 'live',
    });
  });

  test('a merge cycle is left unset rather than looping', () => {
    const parties = [
      party({ id: 'a', canonicalName: 'loop', kind: 'client', status: 'merged', mergedInto: 'b' }),
      party({ id: 'b', canonicalName: 'loop', kind: 'client', status: 'merged', mergedInto: 'a' }),
    ];
    expect(followMergedParty(parties, 'a')).toBeNull();
    expect(resolvePartyFromList(parties, { canonicalName: 'loop', kind: 'client' })).toEqual({ action: 'create' });
  });

  test('does not follow a merge into a different kind', () => {
    const parties = [
      party({
        id: 'old-supplier',
        canonicalName: 'opal',
        kind: 'supplier',
        status: 'merged',
        mergedInto: 'client-opal',
      }),
      party({ id: 'client-opal', canonicalName: 'opal ss', kind: 'client' }),
    ];
    expect(resolvePartyFromList(parties, { canonicalName: 'opal', kind: 'supplier' })).toEqual({ action: 'create' });
  });

  test('without a kind, a unique existing party can still be reused, but nothing is created', () => {
    const parties = [
      party({ id: 'asif', canonicalName: 'asif', kind: 'trade' }),
    ];
    expect(resolvePartyFromList(parties, { canonicalName: 'asif' })).toEqual({
      action: 'use',
      partyId: 'asif',
    });
    expect(resolvePartyFromList(parties, { canonicalName: 'new name' })).toEqual({ action: 'unset' });
  });
});

describe('directory and ledger hints', () => {
  test('maps directory collections onto party kinds', () => {
    expect(partyKindFromDirectory('clients')).toBe('client');
    expect(partyKindFromDirectory('suppliers')).toBe('supplier');
    expect(partyKindFromDirectory('labour')).toBe('worker');
    expect(partyKindFromDirectory('trades')).toBe('trade');
    expect(partyKindFromDirectory('serviceProviders')).toBe('service provider');
    expect(partyKindFromDirectory('payers')).toBeNull();
  });

  test('reads the typed name from an expense without guessing equipment', () => {
    expect(partyHintFromExpense({ category: 'labour', workerName: 'Sam' })).toEqual({
      name: 'Sam',
      kind: 'worker',
    });
    expect(partyHintFromExpense({ category: 'trade', tradeName: 'Asif' })).toEqual({
      name: 'Asif',
      kind: 'trade',
    });
    expect(partyHintFromExpense({ category: 'purchase', supplier: 'Bunnings' })).toEqual({
      name: 'Bunnings',
      kind: 'supplier',
    });
    expect(partyHintFromExpense({ category: 'materials', supplier: 'Rodgers' })).toEqual({
      name: 'Rodgers',
      kind: 'supplier',
    });
    expect(partyHintFromExpense({ category: 'service', provider: 'Optus', serviceName: 'NBN' })).toEqual({
      name: 'Optus',
      kind: 'service provider',
    });
    expect(partyHintFromExpense({ category: 'equipment', equipmentName: 'Mixer' })).toBeNull();
    expect(partyHintFromInvoice({ clientName: 'Vaneet Khera' })).toEqual({
      name: 'Vaneet Khera',
      kind: 'client',
    });
  });
});

describe('party schema', () => {
  test('accepts an active party and a merged pointer', () => {
    expect(partySchema.parse({
      id: 'p1',
      displayName: 'Bunnings',
      canonicalName: 'bunnings',
      kind: 'supplier',
      status: 'active',
    }).status).toBe('active');
    expect(partySchema.parse({
      displayName: 'Old Bunnings',
      canonicalName: 'bunnings warehouse',
      kind: 'supplier',
      status: 'merged',
      mergedInto: 'p1',
    }).mergedInto).toBe('p1');
  });

  test('rejects a made-up kind or a long id', () => {
    expect(() => partySchema.parse({
      displayName: 'X',
      canonicalName: 'x',
      kind: 'vendor',
      status: 'active',
    })).toThrow();
    expect(() => partySchema.parse({
      id: 'x'.repeat(81),
      displayName: 'X',
      canonicalName: 'x',
      kind: 'client',
      status: 'active',
    })).toThrow();
  });
});
