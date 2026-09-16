import { buildJobInviteEmail, buildNewSignInEmail, describeDevice, inferLocationLabel } from './risingAmpMail';

function anchors(html) {
  return html.match(/<a\b[^>]*>/g) || [];
}

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
    expect(mail.html).toMatch(/books@outlook\.com/);
    expect(mail.html).toMatch(/Open the job/);
    expect(mail.html).toMatch(/Google sign-in and a password both work/);
    expect(mail.html).not.toMatch(/sign in with Google using this same Gmail/i);
    expect(mail.html).not.toMatch(/72 Centenary/);
    expect(mail.html).not.toMatch(/var\(--/);
  });

  test('no mail relies on SVG, images, webfonts or non-inline CSS', () => {
    const invite = buildJobInviteEmail({
      inviterName: 'Alex',
      inviterEmail: 'alex@builder.com.au',
      projectName: '95 Tahmoor Rd Austral',
      appUrl: 'https://example.test',
      to: 'books@outlook.com',
    });
    const signIn = buildNewSignInEmail({
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
    for (const html of [invite.html, signIn.html]) {
      expect(html).not.toMatch(/<svg/i);
      expect(html).not.toMatch(/<img/i);
      expect(html).not.toMatch(/<style/i);
      expect(html).not.toMatch(/<link/i);
      expect(html).not.toMatch(/url\(/i);
      expect(html).not.toMatch(/fonts\.googleapis/i);
    }
  });

  test('every anchor sets its own color and text-decoration', () => {
    const invite = buildJobInviteEmail({
      inviterName: 'Alex',
      inviterEmail: 'alex@builder.com.au',
      projectName: '95 Tahmoor Rd Austral',
      appUrl: 'https://example.test',
      to: 'books@outlook.com',
    });
    const signIn = buildNewSignInEmail({
      displayName: 'Alex',
      to: 'alex@builder.com.au',
      deviceTitle: 'Mac · Chrome',
      deviceSubtitle: 'macOS',
      whenLabel: 'Sun, 23 Aug 2026, 10:00 am AEST',
      locationLabel: 'Sydney, NSW, Australia',
      ipLabel: 'Not available from this sign-in',
      appUrl: 'https://example.test',
    });
    for (const html of [invite.html, signIn.html]) {
      const links = anchors(html);
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) {
        expect(link).toMatch(/style="[^"]*color:/);
        expect(link).toMatch(/style="[^"]*text-decoration:/);
      }
    }
  });

  test('the job tile is the street number as live text', () => {
    const mail = buildJobInviteEmail({
      inviterName: 'Alex',
      inviterEmail: 'alex@builder.com.au',
      projectName: '95 Tahmoor Rd Austral',
      appUrl: 'https://example.test',
      to: 'books@outlook.com',
    });
    expect(mail.html).toMatch(/line-height:42px">95</);
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
