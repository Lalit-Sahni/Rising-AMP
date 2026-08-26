const SKIP_WORDS = new Set(['pty', 'ltd', 'limited', 'inc', 'warehouse']);

function canonicalPartyName(value) {
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

function namesMatch(a, b) {
  const left = canonicalPartyName(a);
  const right = canonicalPartyName(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  if (shorter.length < 5) return false;
  return longer === shorter || longer.startsWith(`${shorter} `) || longer.startsWith(shorter);
}

function isLiveDirectoryRow(row) {
  const status = String((row && row.status) || 'active').toLowerCase();
  return status === 'active';
}

module.exports = {
  canonicalPartyName,
  namesMatch,
  isLiveDirectoryRow,
};
