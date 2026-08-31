import {
  jobFileSchema,
  parseAtBoundary,
} from './schemas';
import {
  JOB_FILE_MAX_BYTES,
  jobFileStoragePath,
  jobFileThumbnailPath,
  isAllowedJobFileContentType,
  isJobFileType,
  isRasterImageContentType,
  isVideoFile,
  resolveJobFileContentType,
  safeJobFileName,
  suggestJobFileType,
  validateJobFileForUpload,
} from './jobFiles';

describe('job file model', () => {
  const sample = {
    name: 'Slab engineer certificate',
    type: 'certificate',
    storagePath: 'files/opal-ss-constructions/job-1/f1/slab.pdf',
    thumbnailPath: null,
    contentType: 'application/pdf',
    sizeBytes: 412000,
    uploadedBy: 'owner-1',
    documentDate: '2026-03-14',
    status: 'active',
  };

  test('accepts a certificate with a document date', () => {
    const file = jobFileSchema.parse(sample);
    expect(file.type).toBe('certificate');
    expect(file.documentDate).toBe('2026-03-14');
  });

  test('rejects video', () => {
    const result = parseAtBoundary(jobFileSchema, { ...sample, contentType: 'video/mp4' });
    expect(result.ok).toBe(false);
    expect(isAllowedJobFileContentType('video/mp4')).toBe(false);
  });

  test('rejects a file over 25 MB', () => {
    const result = parseAtBoundary(jobFileSchema, {
      ...sample,
      sizeBytes: JOB_FILE_MAX_BYTES + 1,
    });
    expect(result.ok).toBe(false);
  });

  test('rejects a made-up type — there are no folders', () => {
    expect(isJobFileType('folder')).toBe(false);
    const result = parseAtBoundary(jobFileSchema, { ...sample, type: 'folder' });
    expect(result.ok).toBe(false);
  });

  test('storage paths carry the org and job', () => {
    expect(jobFileStoragePath('org-a', 'job-1', 'f1', 'slab.pdf')).toBe(
      'files/org-a/job-1/f1/slab.pdf',
    );
    expect(jobFileThumbnailPath('org-a', 'job-1', 'f1')).toBe(
      'files/org-a/job-1/f1/thumb.jpg',
    );
    expect(safeJobFileName('a/b\\c.pdf')).toBe('a-b-c.pdf');
  });
});

describe('job file upload checks', () => {
  test('rejects video by mime and by extension', () => {
    expect(validateJobFileForUpload({
      name: 'site.mp4',
      type: 'video/mp4',
      size: 1200,
    }).ok).toBe(false);
    expect(isVideoFile({ name: 'clip.MOV', type: '' })).toBe(true);
    expect(validateJobFileForUpload({
      name: 'clip.mov',
      type: '',
      size: 1200,
    }).ok).toBe(false);
  });

  test('rejects a file over 25 MB before upload', () => {
    const result = validateJobFileForUpload({
      name: 'plan.pdf',
      type: 'application/pdf',
      size: JOB_FILE_MAX_BYTES + 1,
    });
    expect(result.ok).toBe(false);
  });

  test('maps a PDF with an empty or octet-stream type from the name', () => {
    expect(resolveJobFileContentType({ name: 'permit.pdf', type: '' })).toBe('application/pdf');
    expect(resolveJobFileContentType({ name: 'permit.pdf', type: 'application/octet-stream' })).toBe(
      'application/pdf',
    );
    const result = validateJobFileForUpload({
      name: 'permit.pdf',
      type: '',
      size: 80_000,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.contentType).toBe('application/pdf');
  });

  test('suggests photo for images and other for documents', () => {
    expect(suggestJobFileType('image/jpeg')).toBe('photo');
    expect(suggestJobFileType('application/pdf')).toBe('other');
    expect(isRasterImageContentType('image/vnd.dwg')).toBe(false);
    expect(isRasterImageContentType('image/png')).toBe(true);
  });
});
