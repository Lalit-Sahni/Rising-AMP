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

describe('Firestore disk cache wiring', () => {
  test('initializes persistent cache and falls back to memory', () => {
    const config = read('src/firebase/config.js');
    expect(config).toContain('initializeFirestore');
    expect(config).toContain('persistentLocalCache');
    expect(config).toContain('persistentMultipleTabManager');
    expect(config).toContain('memoryLocalCache');
    expect(config).not.toMatch(/const db = getFirestore\(app\)/);
  });

  test('boot listens to invited jobs instead of awaiting getDocs', () => {
    const app = read('src/App.js');
    expect(app).toContain('listenInvitedProjects');
    expect(app).toContain('unsubJobs()');
    expect(app).not.toMatch(/await listInvitedProjects/);
  });

  test('a job open listens to expenses and invoices and detaches them', () => {
    const context = read('src/context/AppContext.js');
    const effect = jobOpenEffect(context);
    expect(effect).toContain('listenJobExpenses');
    expect(effect).toContain('listenJobInvoices');
    expect(effect).toContain('unsubExpenses()');
    expect(effect).toContain('unsubInvoices()');
    expect(effect).not.toContain('fetchExpensesFromFirestore');
    expect(context).not.toContain('fetchExpensesFromFirestore');
    expect(effect).not.toContain('Promise.all');
    expect(effect).not.toContain('getLabour');
    expect(effect).not.toContain('getTrades');
    expect(effect).not.toContain('getClients');
    expect(effect).not.toContain('getSuppliers');
    expect(effect).not.toContain('getServiceProviders');
    expect(effect).not.toContain('fetchProgressPayments');
    expect(effect).not.toContain('fetchHIAContractsFromFirestore');
    expect(effect).not.toContain('fetchUserBankDetailsFromFirestore');
    expect(effect).not.toContain('fetchPayersFromFirestore');
  });

  test('the service worker still never caches Firestore', () => {
    const viteConfig = read('vite.config.js');
    expect(viteConfig).toContain("handler: 'NetworkOnly'");
    expect(viteConfig).toContain('firestore.googleapis.com');
    expect(viteConfig).toContain('INITIAL_GZIP_BUDGET = 275 * 1024');
  });
});
