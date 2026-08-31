import React, { useEffect, useRef, useState } from 'react';
import { Camera, Upload, X } from 'lucide-react';
import { todayYmd } from '../../dates';
import {
  JOB_FILE_ACCEPT,
  JOB_FILE_TYPE_META,
  JOB_FILE_TYPES,
  formatJobFileSize,
  isRasterImageContentType,
  suggestJobFileType,
  validateJobFileForUpload,
  type JobFileType,
} from '../../domain/jobFiles';
import { uploadJobFile, type JobFileUploadResume } from '../../firebase/uploadJobFile';
import JobFileThumb from './JobFileThumb';

type QueueStatus = 'queued' | 'uploading' | 'done' | 'error';

type QueueItem = {
  localId: string;
  file: File;
  name: string;
  contentType: string;
  status: QueueStatus;
  progress: number;
  error?: string;
  resume?: JobFileUploadResume;
};

type AddJobFilesSheetProps = {
  open: boolean;
  jobId: string;
  jobName?: string;
  uploadedBy: string;
  onClose: () => void;
  onUploaded: () => void;
  showToast: (message: string, type?: string) => void;
};

function nextLocalId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `f-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function AddJobFilesSheet({
  open,
  jobId,
  jobName,
  uploadedBy,
  onClose,
  onUploaded,
  showToast,
}: AddJobFilesSheetProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<JobFileType | null>(null);
  const [documentDate, setDocumentDate] = useState(todayYmd());
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const typeRef = useRef<JobFileType | null>(null);
  const dateRef = useRef(documentDate);

  useEffect(() => {
    typeRef.current = type;
  }, [type]);
  useEffect(() => {
    dateRef.current = documentDate;
  }, [documentDate]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const uploading = busy || queue.some((item) => item.status === 'uploading');
  const pending = queue.filter((item) => item.status === 'queued' || item.status === 'error');

  const addFiles = (list: FileList | File[] | null) => {
    if (!list || list.length === 0) return;
    const next: QueueItem[] = [];
    Array.from(list).forEach((file) => {
      const checked = validateJobFileForUpload(file);
      if (!checked.ok) {
        showToast(checked.error, 'error');
        return;
      }
      next.push({
        localId: nextLocalId(),
        file,
        name: file.name,
        contentType: checked.contentType,
        status: 'queued',
        progress: 0,
      });
    });
    if (next.length === 0) return;
    if (!typeRef.current && next.every((item) => isRasterImageContentType(item.contentType))) {
      setType('photo');
    }
    setQueue((prev) => [...prev, ...next]);
  };

  const updateItem = (localId: string, patch: Partial<QueueItem>) => {
    setQueue((prev) => prev.map((item) => (item.localId === localId ? { ...item, ...patch } : item)));
  };

  const uploadOne = async (item: QueueItem) => {
    const chosenType = typeRef.current;
    if (!chosenType) {
      showToast('Pick what it is first.', 'info');
      return false;
    }
    updateItem(item.localId, { status: 'uploading', progress: item.resume ? 92 : 0, error: undefined });
    const result = await uploadJobFile({
      jobId,
      file: item.file,
      type: chosenType,
      uploadedBy,
      documentDate: dateRef.current,
      resume: item.resume,
      onProgress: (percent) => updateItem(item.localId, { progress: percent }),
    });
    if (result.success) {
      updateItem(item.localId, { status: 'done', progress: 100, resume: undefined, error: undefined });
      return true;
    }
    updateItem(item.localId, {
      status: 'error',
      error: result.error || 'Upload failed',
      resume: result.resume,
    });
    return false;
  };

  const handleAddToJob = async () => {
    if (!type) {
      showToast('Pick what it is first.', 'info');
      return;
    }
    if (pending.length === 0) {
      showToast('Choose files first.', 'info');
      return;
    }
    setBusy(true);
    let added = 0;
    let failed = 0;
    for (const item of pending) {
      const ok = await uploadOne(item);
      if (ok) added += 1;
      else failed += 1;
    }
    setBusy(false);
    if (added > 0) onUploaded();
    if (failed === 0 && added > 0) {
      showToast(added === 1 ? 'File added to the job.' : `${added} files added to the job.`, 'success');
      setQueue([]);
      onClose();
      return;
    }
    if (failed > 0) {
      showToast('One or more files did not upload. Retry the ones that failed.', 'error');
    }
  };

  const handleRetry = async (item: QueueItem) => {
    if (!type) {
      showToast('Pick what it is first.', 'info');
      return;
    }
    setBusy(true);
    const ok = await uploadOne(item);
    setBusy(false);
    if (ok) {
      onUploaded();
      showToast('File added to the job.', 'success');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-steel-900/50"
        aria-label="Close add files"
        disabled={uploading}
        onClick={() => {
          if (!uploading) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-files-title"
        className="relative w-full md:max-w-md bg-surface rounded-t-ot md:rounded-ot border border-hairline shadow-whisper px-4 pt-4 pb-4 md:mx-4 safe-area-bottom"
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <h2 id="add-files-title" className="text-[15px] font-extrabold text-ink">Add files</h2>
            <p className="text-[12.5px] text-slate-400 mt-0.5">{jobName || 'This job'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="w-11 h-11 grid place-items-center rounded-ot-sm text-slate-500 hover:bg-canvas disabled:opacity-40"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-3">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={uploading}
            className="min-h-[44px] flex items-center justify-center gap-2 px-3 py-3 border border-hairline rounded-ot-sm text-[13px] font-medium text-slate-600 hover:border-accent hover:bg-accent-tint"
          >
            <Camera className="w-4 h-4" />
            Take a photo
          </button>
          <button
            type="button"
            onClick={() => filesRef.current?.click()}
            disabled={uploading}
            className="min-h-[44px] flex items-center justify-center gap-2 px-3 py-3 border border-hairline rounded-ot-sm text-[13px] font-medium text-slate-600 hover:border-accent hover:bg-accent-tint"
          >
            <Upload className="w-4 h-4" />
            Choose files
          </button>
        </div>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <input
          ref={filesRef}
          type="file"
          accept={JOB_FILE_ACCEPT}
          multiple
          className="hidden"
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = '';
          }}
        />

        <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-slate-400 mb-2">What is it?</div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {JOB_FILE_TYPES.map((key) => {
            const meta = JOB_FILE_TYPE_META[key];
            const selected = type === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setType(key)}
                disabled={uploading}
                className={`inline-flex items-center gap-1.5 min-h-[44px] px-2.5 rounded-ot-sm text-[13px] border ${
                  selected
                    ? 'border-ink bg-canvas text-ink font-semibold'
                    : 'border-hairline text-slate-600'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
                {meta.label}
              </button>
            );
          })}
        </div>

        <label className="block text-[12.5px] font-medium text-slate-600 mb-3">
          Date on the document
          <input
            type="date"
            value={documentDate}
            onChange={(event) => setDocumentDate(event.target.value)}
            disabled={uploading}
            className="mt-1 w-full min-h-[44px] px-3 rounded-ot-sm border border-hairline text-[14px] text-ink"
          />
        </label>

        {queue.length > 0 && (
          <ul className="space-y-2 mb-3 max-h-48 overflow-y-auto">
            {queue.map((item) => (
              <li key={item.localId} className="flex items-center gap-2.5">
                <JobFileThumb
                  contentType={item.contentType}
                  type={type || suggestJobFileType(item.contentType)}
                  size={32}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium text-ink truncate">{item.name}</div>
                  {item.status === 'error' ? (
                    <div className="text-[11.5px] text-neg">{item.error}</div>
                  ) : item.status === 'done' ? (
                    <div className="text-[11.5px] text-pos">On the job</div>
                  ) : (
                    <div className="h-1 mt-1 bg-hairline rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent"
                        style={{ width: `${item.status === 'queued' ? 0 : item.progress}%` }}
                      />
                    </div>
                  )}
                </div>
                <span className="tabular text-[11.5px] text-slate-400 w-10 text-right">
                  {item.status === 'uploading' || item.status === 'done' ? `${item.progress}%` : formatJobFileSize(item.file.size)}
                </span>
                {item.status === 'error' ? (
                  <button
                    type="button"
                    onClick={() => handleRetry(item)}
                    disabled={uploading}
                    className="text-[12px] font-bold text-accent min-h-[44px] px-2"
                  >
                    Retry
                  </button>
                ) : item.status === 'queued' ? (
                  <button
                    type="button"
                    onClick={() => setQueue((prev) => prev.filter((row) => row.localId !== item.localId))}
                    disabled={uploading}
                    className="text-slate-400 min-h-[44px] w-11"
                    aria-label={`Remove ${item.name}`}
                  >
                    <X className="w-3.5 h-3.5 mx-auto" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <p className="text-[11.5px] text-slate-400 mb-3">
          Photos are compressed. 25 MB each. No video.
        </p>
        <button
          type="button"
          onClick={handleAddToJob}
          disabled={uploading || !type || pending.length === 0}
          className="w-full min-h-[44px] inline-flex items-center justify-center rounded-ot-sm bg-accent hover:bg-accent-600 disabled:opacity-50 text-white text-[13px] font-bold"
        >
          {uploading ? 'Adding…' : 'Add to job'}
        </button>
      </div>
    </div>
  );
}
