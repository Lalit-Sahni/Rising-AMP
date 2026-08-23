import { profileIsComplete, profileNeedsSetup, resolveLoadedProfile, toClientProfile } from './profileGate';

describe('profile setup gate', () => {
  test('a finished profile is not asked to set up again', () => {
    expect(profileNeedsSetup({
      setupComplete: true,
      displayName: 'Lalit Sahni',
      businessName: 'Opal SS',
    })).toBe(false);
    expect(profileIsComplete({
      setupComplete: 'true',
      displayName: 'Lalit',
      businessName: 'Opal',
    })).toBe(true);
  });

  test('name and business are enough even if the flag was missing', () => {
    expect(profileNeedsSetup({
      displayName: 'Lalit Sahni',
      businessName: 'Opal SS',
    })).toBe(false);
  });

  test('missing profile or missing name still needs setup', () => {
    expect(profileNeedsSetup(null)).toBe(true);
    expect(profileNeedsSetup({ displayName: 'Lalit', businessName: '' })).toBe(true);
  });

  test('client profile does not keep Firestore sentinels', () => {
    const row = toClientProfile('uid-1', {
      email: 'Owner@Gmail.com',
      displayName: '  Lalit  ',
      businessName: 'Opal',
      setupComplete: true,
      updatedAt: { seconds: 1 },
    });
    expect(row.uid).toBe('uid-1');
    expect(row.email).toBe('owner@gmail.com');
    expect(row.displayName).toBe('Lalit');
    expect(row.setupComplete).toBe(true);
    expect(row.updatedAt).toBeUndefined();
  });

  test('a sign-in stub is replaced by the complete profile for that email', () => {
    const resolved = resolveLoadedProfile({
      uid: 'google-uid',
      email: 'lalit.sahni@gmail.com',
      uidDoc: { email: 'lalit.sahni@gmail.com', lastSignInAt: { seconds: 1 } },
      emailProfile: {
        uid: 'password-uid',
        email: 'lalitsahni@gmail.com',
        displayName: 'Lalit Sahni',
        businessName: 'Opal SS Constructions',
        setupComplete: true,
      },
      cached: null,
    });
    expect(resolved.write).toBe(true);
    expect(resolved.profile.uid).toBe('google-uid');
    expect(profileNeedsSetup(resolved.profile)).toBe(false);
    expect(resolved.profile.displayName).toBe('Lalit Sahni');
  });

  test('a complete profile on this device is kept if the server row is a stub', () => {
    const resolved = resolveLoadedProfile({
      uid: 'uid-1',
      email: 'owner@example.com',
      uidDoc: { email: 'owner@example.com' },
      emailProfile: null,
      cached: {
        uid: 'uid-1',
        email: 'owner@example.com',
        displayName: 'Lalit Sahni',
        businessName: 'Opal SS Constructions',
        setupComplete: true,
      },
    });
    expect(resolved.write).toBe(true);
    expect(profileNeedsSetup(resolved.profile)).toBe(false);
  });
});
