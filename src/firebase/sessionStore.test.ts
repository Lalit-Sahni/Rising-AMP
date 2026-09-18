import {
  clearLegacyFlatSessionKeys,
  clearSession,
  emptySession,
  LEGACY_FLAT_SESSION_KEYS,
  readSession,
  writeSession,
} from './sessionStore';

function seedFlatSession() {
  localStorage.setItem('risingAmp.projectId', 'job-leaked');
  localStorage.setItem('risingAmp.projectName', 'Leaked job');
  localStorage.setItem('risingAmp.invitedEmails', JSON.stringify(['old@opal.test']));
}

describe('uid-scoped session', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('two uids cannot read each other\'s session', () => {
    writeSession('uid-a', {
      projectId: 'job-a',
      projectName: 'A job',
      invitedEmails: ['a@opal.test'],
      orgId: 'org-a',
    });
    writeSession('uid-b', {
      projectId: 'job-b',
      projectName: 'B job',
      invitedEmails: ['b@opal.test'],
      orgId: 'org-b',
    });
    expect(readSession('uid-a').projectId).toBe('job-a');
    expect(readSession('uid-a').projectName).toBe('A job');
    expect(readSession('uid-b').projectId).toBe('job-b');
    expect(readSession('uid-a').invitedEmails).toEqual(['a@opal.test']);
    expect(readSession('uid-b').invitedEmails).toEqual(['b@opal.test']);
  });

  test('logout clears that uid and deletes the old flat keys', () => {
    writeSession('uid-a', { projectId: 'job-a', projectName: 'A job' });
    seedFlatSession();
    clearSession('uid-a');
    expect(readSession('uid-a')).toEqual(emptySession());
    LEGACY_FLAT_SESSION_KEYS.forEach((key) => {
      expect(localStorage.getItem(key)).toBeNull();
    });
    writeSession('uid-b', { projectId: 'job-b' });
    expect(readSession('uid-b').projectId).toBe('job-b');
  });

  test('old flat keys are not used for paint', () => {
    seedFlatSession();
    expect(readSession('uid-a')).toEqual(emptySession());
    expect(readSession()).toEqual(emptySession());
    expect(readSession(null)).toEqual(emptySession());
    writeSession('uid-a', { projectId: 'job-a' });
    expect(localStorage.getItem('risingAmp.projectId')).toBeNull();
    clearLegacyFlatSessionKeys();
    expect(readSession('uid-a').projectId).toBe('job-a');
  });
});
