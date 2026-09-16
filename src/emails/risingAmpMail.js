/**
 * Professional RisingAMP HTML mail.
 * Layout follows design/risingamp-invite-email-v2.html. Rules it enforces:
 * no SVG anywhere (Apple Mail, Gmail and Outlook strip it), no images
 * (clients block remote images on first open), tables and inline styles
 * only (Outlook renders through Word), a font stack rather than a webfont,
 * and an explicit color and text-decoration on every anchor so no client
 * paints a link default blue. Job invites are sent from
 * invites@risingamp.com.au via the sendJobInviteEmail Cloud Function
 * (Resend), with the old Gmail send path as fallback.
 * Do not put a fake street address or Help Centre that does not exist.
 */

const ACCENT = '#E85D1A';
const STEEL = '#17181C';
const INK = '#1C1E23';
const SLATE = '#565B64';
const MUTED = '#8A9099';
const CANVAS = '#F5F6F8';
const SURFACE = '#FFFFFF';
const HAIRLINE = '#E7E9EC';
const ACCENT_600 = '#C64E12';
const ACCENT_TINT = '#FCEEE4';
const FOOTER_DIM = '#B6BAC1';
const FONT = "Manrope,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * The job tile is live text on a tint background, not an icon: the street
 * number when the job name starts with one, otherwise the first letter.
 * There is nothing for a mail client to strip.
 */
function jobTileMark(projectName) {
  const name = String(projectName || '').trim();
  const number = name.match(/^(\d+[A-Za-z]?)/);
  if (number) return escapeHtml(number[1]);
  return escapeHtml((name.charAt(0) || 'J').toUpperCase());
}

function wordmark() {
  return `<span style="font-size:16px;font-weight:800;letter-spacing:-0.01em;color:#FFFFFF;line-height:1">Rising<span style="color:${ACCENT}">AMP</span></span>`;
}

function emailChrome({ innerHtml, sectionLabel }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>RisingAMP</title>
</head>
<body style="margin:0;padding:0;background:${CANVAS};color:${INK};font-family:${FONT}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS}">
  <tr><td align="center" style="padding:28px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:${SURFACE};border-radius:14px;overflow:hidden;border:1px solid ${HAIRLINE}">
      <tr>
        <td style="background:${STEEL};padding:20px 28px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td>${wordmark()}</td>
            <td align="right" style="font-size:10px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:${MUTED};line-height:1">${escapeHtml(sectionLabel || '')}</td>
          </tr></table>
        </td>
      </tr>
      <tr><td style="background:${ACCENT};font-size:0;line-height:0;height:3px">&nbsp;</td></tr>
      ${innerHtml}
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function docketLabel(label) {
  return `<div style="font-size:9.5px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:${MUTED};padding-bottom:4px">${label}</div>`;
}

function docketRow({ label, valueHtml, first = false, last = false }) {
  const border = last ? '' : `border-bottom:1px solid ${HAIRLINE};`;
  const pad = `13px 18px${last ? ' 15px' : ''}`;
  return `<tr><td style="padding:${pad};${border}">
    ${docketLabel(label)}
    <div style="font-size:13.5px;color:${INK};font-weight:600;word-break:break-word">${valueHtml}</div>
  </td></tr>`;
}

function footerRow(lines) {
  return `<tr><td style="padding:26px 28px 24px">
    <div style="border-top:1px solid ${HAIRLINE};padding-top:16px;font-size:11.5px;line-height:1.65;color:${MUTED}">
      ${lines}<br>
      <span style="color:${FOOTER_DIM}">RisingAMP, Sydney NSW</span>
    </div>
  </td></tr>`;
}

export function buildJobInviteEmail({ inviterName, inviterEmail, projectName, appUrl, to }) {
  const name = escapeHtml(inviterName || 'A teammate');
  const job = escapeHtml(projectName || 'a job');
  const url = escapeHtml(appUrl || 'https://rising-amp-467702-b5.web.app');
  const signInAs = escapeHtml(to || '');
  const fromLine = escapeHtml(inviterEmail || '');
  let host = 'risingamp.com.au';
  try {
    host = new URL(appUrl || 'https://risingamp.com.au').host;
  } catch (error) {
    // keep the default host
  }

  const inner = `
      <tr>
        <td style="padding:36px 28px 0">
          <div style="font-size:10.5px;font-weight:700;letter-spacing:0.17em;text-transform:uppercase;color:${MUTED};padding-bottom:13px">You have been added to a job</div>
          <div style="font-size:29px;line-height:1.14;font-weight:800;letter-spacing:-0.03em;color:${INK}">${job}</div>
          <div style="font-size:14.5px;line-height:1.62;color:${SLATE};padding-top:14px">
            ${name} added you to this job on RisingAMP. Sign in with the address
            below and you will see this job only, nothing else on the account.
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:26px 28px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};border:1px solid ${HAIRLINE};border-radius:11px">
            <tr><td style="padding:16px 18px 14px;border-bottom:1px solid ${HAIRLINE}">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="width:42px;height:42px;background:${ACCENT_TINT};border-radius:9px;text-align:center;font-size:15px;font-weight:800;letter-spacing:-0.02em;color:${ACCENT_600};line-height:42px">${jobTileMark(projectName)}</td>
                <td style="padding-left:13px">
                  <div style="font-size:14.5px;font-weight:700;color:${INK};letter-spacing:-0.012em;line-height:1.3">${job}</div>
                  <div style="font-size:11.5px;color:${MUTED};padding-top:3px;letter-spacing:0.01em">RisingAMP job</div>
                </td>
              </tr></table>
            </td></tr>
            ${docketRow({
              label: 'Invited by',
              valueHtml: `${name}${fromLine ? `<div style="font-size:12.5px;padding-top:2px"><a href="mailto:${fromLine}" style="color:${ACCENT_600};text-decoration:none">${fromLine}</a></div>` : ''}`,
            })}
            ${docketRow({ label: 'Sign in with', valueHtml: signInAs, last: true })}
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:22px 28px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td align="center" style="background:${ACCENT};border-radius:10px">
              <a href="${url}" style="display:block;padding:15px 20px;font-family:${FONT};font-size:14.5px;font-weight:700;letter-spacing:-0.005em;color:#FFFFFF;text-decoration:none">Open the job</a>
            </td>
          </tr></table>
          <div style="font-size:11.5px;color:${MUTED};text-align:center;padding-top:11px;line-height:1.5">
            Or paste this into your browser: <span style="color:${SLATE}">${escapeHtml(host)}</span>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 28px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="border-left:3px solid ${HAIRLINE};padding:2px 0 2px 14px;font-size:12.5px;line-height:1.6;color:${SLATE}">
              <b style="color:${INK};font-weight:700">New to RisingAMP?</b> Create an account with this
              same address. Google sign-in and a password both work. If you were not
              expecting this, ignore it and nothing happens.
            </td>
          </tr></table>
        </td>
      </tr>
      ${footerRow(`Sent because ${name} invited ${signInAs || 'you'} to a job on RisingAMP.`)}`;

  const html = emailChrome({ innerHtml: inner, sectionLabel: 'Job invite' });
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
        <td style="padding:36px 28px 0">
          <div style="font-size:10.5px;font-weight:700;letter-spacing:0.17em;text-transform:uppercase;color:${MUTED};padding-bottom:13px">Account security</div>
          <div style="font-size:29px;line-height:1.14;font-weight:800;letter-spacing:-0.03em;color:${INK}">New sign-in to your account</div>
          <div style="font-size:14.5px;line-height:1.62;color:${SLATE};padding-top:14px">
            Hi ${who}, we noticed a new sign-in to your RisingAMP account${companyBit}. If this was you, there is nothing else you need to do.
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:26px 28px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};border:1px solid ${HAIRLINE};border-radius:11px">
            ${docketRow({
              label: 'Device',
              valueHtml: `${escapeHtml(deviceTitle || 'Signed-in device')}${deviceSubtitle ? `<div style="font-size:11.5px;color:${MUTED};padding-top:3px;letter-spacing:0.01em">${escapeHtml(deviceSubtitle)}</div>` : ''}`,
              first: true,
            })}
            ${docketRow({ label: 'Time', valueHtml: escapeHtml(whenLabel || '') })}
            ${docketRow({ label: 'Location', valueHtml: escapeHtml(locationLabel || 'Not available from this sign-in') })}
            ${docketRow({ label: 'IP address', valueHtml: escapeHtml(ipLabel || 'Not available from this sign-in'), last: true })}
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:22px 28px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td align="center" style="background:${ACCENT};border-radius:10px">
              <a href="${url}" style="display:block;padding:15px 20px;font-family:${FONT};font-size:14.5px;font-weight:700;letter-spacing:-0.005em;color:#FFFFFF;text-decoration:none">This was me</a>
            </td>
          </tr></table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px"><tr>
            <td align="center" style="background:${SURFACE};border:1px solid ${HAIRLINE};border-radius:10px">
              <a href="${resetUrl}" style="display:block;padding:14px 20px;font-family:${FONT};font-size:14.5px;font-weight:700;letter-spacing:-0.005em;color:${INK};text-decoration:none">Secure my account</a>
            </td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 28px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="border-left:3px solid ${HAIRLINE};padding:2px 0 2px 14px;font-size:12.5px;line-height:1.6;color:${SLATE}">
              <b style="color:${INK};font-weight:700">Didn't sign in?</b> Someone else may have your password. Reset it straight away from the sign-in page.
            </td>
          </tr></table>
        </td>
      </tr>
      ${footerRow(`This is an automated security notice sent to <span style="color:${SLATE}">${escapeHtml(to)}</span> because a new sign-in was recorded on this account.`)}`;

  return {
    subject: 'New sign-in to your RisingAMP account',
    html: emailChrome({ innerHtml: inner, sectionLabel: 'Security notice' }),
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
