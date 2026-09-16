import fs from 'fs';
import path from 'path';
import { isInviteFunctionUnavailable } from './inviteSendSwitch';

describe('invite send switch', () => {
  test('falls back only when the Cloud Function is not deployed', () => {
    expect(isInviteFunctionUnavailable({ code: 'functions/not-found' })).toBe(true);
    expect(isInviteFunctionUnavailable({ code: 'functions/unimplemented' })).toBe(true);
  });

  test('a Resend rejection (functions/internal) is a real error, never a fallback', () => {
    expect(isInviteFunctionUnavailable({ code: 'functions/internal' })).toBe(false);
  });

  test('does not fall back on real permission or validation errors', () => {
    expect(isInviteFunctionUnavailable({ code: 'functions/permission-denied' })).toBe(false);
    expect(isInviteFunctionUnavailable({ code: 'functions/invalid-argument' })).toBe(false);
    expect(isInviteFunctionUnavailable({ code: 'functions/unauthenticated' })).toBe(false);
    expect(isInviteFunctionUnavailable({ code: 'functions/failed-precondition' })).toBe(false);
  });

  test('anything else is a real error, not a missing function', () => {
    expect(isInviteFunctionUnavailable({ code: 'functions/unavailable' })).toBe(false);
    expect(isInviteFunctionUnavailable({ code: 'functions/deadline-exceeded' })).toBe(false);
    expect(isInviteFunctionUnavailable({})).toBe(false);
    expect(isInviteFunctionUnavailable(null)).toBe(false);
  });
});

describe('legal pages', () => {
  const publicDir = path.join(__dirname, '../../public');

  test('privacy and terms are filled in, with no leftover placeholders', () => {
    const privacy = fs.readFileSync(path.join(publicDir, 'privacy.html'), 'utf8');
    const terms = fs.readFileSync(path.join(publicDir, 'terms.html'), 'utf8');
    for (const html of [privacy, terms]) {
      expect(html).toMatch(/Opal SS Constructions Pty Ltd/);
      expect(html).toMatch(/32 162 378 190/);
      expect(html).toMatch(/privacy@risingamp\.com\.au/);
      expect(html).toMatch(/23 August 2026/);
      expect(html).not.toMatch(/\[[a-z][^\]]+\]/i);
    }
    expect(privacy).toMatch(/Privacy Policy/);
    expect(terms).toMatch(/Terms of Service/);
  });
});
