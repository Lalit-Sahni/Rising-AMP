import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');

function readRepo(rel: string) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('Part E identity product wiring', () => {
  test('Ask-for-access is decided before ProfileSetup for invited: false', () => {
    const app = readRepo('src/App.js');
    const gate = readRepo('src/domain/accessGate.ts');
    expect(app).toContain('accessScreen');
    expect(app).toContain("screen === 'ask-for-access'");
    expect(app).toContain("screen === 'profile-setup'");
    expect(app.indexOf("screen === 'ask-for-access'")).toBeLessThan(app.indexOf("screen === 'profile-setup'"));
    expect(app).not.toMatch(/useState\(\(\) => readSession/);
    expect(gate).toContain("if (!input.membership.invited) return 'ask-for-access'");
    expect(gate).toContain("if (input.profileNeedsSetup) return 'profile-setup'");
    expect(gate.indexOf("if (!input.membership.invited) return 'ask-for-access'"))
      .toBeLessThan(gate.indexOf("if (input.profileNeedsSetup) return 'profile-setup'"));
  });

  test('lookup-failed has honest retry copy, not the stranger screen as the only path', () => {
    const screen = readRepo('src/components/AskForAccessScreen.jsx');
    expect(screen).toContain("reason === 'lookup-failed'");
    expect(screen).toContain('Could not check access');
    expect(screen).toContain('Retry');
    expect(screen).toContain('This is not a refusal');
    expect(screen).toContain('Ask us for access');
    const failedBlock = screen.slice(
      screen.indexOf("reason === 'lookup-failed'"),
      screen.indexOf('Ask us for access'),
    );
    expect(failedBlock).not.toMatch(/you are not on a company/i);
  });

  test('session is uid-scoped, cleared on logout, and the stranded invite keeps an org listener', () => {
    const app = readRepo('src/App.js');
    const tenancy = readRepo('src/firebase/tenancy.js');
    const auth = readRepo('src/firebase/auth.js');
    expect(app).toContain('listenOrganisationsForEmail');
    expect(app).toContain('clearSession(authUid)');
    expect(app).toContain('clearBootCache(authUid)');
    expect(app).toContain('readSession(authUid)');
    expect(app).toContain('writeSession(authUid');
    expect(app).not.toContain('getDoc(doc(db, \'organizations\'');
    expect(tenancy).toContain('onSnapshot');
    expect(tenancy).toContain("where('invitedEmails', 'array-contains'");
    expect(tenancy).not.toMatch(/if \(code === 'permission-denied'\)[\s\S]{0,180}not-on-list/);
    expect(auth).toContain('clearSession(uid)');
  });

  test('profile lookups try every Gmail invite variant and public writes stay on the allowed key', () => {
    const profiles = readRepo('src/firebase/profiles.js');
    const people = readRepo('src/firebase/people.ts');
    const gate = readRepo('src/firebase/profileGate.js');
    const rules = readRepo('firestore.rules');
    expect(profiles).toContain('emailInviteVariants');
    expect(profiles).toContain('pickFoundPublicProfile');
    expect(people).toContain('emailInviteVariants');
    expect(gate).toContain('emailsMatch');
    expect(gate).toContain('pickFoundPublicProfile');
    expect(rules).toContain('request.auth.token.email.lower() == request.resource.data.email');
    expect(rules).not.toMatch(/emailKey\)\.replace\(|token\.email\.replace\(/);
    expect(fs.existsSync(path.join(root, 'scripts/phase18-canonical-public-profiles.ts'))).toBe(true);
  });
});
