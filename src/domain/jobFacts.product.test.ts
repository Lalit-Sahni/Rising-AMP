import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');

function readRepo(rel: string) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('job facts product wiring', () => {
  test('App.js, PaletteHost, Header and DashboardPage have no static proposeJobFacts, sheet or adapter import', () => {
    const dashboard = readRepo('src/components/pages/DashboardPage.js');
    ['src/App.js', 'src/components/PaletteHost.tsx', 'src/components/Header.js', 'src/components/pages/DashboardPage.js'].forEach((rel) => {
      const source = readRepo(rel);
      expect(source).not.toMatch(/from ['"][^'"]*proposeJobFacts['"]/);
      expect(source).not.toMatch(/from ['"][^'"]*ProposeJobFactsSheet['"]/);
      expect(source).not.toMatch(/from ['"][^'"]*firebase\/jobFacts['"]/);
      if (rel !== 'src/components/pages/DashboardPage.js') {
        expect(source).not.toContain('proposeJobFacts');
        expect(source).not.toContain('ProposeJobFactsSheet');
        expect(source).not.toContain('firebase/jobFacts');
      }
    });
    expect(dashboard).not.toContain('proposeJobFacts');
    expect(dashboard).not.toContain('ProposeJobFactsSheet');
    expect(dashboard).toContain("lazy(() => import('../jobFacts/JobFactsPanel'))");
    expect(dashboard).toContain('jobFactsLeadParts(jobFactsLead(jobFacts, projectName))');
    expect(dashboard).toContain("metrics.cash.paid > 0 ? formatMoney(metrics.cash.paid) : '—'");
    expect(dashboard).not.toContain('contractValueCents');
    expect(dashboard).toContain("import('../../firebase/jobFacts')");
    expect(dashboard).not.toMatch(/from ['"][^'"]*firebase\/jobFacts['"]/);
    expect(dashboard).not.toMatch(/from ['"][^'"]*jobFacts\/JobFactsPanel/);
  });

  test('source marker is a quiet label or hairline dot, not a pill', () => {
    const panel = readRepo('src/components/jobFacts/JobFactsPanel.tsx');
    expect(panel).toContain('text-[11px] text-slate-400');
    expect(panel).toContain('w-[7px] h-[7px] rounded-full bg-[#D6D9DD]');
    expect(panel).toContain('Not confirmed');
    expect(panel).not.toMatch(/bg-warn-tint/);
    expect(panel).not.toMatch(/bg-pos-tint/);
    expect(panel).not.toMatch(/rounded-full[^;\n]*warn-tint|warn-tint[^;\n]*rounded-full/);
    expect(panel).not.toContain('ProposeJobFactsSheet');
    expect(panel).toContain("import('../../firebase/jobFacts')");
    expect(panel).toContain('buildOwnerFactPatch');
    expect(panel).not.toMatch(/from ['"][^'"]*firebase\/jobFacts['"]/);
  });

  test('invoice Bill to is unchanged when siteAddress is omitted; HIA claims omit the prop', () => {
    const invoice = readRepo('src/components/invoices/InvoiceDocument.tsx');
    const billToAt = invoice.indexOf('mb-1.5">Bill to</div>');
    const jobAt = invoice.indexOf('mb-1.5">Job</div>');
    expect(jobAt).toBeGreaterThan(billToAt);
    const billTo = invoice.slice(billToAt, jobAt);
    expect(billTo).toContain('client.address');
    expect(billTo).not.toContain('siteAddress');
    const job = invoice.slice(jobAt, invoice.indexOf('<table'));
    expect(job).toContain('siteAddress');
    expect(invoice).not.toContain('fetchJobFacts');
    expect(invoice).not.toContain('firebase/jobFacts');

    const hia = readRepo('src/components/pages/HIAContractPage.jsx');
    expect(hia).not.toContain('siteAddress');
    expect(hia).toContain("title: 'Progress claim'");
    expect(hia).toContain("gstNote: 'GST is included in the contract sum'");
    expect(hia).toContain('includeGST: false');
  });

  test('excel export keeps the two-arg call and does not invent 0 sqm columns', () => {
    const excel = readRepo('src/utils/excelExport.js');
    expect(excel).toContain('export const exportExpensesToExcel = async (expenses, filename, identity)');
    expect(excel).not.toContain('0 sqm');
    expect(excel).not.toMatch(/identity\.floorArea \|\| ['"]0/);
    const dashboard = readRepo('src/components/pages/DashboardPage.js');
    expect(dashboard).toContain('jobExportIdentity(projectName, jobFacts)');
    const history = readRepo('src/components/pages/HistoryPage.js');
    expect(history).toContain("import('../../firebase/jobFacts')");
    expect(history).toContain('jobExportIdentity');
  });

  test('handover generate lazy-fetches facts and does not static-import the adapter', () => {
    const sheet = readRepo('src/components/files/HandoverPackSheet.tsx');
    expect(sheet).toContain("import('../../firebase/jobFacts')");
    expect(sheet).toContain('handoverFactLines');
    expect(sheet).toContain('factLines.address || jobAddressFromClients(clients)');
    expect(sheet).not.toMatch(/from ['"][^'"]*firebase\/jobFacts['"]/);
    const files = readRepo('src/components/pages/FilesPage.tsx');
    expect(files).toContain('jobId={jobId}');
  });
});
