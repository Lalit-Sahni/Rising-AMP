/**
 * Shared helpers for Phase 1 backup/restore.
 * Uses the logged-in Firebase CLI token (read/write via Google APIs).
 * No new npm packages.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const PRODUCTION_PROJECT = 'rising-amp-467702-b5';
const STAGING_PROJECT = 'rising-amp-staging';
const PRODUCTION_BUCKET = 'rising-amp-467702-b5.firebasestorage.app';
const STAGING_BUCKET = 'rising-amp-staging.firebasestorage.app';

function loadCliTokens() {
  const tokenPath = path.join(os.homedir(), '.config/configstore/firebase-tools.json');
  const cfg = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
  if (!cfg.tokens || !cfg.tokens.refresh_token) {
    throw new Error('Firebase CLI is not logged in. Run: firebase login');
  }
  return cfg.tokens;
}

async function getAccessToken() {
  let tokens = loadCliTokens();
  const expiresAt = Number(tokens.expires_at || 0);
  if (tokens.access_token && expiresAt > Date.now() + 60 * 1000) {
    return tokens.access_token;
  }
  execFileSync('firebase', ['projects:list', '--non-interactive'], { stdio: 'pipe' });
  tokens = loadCliTokens();
  if (!tokens.access_token) {
    throw new Error('Firebase CLI is logged in but did not return an access token.');
  }
  return tokens.access_token;
}

async function googleFetch(url, { method = 'GET', body, accessToken, headers = {} } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 500) };
    }
  }
  return { ok: res.ok, status: res.status, json, text, res };
}

function documentsBase(projectId, databaseId) {
  const db = encodeURIComponent(databaseId);
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${db}/documents`;
}

function docResourceName(projectId, databaseId, docPath) {
  return `projects/${projectId}/databases/${databaseId}/documents/${docPath}`;
}

async function listCollectionIds(accessToken, parentName) {
  const url = `https://firestore.googleapis.com/v1/${parentName}:listCollectionIds`;
  const ids = [];
  let pageToken;
  do {
    const { ok, status, json } = await googleFetch(url, {
      method: 'POST',
      accessToken,
      body: pageToken ? { pageToken, pageSize: 100 } : { pageSize: 100 },
    });
    if (!ok) {
      throw new Error(`listCollectionIds ${status} ${JSON.stringify(json)}`);
    }
    ids.push(...(json.collectionIds || []));
    pageToken = json.nextPageToken;
  } while (pageToken);
  return ids;
}

async function listDocuments(accessToken, parentName, collectionId) {
  const docs = [];
  let pageToken;
  do {
    const params = new URLSearchParams({ pageSize: '100' });
    if (pageToken) params.set('pageToken', pageToken);
    const url = `https://firestore.googleapis.com/v1/${parentName}/${encodeURIComponent(collectionId)}?${params}`;
    const { ok, status, json } = await googleFetch(url, { accessToken });
    if (!ok) {
      throw new Error(`listDocuments ${collectionId} ${status} ${JSON.stringify(json)}`);
    }
    docs.push(...(json.documents || []));
    pageToken = json.nextPageToken;
  } while (pageToken);
  return docs;
}

function relativeDocPath(documentName) {
  const marker = '/documents/';
  const idx = documentName.indexOf(marker);
  if (idx === -1) throw new Error(`Unexpected document name: ${documentName}`);
  return documentName.slice(idx + marker.length);
}

async function exportDatabase(accessToken, projectId, databaseId) {
  const rootName = `projects/${projectId}/databases/${databaseId}/documents`;
  const records = [];
  const countsByCollection = {};

  async function walk(parentName, collectionId) {
    const docs = await listDocuments(accessToken, parentName, collectionId);
    for (const doc of docs) {
      const rel = relativeDocPath(doc.name);
      records.push({
        path: rel,
        fields: doc.fields || {},
        createTime: doc.createTime || null,
        updateTime: doc.updateTime || null,
      });
      const top = rel.split('/')[0];
      const col = rel.split('/').length >= 2 ? rel.split('/')[1] : top;
      // Count by first subcollection under users/{code}/{col}
      const parts = rel.split('/');
      const bucket = parts.length >= 3 ? parts[2] : '(user-doc)';
      countsByCollection[bucket] = (countsByCollection[bucket] || 0) + 1;

      const childIds = await listCollectionIds(accessToken, doc.name);
      for (const childId of childIds) {
        await walk(doc.name, childId);
      }
    }
  }

  const rootIds = await listCollectionIds(accessToken, rootName);
  for (const id of rootIds) {
    await walk(rootName, id);
  }

  return { rootCollectionIds: rootIds, documents: records, countsByCollection };
}

async function listStorageObjects(accessToken, bucket) {
  const objects = [];
  let pageToken;
  do {
    const params = new URLSearchParams({ maxResults: '1000' });
    if (pageToken) params.set('pageToken', pageToken);
    const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o?${params}`;
    const { ok, status, json } = await googleFetch(url, { accessToken });
    if (!ok) {
      return { ok: false, status, error: json, objects: [] };
    }
    objects.push(...(json.items || []));
    pageToken = json.nextPageToken;
  } while (pageToken);
  return { ok: true, objects };
}

async function downloadStorageObject(accessToken, bucket, objectName, destPath) {
  const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}?alt=media`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new Error(`download ${objectName} HTTP ${res.status}`);
  }
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
  return buf.length;
}

async function uploadStorageObject(accessToken, bucket, objectName, filePath, contentType) {
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(objectName)}`;
  const buf = fs.readFileSync(filePath);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': contentType || 'application/octet-stream',
    },
    body: buf,
  });
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, body: text.slice(0, 400) };
  }
  return { ok: true, status: res.status };
}

async function batchWrite(accessToken, projectId, databaseId, writes) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${encodeURIComponent(databaseId)}/documents:batchWrite`;
  const { ok, status, json } = await googleFetch(url, {
    method: 'POST',
    accessToken,
    body: { writes },
  });
  if (!ok) {
    throw new Error(`batchWrite ${status} ${JSON.stringify(json).slice(0, 800)}`);
  }
  return json;
}

module.exports = {
  PRODUCTION_PROJECT,
  STAGING_PROJECT,
  PRODUCTION_BUCKET,
  STAGING_BUCKET,
  getAccessToken,
  googleFetch,
  documentsBase,
  docResourceName,
  listCollectionIds,
  listDocuments,
  relativeDocPath,
  exportDatabase,
  listStorageObjects,
  downloadStorageObject,
  uploadStorageObject,
  batchWrite,
};
