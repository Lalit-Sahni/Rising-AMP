'use strict';

const {
  needsObjectBytes,
  normalizedContentType,
} = require('../../functions/lib/extractJobFileText');

const OPAL_ORG_ID = 'opal-ss-constructions';

function parseReextractTarget(argv, projects) {
  const args = Array.isArray(argv) ? argv : [];
  const stagingProject = projects.stagingProject;
  const productionProject = projects.productionProject;
  if (args.includes('--production')) {
    throw new Error('Job-file re-extract refuses --production. Staging only.');
  }
  if (stagingProject === productionProject) {
    throw new Error('Staging and production IDs match. Stop.');
  }
  if (!args.includes('--staging')) {
    throw new Error('Pass --staging. Job-file re-extract refuses --production.');
  }
  const apply = args.includes('--apply');
  return {
    apply,
    dryRun: !apply,
    destination: stagingProject,
  };
}

function extractableContentType(file) {
  const type = normalizedContentType(file && file.contentType);
  if (needsObjectBytes(type)) return type;
  if (type && type !== 'application/octet-stream') return type;
  const name = String((file && file.name) || '').toLowerCase();
  const path = String((file && file.storagePath) || '').toLowerCase();
  if (name.endsWith('.pdf') || path.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.txt') || path.endsWith('.txt')) return 'text/plain';
  return type;
}

function skipReasonForType(type) {
  const normalized = normalizedContentType(type);
  if (normalized.startsWith('image/')) return 'image';
  return 'unsupported';
}

/**
 * Re-extract only PDFs and text/plain whose sibling is missing or error.
 * A sibling with textStatus none/ok/truncated/unsupported already ran
 * (empty PDF → none). Images and Word/Excel are never planned.
 */
function classifyReextract(file, content) {
  const type = extractableContentType(file);
  if (!needsObjectBytes(type)) {
    return { action: 'skip', reason: skipReasonForType(file && file.contentType), contentType: type };
  }
  if (!content || typeof content !== 'object') {
    return { action: 'extract', reason: 'missing', contentType: type };
  }
  const status = String(content.textStatus || '');
  if (status === 'error') {
    return { action: 'extract', reason: 'error', contentType: type };
  }
  return { action: 'skip', reason: 'already ok', contentType: type };
}

function planReextract(files) {
  const scanned = files || [];
  const skipped = [];
  const planned = [];
  scanned.forEach((file) => {
    const decision = classifyReextract(file, file.content);
    const row = {
      orgId: file.orgId,
      jobId: file.jobId,
      jobName: file.jobName,
      fileId: file.fileId,
      name: file.name,
      storagePath: file.storagePath,
      contentType: decision.contentType || normalizedContentType(file.contentType),
      reason: decision.reason,
    };
    if (decision.action === 'extract') planned.push(row);
    else skipped.push(row);
  });
  const skipCounts = { image: 0, unsupported: 0, 'already ok': 0 };
  skipped.forEach((row) => {
    if (skipCounts[row.reason] == null) skipCounts[row.reason] = 0;
    skipCounts[row.reason] += 1;
  });
  return {
    scanned: scanned.length,
    skipped,
    planned,
    skipCounts,
    writeCount: planned.length,
  };
}

module.exports = {
  OPAL_ORG_ID,
  classifyReextract,
  extractableContentType,
  parseReextractTarget,
  planReextract,
};
