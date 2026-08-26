const SKIP_WORDS = new Set(['pty', 'ltd', 'limited', 'inc', 'warehouse']);

export function canonicalPartyName(value) {
  const lowered = String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!lowered) return '';
  return lowered
    .split(' ')
    .filter((word) => word && !SKIP_WORDS.has(word))
    .join(' ');
}

export function namesMatch(a, b) {
  const left = canonicalPartyName(a);
  const right = canonicalPartyName(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  if (shorter.length < 5) return false;
  return longer === shorter || longer.startsWith(`${shorter} `) || longer.startsWith(shorter);
}

export function isLiveDirectoryRow(row) {
  const status = String((row && row.status) || 'active').toLowerCase();
  return status === 'active';
}

function richness(row, getName) {
  const name = String(getName(row) || '').trim();
  const email = String((row && row.email) || '').trim();
  const address = String((row && row.address) || '').trim();
  const rate = Number(row && row.rate) || 0;
  return (
    name.length +
    (email.includes('@') ? 20 : 0) +
    (address && address.toLowerCase() !== 'na' ? 10 : 0) +
    (rate > 0 ? 5 : 0)
  );
}

export function uniqueByName(rows, getName = (row) => row && row.name) {
  const out = [];
  for (const row of rows || []) {
    if (!row || !isLiveDirectoryRow(row)) continue;
    const idx = out.findIndex((existing) => namesMatch(getName(existing), getName(row)));
    if (idx === -1) {
      out.push(row);
    } else if (richness(row, getName) > richness(out[idx], getName)) {
      out[idx] = row;
    }
  }
  return out;
}

export function upsertNamedRow(list, item, getName = (row) => row && row.name) {
  const next = Array.isArray(list) ? list.slice() : [];
  if (!item) return next;
  const idx = next.findIndex((row) => namesMatch(getName(row), getName(item)));
  if (idx === -1) return [item, ...next];
  next[idx] = { ...next[idx], ...item, id: item.id || next[idx].id };
  return next;
}
