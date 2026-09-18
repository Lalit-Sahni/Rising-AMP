// Parse the real stored receipts through the real schema and report failures.
import { actionReceiptSchema } from '../src/actions/core';

const fb = require('./lib/phase1Firebase');

function dec(v) {
  if (!v || typeof v !== 'object') return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.nullValue !== undefined) return null;
  if (v.timestampValue !== undefined) return new Date(v.timestampValue);
  if (v.mapValue) {
    const out = {};
    Object.entries(v.mapValue.fields || {}).forEach(([k, n]) => { out[k] = dec(n); });
    return out;
  }
  if (v.arrayValue) return (v.arrayValue.values || []).map(dec);
  return null;
}

async function main() {
  const t = await fb.getAccessToken();
  const recs = await fb.listDocuments(t, fb.docResourceName('rising-amp-staging', '(default)', 'organizations/opal-ss-constructions'), 'assistantReceipts');
  recs.forEach((d) => {
    const id = d.name.split('/').pop();
    const data = {};
    Object.entries(d.fields || {}).forEach(([k, v]) => { data[k] = dec(v); });
    const parsed = actionReceiptSchema.safeParse({ ...data, id: data.id || id });
    if (parsed.success) {
      console.log('OK   ', id);
    } else {
      console.log('FAIL ', id);
      parsed.error.issues.slice(0, 5).forEach((i) => console.log('       ', i.path.join('.'), '-', i.code, '-', i.message));
    }
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
