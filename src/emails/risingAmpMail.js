/**
 * Professional RisingAMP HTML mail.
 * Layout follows design/risingamp-signin-email.html with inline hex colours
 * (Gmail ignores CSS variables). Staging cannot send branded mail from
 * security@risingamp.app. Live job invites go through the inviter’s Google
 * send path. Do not put a fake street address or Help Centre that does not exist.
 */

const ACCENT = '#E85D1A';
const STEEL = '#17181C';
const INK = '#1C1E23';
const SLATE = '#565B64';
const MUTED = '#8A9099';
const CANVAS = '#F5F6F8';
const SURFACE = '#FFFFFF';
const HAIRLINE = '#E7E9EC';
const POS = '#2E7D57';
const POS_TINT = '#E7F1EC';
const ACCENT_TINT = '#FCEEE4';
const ACCENT_600 = '#C64E12';
const FOOTER_MUTED = '#8B909A';
const FOOTER_DIM = '#5B606A';

const HELMET_18 = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.9" style="display:block;margin:8px auto" xmlns="http://www.w3.org/2000/svg"><path d="M4 15.5V13a8 8 0 0 1 16 0v2.5"/><path d="M9 6.5V4h6v2.5"/><path d="M3 15.5h18v2H3z"/></svg>`;
const HELMET_13 = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" style="display:block;margin:6.5px auto" xmlns="http://www.w3.org/2000/svg"><path d="M4 15.5V13a8 8 0 0 1 16 0v2.5"/><path d="M9 6.5V4h6v2.5"/><path d="M3 15.5h18v2H3z"/></svg>`;
const SHIELD = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${POS}" stroke-width="2" style="display:block;margin:12px auto" xmlns="http://www.w3.org/2000/svg"><path d="M12 2 3 6v6c0 5 3.8 8.7 9 10 5.2-1.3 9-5 9-10V6z"/><path d="m9 12 2 2 4-4"/></svg>`;
const DEVICE = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="${SLATE}" stroke-width="1.7" style="display:block;margin:9.5px auto" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`;
const BRIEFCASE = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="${SLATE}" stroke-width="1.7" style="display:block;margin:9.5px auto" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;

export function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function logoCell(size, svg) {
  const radius = size >= 32 ? 9 : 7;
  return `<td style="width:${size}px;height:${size}px;border-radius:${radius}px;background:${ACCENT};text-align:center;vertical-align:middle">${svg}</td>`;
}

function kvRow(label, value, { last = false } = {}) {
  const pad = last ? '9px 18px 16px' : '9px 18px';
  return `<tr>
    <td style="padding:${pad};font-size:12.5px;color:${SLATE};width:40%">${label}</td>
    <td style="padding:${pad};font-size:12.5px;color:${INK};font-weight:700;text-align:right">${value}</td>
  </tr>`;
}

function emailChrome({ innerHtml, footerNote }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>RisingAMP</title>
</head>
<body style="margin:0;padding:0;background:${CANVAS};color:${INK};font-family:Manrope,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};padding:28px 12px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:${SURFACE};border-radius:16px;overflow:hidden;border:1px solid ${HAIRLINE}">
      <tr>
        <td style="background:${STEEL};padding:26px 32px">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            ${logoCell(34, HELMET_18)}
            <td style="padding-left:10px;font-size:15px;font-weight:800;color:#ffffff;letter-spacing:-0.01em">RisingAMP</td>
          </tr></table>
        </td>
      </tr>
      ${innerHtml}
      <tr>
        <td style="background:${STEEL};padding:26px 32px">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            ${logoCell(26, HELMET_13)}
            <td style="padding-left:9px;font-size:13px;font-weight:800;color:#ffffff">RisingAMP</td>
          </tr></table>
          <p style="font-size:11.5px;line-height:1.7;color:${FOOTER_MUTED};margin:14px 0 0">
            Know where every dollar goes, and what needs you today.
          </p>
          <p style="font-size:11px;color:${FOOTER_DIM};margin:16px 0 0">${escapeHtml(footerNote || '© 2026 RisingAMP. All rights reserved.')}</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export function buildJobInviteEmail({ inviterName, inviterEmail, projectName, appUrl, to }) {
  const name = escapeHtml(inviterName || 'A teammate');
  const job = escapeHtml(projectName || 'a job');
  const url = escapeHtml(appUrl || 'https://rising-amp-467702-b5.web.app');
  const signInAs = escapeHtml(to || '');
  const fromLine = escapeHtml(inviterEmail || '');

  const inner = `
      <tr>
        <td style="padding:38px 32px 8px">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:46px;height:46px;border-radius:12px;background:${POS_TINT};text-align:center;vertical-align:middle">${SHIELD}</td>
          </tr></table>
          <h1 style="font-size:22px;font-weight:800;letter-spacing:-0.02em;margin:18px 0 8px;color:${INK}">You're invited to ${job}</h1>
          <p style="font-size:14.5px;line-height:1.6;color:${SLATE};margin:0 0 4px;max-width:480px">
            ${name} added you to <b style="color:${INK}">${job}</b> on RisingAMP. Sign in with this email and you will only see this job — not the others.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:22px 32px 6px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};border:1px solid ${HAIRLINE};border-radius:12px">
            <tr>
              <td style="padding:16px 18px 6px" colspan="2">
                <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                  <td style="width:36px;height:36px;border-radius:9px;background:${SURFACE};border:1px solid ${HAIRLINE};text-align:center;vertical-align:middle">${BRIEFCASE}</td>
                  <td style="padding-left:11px">
                    <div style="font-size:13.5px;font-weight:700;color:${INK}">${job}</div>
                    <div style="font-size:11.5px;color:${MUTED}">RisingAMP job</div>
                  </td>
                </tr></table>
              </td>
            </tr>
            <tr><td colspan="2" style="padding:0 18px"><div style="height:1px;background:${HAIRLINE};margin:14px 0 4px"></div></td></tr>
            ${kvRow('Invited by', `${name}${fromLine ? ` · ${fromLine}` : ''}`)}
            ${kvRow('Sign in with', signInAs, { last: true })}
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 32px 6px">
          <a href="${url}" style="display:inline-block;background:${ACCENT};color:#ffffff;font-family:Manrope,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13.5px;font-weight:700;padding:12px 20px;border-radius:9px;text-decoration:none">Open RisingAMP</a>
        </td>
      </tr>
      <tr>
        <td style="padding:22px 32px 4px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${ACCENT_TINT};border-radius:12px">
            <tr>
              <td style="padding:14px 16px;font-size:12.5px;line-height:1.6;color:${INK}">
                <b style="color:${ACCENT_600}">New here?</b> Create an account with this email — Google or email and password both work. If you were not expecting this, you can ignore it.
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr><td style="padding:26px 32px 0"><div style="height:1px;background:${HAIRLINE}"></div></td></tr>
      <tr>
        <td style="padding:20px 32px 30px">
          <p style="font-size:12.5px;line-height:1.6;color:${MUTED};margin:0">
            Sent because ${name} invited ${signInAs || 'you'} to a job on RisingAMP.
          </p>
        </td>
      </tr>`;

  const html = emailChrome({
    innerHtml: inner,
    footerNote: '© 2026 RisingAMP. All rights reserved.',
  });
  const text = [
    `You're invited to ${projectName} on RisingAMP.`,
    '',
    `${inviterName || 'A teammate'} added you to this job.`,
    `Open ${appUrl} and sign in with ${to}.`,
    '',
    'Google or email and password both work. You will only see this job, not the others.',
  ].join('\n');

  return {
    subject: `You're invited to ${projectName} on RisingAMP`,
    html,
    text,
  };
}

export function describeDevice(userAgent = '', platform = '') {
  const ua = String(userAgent || '');
  const os = /Mac OS X|macOS/i.test(ua) || /Mac/i.test(platform)
    ? 'macOS'
    : /Windows/i.test(ua)
      ? 'Windows'
      : /Android/i.test(ua)
        ? 'Android'
        : /iPhone|iPad/i.test(ua)
          ? 'iOS'
          : platform || 'Unknown device';
  const browser = /Edg\//i.test(ua)
    ? 'Edge'
    : /Chrome/i.test(ua)
      ? 'Chrome'
      : /Safari/i.test(ua)
        ? 'Safari'
        : /Firefox/i.test(ua)
          ? 'Firefox'
          : 'Browser';
  const machine = os === 'macOS' ? 'Mac' : os === 'iOS' ? 'iPhone' : os === 'Android' ? 'Android' : os;
  return { title: `${machine} · ${browser}`, subtitle: os };
}

export function formatSignInTime(now = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
      timeZone: 'Australia/Sydney',
    }).format(now);
  } catch (error) {
    return now.toISOString();
  }
}

export function inferLocationLabel(timeZone) {
  if (timeZone === 'Australia/Sydney' || timeZone === 'Australia/Melbourne') {
    return timeZone === 'Australia/Melbourne' ? 'Melbourne, VIC, Australia' : 'Sydney, NSW, Australia';
  }
  if (timeZone === 'Australia/Brisbane') return 'Brisbane, QLD, Australia';
  if (timeZone === 'Australia/Perth') return 'Perth, WA, Australia';
  if (timeZone === 'Australia/Adelaide') return 'Adelaide, SA, Australia';
  if (timeZone && String(timeZone).startsWith('Australia/')) return 'Australia';
  return 'Not available from this sign-in';
}

export function buildNewSignInEmail({
  displayName,
  businessName,
  to,
  deviceTitle,
  deviceSubtitle,
  whenLabel,
  locationLabel,
  ipLabel,
  appUrl,
}) {
  const who = escapeHtml(displayName || 'there');
  const company = escapeHtml(businessName || '');
  const url = escapeHtml(appUrl || 'https://rising-amp-467702-b5.web.app');
  const resetUrl = `${url}${url.includes('?') ? '&' : '?'}reset=1`;
  const companyBit = businessName
    ? ` at <b style="color:${INK}">${company}</b>`
    : '';

  const inner = `
      <tr>
        <td style="padding:38px 32px 8px">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:46px;height:46px;border-radius:12px;background:${POS_TINT};text-align:center;vertical-align:middle">${SHIELD}</td>
          </tr></table>
          <h1 style="font-size:22px;font-weight:800;letter-spacing:-0.02em;margin:18px 0 8px;color:${INK}">New sign-in to your account</h1>
          <p style="font-size:14.5px;line-height:1.6;color:${SLATE};margin:0 0 4px;max-width:480px">
            Hi ${who}, we noticed a new sign-in to your RisingAMP account${companyBit}. If this was you, there is nothing else you need to do.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:22px 32px 6px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};border:1px solid ${HAIRLINE};border-radius:12px">
            <tr>
              <td style="padding:16px 18px 6px" colspan="2">
                <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                  <td style="width:36px;height:36px;border-radius:9px;background:${SURFACE};border:1px solid ${HAIRLINE};text-align:center;vertical-align:middle">${DEVICE}</td>
                  <td style="padding-left:11px">
                    <div style="font-size:13.5px;font-weight:700;color:${INK}">${escapeHtml(deviceTitle || 'Signed-in device')}</div>
                    <div style="font-size:11.5px;color:${MUTED}">${escapeHtml(deviceSubtitle || '')}</div>
                  </td>
                </tr></table>
              </td>
            </tr>
            <tr><td colspan="2" style="padding:0 18px"><div style="height:1px;background:${HAIRLINE};margin:14px 0 4px"></div></td></tr>
            ${kvRow('Time', escapeHtml(whenLabel || ''))}
            ${kvRow('Location', escapeHtml(locationLabel || 'Not available from this sign-in'))}
            ${kvRow('IP address', escapeHtml(ipLabel || 'Not available from this sign-in'), { last: true })}
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 32px 6px">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
            <td style="width:1%">
              <a href="${url}" style="display:inline-block;background:${ACCENT};color:#ffffff;font-family:Manrope,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13.5px;font-weight:700;padding:12px 20px;border-radius:9px;white-space:nowrap;text-decoration:none">This was me</a>
            </td>
            <td style="padding-left:10px">
              <a href="${resetUrl}" style="display:inline-block;background:${SURFACE};color:${INK};border:1px solid ${HAIRLINE};font-family:Manrope,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13.5px;font-weight:700;padding:11px 19px;border-radius:9px;white-space:nowrap;text-decoration:none">Secure my account</a>
            </td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="padding:22px 32px 4px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${ACCENT_TINT};border-radius:12px">
            <tr>
              <td style="padding:14px 16px;font-size:12.5px;line-height:1.6;color:${INK}">
                <b style="color:${ACCENT_600}">Didn't sign in?</b> Someone else may have your password. Reset it straight away from the sign-in page.
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr><td style="padding:26px 32px 0"><div style="height:1px;background:${HAIRLINE}"></div></td></tr>
      <tr>
        <td style="padding:20px 32px 30px">
          <p style="font-size:12.5px;line-height:1.6;color:${MUTED};margin:0">
            This is an automated security notice sent to <span style="color:${SLATE}">${escapeHtml(to)}</span> because a new sign-in was recorded on this account.
          </p>
        </td>
      </tr>`;

  return {
    subject: 'New sign-in to your RisingAMP account',
    html: emailChrome({
      innerHtml: inner,
      footerNote: '© 2026 RisingAMP. All rights reserved.',
    }),
    text: [
      'New sign-in to your RisingAMP account.',
      '',
      `Device: ${deviceTitle || ''} (${deviceSubtitle || ''})`,
      `Time: ${whenLabel || ''}`,
      `Location: ${locationLabel || 'Not available'}`,
      `IP address: ${ipLabel || 'Not available'}`,
      '',
      'If this was you, there is nothing else to do. If it was not you, reset your password from the sign-in page.',
    ].join('\n'),
  };
}
