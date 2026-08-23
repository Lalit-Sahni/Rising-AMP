import { buildJobInviteEmail, buildNewSignInEmail, describeDevice, inferLocationLabel } from './risingAmpMail';

describe('RisingAMP mail', () => {
  test('job invite is HTML and not Gmail-only copy', () => {
    const mail = buildJobInviteEmail({
      inviterName: 'Alex',
      inviterEmail: 'alex@builder.com.au',
      projectName: 'Ridge Road Pavilion',
      appUrl: 'https://example.test',
      to: 'books@outlook.com',
    });
    expect(mail.subject).toMatch(/Ridge Road Pavilion/);
    expect(mail.html).toMatch(/RisingAMP/);
    expect(mail.html).toMatch(/books@outlook.com/);
    expect(mail.html).toMatch(/Open RisingAMP/);
    expect(mail.html).toMatch(/Google or email and password/);
    expect(mail.html).not.toMatch(/sign in with Google using this same Gmail/i);
    expect(mail.html).not.toMatch(/72 Centenary/);
    expect(mail.html).not.toMatch(/var\(--/);
  });

  test('new sign-in mail matches the security notice shape', () => {
    const mail = buildNewSignInEmail({
      displayName: 'Alex',
      businessName: 'Northside Builds',
      to: 'alex@builder.com.au',
      deviceTitle: 'Mac · Chrome',
      deviceSubtitle: 'macOS',
      whenLabel: 'Sun, 23 Aug 2026, 10:00 am AEST',
      locationLabel: 'Sydney, NSW, Australia',
      ipLabel: 'Not available from this sign-in',
      appUrl: 'https://example.test',
    });
    expect(mail.subject).toBe('New sign-in to your RisingAMP account');
    expect(mail.html).toMatch(/Northside Builds/);
    expect(mail.html).toMatch(/Mac · Chrome/);
    expect(mail.html).toMatch(/This was me/);
    expect(mail.html).toMatch(/Secure my account/);
    expect(mail.html).toMatch(/reset=1/);
    expect(mail.html).toMatch(/IP address/);
    expect(mail.html).not.toMatch(/Level 2, 44 Market Street/);
    expect(mail.html).not.toMatch(/var\(--/);
  });

  test('describeDevice is honest about unknown hardware', () => {
    const device = describeDevice('Mozilla/5.0 Chrome/120.0', 'MacIntel');
    expect(device.title).toMatch(/Chrome/);
  });

  test('location is inferred from timezone, not invented hardware', () => {
    expect(inferLocationLabel('Australia/Sydney')).toBe('Sydney, NSW, Australia');
    expect(inferLocationLabel('America/New_York')).toBe('Not available from this sign-in');
  });
});
