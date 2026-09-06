import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function read(relative: string) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function jobOpenEffect(source: string) {
  const start = source.indexOf("logger.firebase('LOAD_DATA'");
  const end = source.indexOf('invalidateExpenseQueries', start);
  if (start < 0 || end < 0) return '';
  return source.slice(start, end);
}

describe('job directory queries', () => {
  test('job-open listener effect does not fetch directories', () => {
    const context = read('src/context/AppContext.js');
    const effect = jobOpenEffect(context);
    expect(effect).toContain('listenJobExpenses');
    expect(effect).toContain('listenJobInvoices');
    expect(effect).not.toContain('getLabour');
    expect(effect).not.toContain('getTrades');
    expect(effect).not.toContain('getClients');
    expect(effect).not.toContain('Promise.all');
    const getClientsInEffect = (effect.match(/getClients/g) || []).length;
    expect(getClientsInEffect).toBe(0);
  });

  test('query keys cover directories and invoice extras', () => {
    const client = read('src/query/client.ts');
    expect(client).toContain('clients:');
    expect(client).toContain('labour:');
    expect(client).toContain('trades:');
    expect(client).toContain('suppliers:');
    expect(client).toContain('serviceProviders:');
    expect(client).toContain('payers:');
    expect(client).toContain('progressPayments:');
    expect(client).toContain('hiaContracts:');
    expect(client).toContain('bankDetails:');
  });

  test('directory hooks live in useJobDirectories with a long staleTime', () => {
    const hooks = read('src/hooks/useJobDirectories.ts');
    expect(hooks).toContain('DIRECTORY_STALE_TIME = 30 * 60 * 1000');
    expect(hooks).toContain('useJobLabour');
    expect(hooks).toContain('useJobTrades');
    expect(hooks).toContain('useJobClients');
    expect(hooks).toContain('useJobSuppliers');
    expect(hooks).toContain('useJobServiceProviders');
    expect(hooks).toContain('useJobPayers');
    expect(hooks).toContain('useJobProgressPayments');
    expect(hooks).toContain('useJobHiaContracts');
    expect(hooks).toContain('useJobBankDetails');
    expect(hooks).toContain('DIRECTORY_STALE_TIME');
    expect(hooks).toMatch(/staleTime/);
    expect(hooks).toContain('enabled: Boolean(orgId && jobId && extraEnabled)');
    expect(hooks).toContain('patchNamedList');
    expect(hooks).toContain('setList');
    expect(hooks).toContain('setBankDetails');
  });
});
