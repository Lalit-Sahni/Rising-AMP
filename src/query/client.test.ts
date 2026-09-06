import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { invalidateKeys, queryClient, queryKeys } from './client';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function read(relative: string) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

describe('scoped query invalidation', () => {
  afterEach(() => {
    queryClient.removeQueries({ queryKey: ['keep'] });
    queryClient.removeQueries({ queryKey: ['drop'] });
  });

  test('invalidateKeys marks only the keys it was given', () => {
    queryClient.setQueryData(['keep'], { ok: true });
    queryClient.setQueryData(['drop'], { ok: true });
    invalidateKeys(['drop']);
    expect(queryClient.getQueryState(['keep'])?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(['drop'])?.isInvalidated).toBe(true);
  });

  test('AppContext no longer throws away the whole cache', () => {
    const context = read('src/context/AppContext.js');
    expect(context).not.toMatch(/invalidateQueries\(\s*\)/);
    expect(context).toContain('invalidateKeys(queryKeys.expenses');
    expect(context).toContain('invalidateKeys(queryKeys.invoices');
    expect(context).toContain('queryKeys.expenses');
    expect(context).toContain('queryKeys.invoices');
  });

  test('query keys still name expenses and invoices', () => {
    expect(queryKeys.expenses('org', 'job')).toEqual(['expenses', 'org', 'job']);
    expect(queryKeys.invoices('org', 'job')).toEqual(['invoices', 'org', 'job']);
  });
});
