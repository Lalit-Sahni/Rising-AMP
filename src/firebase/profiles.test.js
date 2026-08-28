import fs from 'fs';
import path from 'path';
import { profileIsComplete, profileNeedsSetup, resolveLoadedProfile, toClientProfile, toPublicProfile, pickProfileForEmail } from './profileGate';

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

  test('public profile cards never include mobile, ABN or business name', () => {
    const card = toPublicProfile({
      uid: 'uid-1',
      email: 'Owner@Gmail.com',
      displayName: 'Lalit Sahni',
      mobile: '0400000000',
      businessName: 'Opal SS',
      abn: '32162378190',
      street: '1 Example St',
      photoUrl: 'https://example.com/p.jpg',
    });
    expect(card).toEqual({
      uid: 'uid-1',
      email: 'owner@gmail.com',
      displayName: 'Lalit Sahni',
      photoUrl: 'https://example.com/p.jpg',
    });
    expect(card).not.toHaveProperty('mobile');
    expect(card).not.toHaveProperty('abn');
    expect(card).not.toHaveProperty('businessName');
    expect(toPublicProfile({ uid: 'uid-1' })).toBeNull();
  });

  test('email lookup prefers a complete profile on a different uid', () => {
    const picked = pickProfileForEmail([
      { uid: 'google-uid', email: 'lalit.sahni@gmail.com', displayName: '', businessName: '' },
      {
        uid: 'password-uid',
        email: 'lalit.sahni@gmail.com',
        displayName: 'Lalit Sahni',
        businessName: 'Opal SS',
        setupComplete: true,
      },
    ], 'Lalit.Sahni@gmail.com', 'google-uid');
    expect(picked.uid).toBe('password-uid');
  });
});

describe('firestore.rules source', () => {
  const rules = fs.readFileSync(path.join(__dirname, '../../firestore.rules'), 'utf8');

  test('private profiles are not readable by any signed-in stranger', () => {
    expect(rules).toContain('match /profiles/{uid}');
    expect(rules).toContain('match /publicProfiles/{emailKey}');
    expect(rules).toContain('allow list: if false;');
    expect(rules).not.toContain('Own write, any signed-in read');
    expect(rules).not.toMatch(/match \/profiles\/\{uid\} \{[\s\S]*?allow read: if request\.auth != null;/);
  });

  test('the web app does not load Google Analytics', () => {
    const config = fs.readFileSync(path.join(__dirname, 'config.js'), 'utf8');
    expect(config).not.toMatch(/getAnalytics/);
    expect(config).not.toMatch(/firebase\/analytics/);
  });
});
