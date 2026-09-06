import {
  canonicalPartyName,
  namesMatch,
  isLiveDirectoryRow,
  uniqueByName,
  upsertNamedRow,
} from './partyName';

test('collapses Bunnings warehouse copies to one key', () => {
  expect(canonicalPartyName('Bunnings Warehouse')).toBe('bunnings');
  expect(canonicalPartyName('Bunnings')).toBe('bunnings');
  expect(namesMatch('Bunnings Warehouse', 'Bunnings')).toBe(true);
});

test('treats Rodgers Revesby trailing space as the same supplier', () => {
  expect(namesMatch('Rodgers Revesby ', 'Rodgers Revesby')).toBe(true);
});

test('does not treat the house owner as Bunnings', () => {
  expect(namesMatch('Vaneet Khera', 'Bunnings Warehouse')).toBe(false);
});

test('strips Pty Ltd without losing the trading name', () => {
  expect(canonicalPartyName('Complete Lintels Pty Ltd')).toBe('complete lintels');
});

test('merges a longer store name onto the shorter one', () => {
  expect(namesMatch('Metro Consulting', 'Metro Consulting Group')).toBe(true);
  expect(namesMatch('Lalit', 'Lalit Sahni')).toBe(true);
});

test('uniqueByName keeps one live Bunnings and skips moved rows', () => {
  const rows = uniqueByName([
    { name: 'Bunnings Warehouse' },
    { name: 'Bunnings' },
    { name: 'Bunnings Warehouse', status: 'moved' },
    { name: 'Vaneet Khera', email: 'khera_143@yahoo.com' },
  ]);
  expect(rows.map((row) => row.name).sort()).toEqual(['Bunnings Warehouse', 'Vaneet Khera']);
});

test('upsertNamedRow updates the existing person instead of appending', () => {
  const once = upsertNamedRow([], { id: 'a', name: 'Harkirat', role: 'Labourer', rate: 40 });
  const twice = upsertNamedRow(once, { id: 'a', name: 'Harkirat', role: 'Labourer', rate: 45 });
  expect(twice).toHaveLength(1);
  expect(twice[0].rate).toBe(45);
});

test('moved rows are not live', () => {
  expect(isLiveDirectoryRow({ status: 'moved' })).toBe(false);
  expect(isLiveDirectoryRow({ status: 'active' })).toBe(true);
  expect(isLiveDirectoryRow({})).toBe(true);
});
