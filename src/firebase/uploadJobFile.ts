import { todayYmd } from '../dates';
import {
  JOB_FILE_MAX_BYTES,
  isRasterImageContentType,
  jobFileCompressOutputType,
  jobFileStoragePath,
  jobFileThumbnailPath,
  safeJobFileName,
  validateJobFileForUpload,
  type JobFileType,
} from '../domain/jobFiles';
import type { JobFile } from '../domain/schemas';
import { getCurrentUser } from './auth';
import { createJobFileRecord, newJobFileId } from './jobFiles';
import {
  compressImage,
  generateImageThumbnail,
  uploadStorageBlob,
} from './storage';
import { getActiveOrgId } from './tenancy';

export type JobFileUploadResume = {
  fileId: string;
  storagePath: string;
  thumbnailPath: string | null;
  contentType: string;
  sizeBytes: number;
  name: string;
};

export type UploadJobFileInput = {
  jobId: string;
  file: File;
  type: JobFileType;
  uploadedBy?: string;
  documentDate?: string;
  note?: string;
  resume?: JobFileUploadResume;
  onProgress?: (percent: number) => void;
};

export type UploadJobFileResult = {
  success: boolean;
  file?: JobFile;
  error?: string;
  resume?: JobFileUploadResume;
};

function reportProgress(onProgress: UploadJobFileInput['onProgress'], percent: number) {
  if (typeof onProgress !== 'function') return;
  onProgress(Math.max(0, Math.min(100, Math.round(percent))));
}

async function saveRecord(input: {
  jobId: string;
  type: JobFileType;
  uploadedBy: string;
  documentDate: string;
  note?: string;
  resume: JobFileUploadResume;
}): Promise<UploadJobFileResult> {
  const result = await createJobFileRecord(input.jobId, {
    id: input.resume.fileId,
    name: input.resume.name,
    type: input.type,
    storagePath: input.resume.storagePath,
    thumbnailPath: input.resume.thumbnailPath,
    contentType: input.resume.contentType,
    sizeBytes: input.resume.sizeBytes,
    uploadedBy: input.uploadedBy,
    documentDate: input.documentDate,
    note: input.note || undefined,
  });
  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Could not save the file record',
      resume: input.resume,
    };
  }
  return { success: true, file: result.file };
}

/**
 * Storage first, then Firestore. Never write a record that points at a
 * missing object. If Firestore fails after Storage, `resume` lets retry
 * skip the upload.
 */
export async function uploadJobFile(input: UploadJobFileInput): Promise<UploadJobFileResult> {
  const jobId = input.jobId;
  if (!jobId) {
    return { success: false, error: 'Missing job' };
  }

  const uploadedBy = input.uploadedBy || getCurrentUser()?.uid || '';
  if (!uploadedBy) {
    return { success: false, error: 'Sign in to add files' };
  }

  const documentDate = input.documentDate || todayYmd();
  const onProgress = input.onProgress;

  if (input.resume?.storagePath) {
    reportProgress(onProgress, 92);
    const saved = await saveRecord({
      jobId,
      type: input.type,
      uploadedBy,
      documentDate,
      note: input.note,
      resume: input.resume,
    });
    if (saved.success) reportProgress(onProgress, 100);
    return saved;
  }

  const checked = validateJobFileForUpload(input.file);
  if (!checked.ok) {
    return { success: false, error: checked.error };
  }

  reportProgress(onProgress, 4);

  let payload: File = input.file;
  let contentType = checked.contentType;

  if (isRasterImageContentType(contentType)) {
    const compressed = await compressImage(
      input.file,
      1920,
      0.8,
      jobFileCompressOutputType(contentType),
    );
    if (compressed && compressed.size > 0) {
      payload = compressed;
      contentType = compressed.type || contentType;
    }
  }

  if (payload.size > JOB_FILE_MAX_BYTES) {
    return { success: false, error: 'Each file must be 25 MB or smaller' };
  }
  if (!contentType || contentType.toLowerCase().startsWith('video/')) {
    return { success: false, error: 'That file type is not allowed' };
  }

  reportProgress(onProgress, 8);

  const orgId = getActiveOrgId();
  const fileId = newJobFileId(jobId);
  const displayName = safeJobFileName(input.file.name).slice(0, 200) || 'File';
  const storageName = safeJobFileName(payload.name || input.file.name) || 'file';
  const storagePath = jobFileStoragePath(orgId, jobId, fileId, storageName);

  try {
    await uploadStorageBlob(storagePath, payload, {
      contentType,
      jobId,
      onProgress: (fraction) => reportProgress(onProgress, 8 + fraction * 72),
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed. Try again.',
    };
  }

  reportProgress(onProgress, 80);

  let thumbnailPath: string | null = null;
  if (isRasterImageContentType(contentType)) {
    const thumb = await generateImageThumbnail(payload, 320, 0.8);
    if (thumb && thumb.size > 0) {
      const thumbPath = jobFileThumbnailPath(orgId, jobId, fileId);
      try {
        await uploadStorageBlob(thumbPath, thumb, {
          contentType: 'image/jpeg',
          jobId,
          onProgress: (fraction) => reportProgress(onProgress, 80 + fraction * 12),
        });
        thumbnailPath = thumbPath;
      } catch (error) {
        thumbnailPath = null;
      }
    }
  }

  reportProgress(onProgress, 92);

  const resume: JobFileUploadResume = {
    fileId,
    storagePath,
    thumbnailPath,
    contentType,
    sizeBytes: payload.size,
    name: displayName,
  };

  const saved = await saveRecord({
    jobId,
    type: input.type,
    uploadedBy,
    documentDate,
    note: input.note,
    resume,
  });
  if (saved.success) reportProgress(onProgress, 100);
  return saved;
}
