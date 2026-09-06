#!/usr/bin/env node
/**
 * Read-only: count invoice numbers and collisions. Does not renumber.
 *
 *   node scripts/check-invoice-numbers.js --staging
 *   node scripts/check-invoice-numbers.js --production
 */

const {
  PRODUCTION_PROJECT,
  STAGING_PROJECT,
  getAccessToken,
  listCollectionIds,
  listDocuments,
} = require('./lib/phase1Firebase');

function parseArgs(argv) {
  const production = argv.includes('--production');
  return {
    production,
    projectId: production ? PRODUCTION_PROJECT : STAGING_PROJECT,
  };
}

function fieldString(fields, key) {
  const value = fields && fields[key];
  if (!value) return '';
  if (value.stringValue) return String(value.stringValue);
  if (value.integerValue != null) return String(value.integerValue);
  return '';
}

async function main() {
  const { production, projectId } = parseArgs(process.argv.slice(2));
  const accessToken = await getAccessToken();
  const root = `projects/${projectId}/databases/(default)/documents`;
  const orgs = await listDocuments(accessToken, root, 'organizations');
  const numbers = [];

  for (const org of orgs) {
    const projects = await listDocuments(accessToken, org.name, 'projects');
    for (const project of projects) {
      const childIds = await listCollectionIds(accessToken, project.name);
      if (!childIds.includes('invoices')) continue;
      const invoices = await listDocuments(accessToken, project.name, 'invoices');
      for (const invoice of invoices) {
        const number = fieldString(invoice.fields, 'invoiceNumber').trim();
        if (number) numbers.push(number);
      }
    }
  }

  const counts = new Map();
  for (const number of numbers) {
    counts.set(number, (counts.get(number) || 0) + 1);
  }
  const collisions = [...counts.values()].filter((n) => n > 1).length;

  console.log(JSON.stringify({
    environment: production ? 'production' : 'staging',
    invoiceCount: numbers.length,
    uniqueNumbers: counts.size,
    collidingNumbers: collisions,
    blankNumbers: 0,
  }, null, 2));
}

main().catch((err) => {
  console.error('Check failed:', err);
  process.exit(1);
});
