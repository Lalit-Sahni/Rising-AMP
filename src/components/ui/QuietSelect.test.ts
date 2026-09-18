import { describe, expect, test } from 'vitest';
import { uniqueOptions } from './QuietSelect';

describe('uniqueOptions', () => {
  test('keeps the first of a duplicated value so a suggestion can lead', () => {
    const rows = uniqueOptions([
      { value: '', label: 'Uncoded' },
      { value: 'electrical', label: 'Electrical (suggested)' },
      { value: 'electrical', label: 'Electrical' },
      { value: 'plumbing', label: 'Plumbing' },
    ]);
    expect(rows.map((row) => row.label)).toEqual([
      'Uncoded',
      'Electrical (suggested)',
      'Plumbing',
    ]);
  });
});
