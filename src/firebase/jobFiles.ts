import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from './config';
import { getActiveOrgId } from './tenancy';
import { jobFileSchema, parseAtBoundary, type JobFile } from '../domain/schemas';
import {
  JOB_FILE_MAX_BYTES,
  jobFileStoragePath,
  jobFileThumbnailPath,
  type JobFileLinkedTo,
} from '../domain/jobFiles';

export { JOB_FILE_MAX_BYTES, jobFileStoragePath, jobFileThumbnailPath };

function definedFields(data: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  Object.entries(data || {}).forEach(([key, value]) => {
    if (value !== undefined) out[key] = value;
  });
  return out;
}

function filesCol(jobId: string) {
  return collection(db, 'organizations', getActiveOrgId(), 'projects', jobId, 'files');
}

function fileRef(jobId: string, fileId: string) {
  return doc(db, 'organizations', getActiveOrgId(), 'projects', jobId, 'files', fileId);
}

async function assertJob(jobId: string) {
  if (!jobId) {
    throw new Error('Missing job');
  }
  const projectRef = doc(db, 'organizations', getActiveOrgId(), 'projects', jobId);
  const snap = await getDoc(projectRef);
  if (!snap.exists()) {
    throw new Error('Job list not found');
  }
  return projectRef;
}

function issuesToError(issues: string[]) {
  return issues[0] || 'That file record is not valid';
}

export type JobFileWrite = {
  id?: string;
  name: string;
  type: JobFile['type'];
  storagePath: string;
  thumbnailPath?: string | null;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
  documentDate: string;
  note?: string;
  linkedTo?: JobFileLinkedTo | null;
};

export async function fetchJobFiles(jobId: string): Promise<{
  success: boolean;
  files: JobFile[];
  error?: string;
}> {
  try {
    await assertJob(jobId);
    const snap = await getDocs(filesCol(jobId));
    const files: JobFile[] = [];
    snap.forEach((row) => {
      const parsed = parseAtBoundary(jobFileSchema, { id: row.id, ...row.data() });
      files.push(parsed.data as JobFile);
    });
    files.sort((a, b) => String(b.documentDate || '').localeCompare(String(a.documentDate || '')));
    return { success: true, files };
  } catch (error) {
    return { success: false, files: [], error: error instanceof Error ? error.message : String(error) };
  }
}

export async function createJobFileRecord(jobId: string, input: JobFileWrite): Promise<{
  success: boolean;
  file?: JobFile;
  error?: string;
}> {
  try {
    await assertJob(jobId);
    const fileId = input.id || doc(filesCol(jobId)).id;
    const parsed = parseAtBoundary(jobFileSchema, {
      ...input,
      id: fileId,
      jobId,
      status: 'active',
      archivedAt: null,
    });
    if (!parsed.ok) {
      return { success: false, error: issuesToError(parsed.issues) };
    }
    const expectedPrefix = `files/${getActiveOrgId()}/${jobId}/${fileId}/`;
    if (!parsed.data.storagePath.startsWith(expectedPrefix)) {
      return { success: false, error: 'That file does not belong on this job' };
    }
    await setDoc(fileRef(jobId, fileId), definedFields({
      ...parsed.data,
      id: fileId,
      jobId,
      status: 'active',
      archivedAt: null,
      uploadedAt: serverTimestamp(),
    }));
    return {
      success: true,
      file: {
        ...parsed.data,
        id: fileId,
        jobId,
        status: 'active',
        archivedAt: null,
        uploadedAt: new Date(),
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function updateJobFileRecord(
  jobId: string,
  fileId: string,
  patch: Partial<Pick<JobFile, 'name' | 'type' | 'note' | 'documentDate' | 'linkedTo' | 'thumbnailPath'>>,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!fileId) return { success: false, error: 'File ID is required' };
    await assertJob(jobId);
    const snap = await getDoc(fileRef(jobId, fileId));
    if (!snap.exists()) {
      return { success: false, error: 'File not found' };
    }
    const parsed = parseAtBoundary(jobFileSchema, {
      ...snap.data(),
      ...patch,
      id: fileId,
      jobId,
    });
    if (!parsed.ok) {
      return { success: false, error: issuesToError(parsed.issues) };
    }
    await updateDoc(fileRef(jobId, fileId), {
      name: parsed.data.name,
      type: parsed.data.type,
      note: parsed.data.note || '',
      documentDate: parsed.data.documentDate,
      linkedTo: parsed.data.linkedTo ?? null,
      thumbnailPath: parsed.data.thumbnailPath ?? null,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function archiveJobFile(jobId: string, fileId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    if (!fileId) return { success: false, error: 'File ID is required' };
    await assertJob(jobId);
    const snap = await getDoc(fileRef(jobId, fileId));
    if (!snap.exists()) {
      return { success: false, error: 'File not found' };
    }
    await updateDoc(fileRef(jobId, fileId), {
      status: 'archived',
      archivedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function restoreJobFile(jobId: string, fileId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    if (!fileId) return { success: false, error: 'File ID is required' };
    await assertJob(jobId);
    const snap = await getDoc(fileRef(jobId, fileId));
    if (!snap.exists()) {
      return { success: false, error: 'File not found' };
    }
    await updateDoc(fileRef(jobId, fileId), {
      status: 'active',
      archivedAt: deleteField(),
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
