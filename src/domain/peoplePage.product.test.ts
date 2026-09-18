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
    expect(readRepo('src/components/pages/DashboardPage.js')).not.toContain('JobPeople');
    expect(readRepo('src/components/pages/DashboardPage.js')).toContain('JobPresence');
    expect(readRepo('src/components/pages/DashboardPage.js')).not.toContain('PeoplePage');
    expect(readRepo('src/components/JobPresence.tsx')).not.toContain('PeoplePage');
    expect(readRepo('src/components/pages/JobsHomePage.js')).not.toContain('JobPeople');
    expect(readRepo('src/components/pages/JobsHomePage.js')).not.toContain('removePerson');
    expect(readRepo('src/components/pages/JobsHomePage.js')).toContain("navigate(`/people?job=${encodeURIComponent(project.projectId)}&add=1`)");
    expect(readRepo('src/components/pages/JobsHomePage.js')).toContain('canManageJob');
    expect(fs.existsSync(path.join(root, 'src/components/JobPeople.jsx'))).toBe(false);
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
    expect(page).toContain("searchParams.get('email')");
    expect(page).toContain('personKeyForEmail');
    expect(page).not.toContain('removeEmailFromProject');
    expect(page).toContain('removePersonFromVisibleJobs');
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

  test('Profile is you: lazy, own details only, People email opens the row', () => {
    const main = readRepo('src/components/MainContent.js');
    expect(main).toContain("lazy(() => import('./pages/ProfilePage'))");
    expect(main).not.toMatch(/from ['"][^'"]*pages\/ProfilePage/);
    expect(fs.existsSync(path.join(root, 'src/components/pages/ProfilePage.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'src/components/pages/ProfilePage.js'))).toBe(false);
    const profile = readRepo('src/components/pages/ProfilePage.tsx');
    expect(profile).toContain('ownProfileModel');
    expect(profile).toContain('signInMethodLabel');
    expect(profile).toContain('View in People');
    expect(profile).toContain('permissionDeniedMessage');
    expect(profile).toContain("membership.role === 'owner'");
    expect(profile).toContain('writesSetting !== false');
    expect(profile).not.toContain('loadPeopleProfileCards');
    expect(profile).not.toContain('loadProfilesForEmails');
    expect(profile).not.toContain('toPublicProfile');
    expect(profile).not.toMatch(/from ['"][^'"]*firebase\/people/);
    expect(profile).not.toMatch(/from ['"][^'"]*actions/);
    const setup = readRepo('src/components/ProfileSetupScreen.jsx');
    expect(setup).toContain('linkPasswordToGoogleUser');
    expect(setup).toContain('AddPasswordCard');
    expect(setup).toContain('embedded');
    expect(profile).toContain('embedded');
    const people = readRepo('src/components/pages/PeoplePage.tsx');
    expect(people).toContain("searchParams.get('email')");
    expect(people).toContain('personKeyForEmail');
  });
});
