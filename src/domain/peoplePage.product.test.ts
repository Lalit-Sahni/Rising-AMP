import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');

function readRepo(rel: string) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('People page product wiring', () => {
  test('People is a lazy org route at /people, not first paint', () => {
    const main = readRepo('src/components/MainContent.js');
    const navigation = readRepo('src/navigation.ts');
    const sidebar = readRepo('src/components/Sidebar.js');
    expect(main).toContain("lazy(() => import('./pages/PeoplePage'))");
    expect(main).toContain('path="/people"');
    expect(main).not.toMatch(/from ['"][^'"]*pages\/PeoplePage/);
    expect(navigation).toContain("case 'people':");
    expect(navigation).toContain("return '/people'");
    expect(navigation).toContain("if (path === '/people') return 'people'");
    expect(navigation).toContain("page !== 'people'");
    expect(sidebar).toContain("key: 'people'");
    expect(sidebar).toContain("needsJob: false");
    expect(sidebar).toContain("label: 'People'");
    expect(readRepo('src/App.js')).not.toContain('PeoplePage');
    expect(readRepo('src/components/pages/DashboardPage.js')).toContain('<JobPeople');
  });

  test('the panel mapper uses toPublicProfile and the page does not render private fields', () => {
    const domain = readRepo('src/domain/peoplePage.ts');
    const page = readRepo('src/components/pages/PeoplePage.tsx');
    expect(domain).toContain('toPublicProfile');
    expect(domain).toContain('export function mapPersonPublicCard');
    expect(domain).toContain('export function personPanelModel');
    expect(page).toContain('personPanelModel');
    expect(readRepo('src/firebase/people.ts')).toContain('mapPersonPublicCard');
    expect(page).not.toMatch(/\.mobile\b/);
    expect(page).not.toMatch(/\.abn\b/);
    expect(page).not.toMatch(/\.street\b/);
    expect(page).not.toMatch(/\.businessName\b/);
    expect(page).toContain('Phone numbers and addresses are not shown here');
    expect(page).toContain('directory');
    expect(page).toContain("searchParams.get('job')");
    expect(page).toContain("searchParams.get('add')");
  });

  test('org-remove updates visible job documents and leaves the org invitedEmails alone', () => {
    const adapter = readRepo('src/firebase/people.ts');
    expect(adapter).toContain('removePersonFromVisibleJobs');
    expect(adapter).toContain('arrayRemove');
    expect(adapter).not.toContain('removeEmailFromProject');
    expect(adapter).not.toContain('emailRemainsOnJobs');
    expect(adapter).not.toMatch(/updateDoc\(doc\(db, 'organizations', orgId\(\)\),/);
    expect(adapter).toContain("doc(db, 'organizations', orgId(), 'projects'");
    expect(readRepo('src/domain/peoplePage.ts')).toContain('orgTouched: false');
    expect(readRepo('src/domain/peoplePage.ts')).toContain('stay on the organisation');
  });
});
