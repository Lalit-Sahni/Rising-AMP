import React, { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import EmptyState from '../EmptyState';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import AddJobFilesSheet from '../files/AddJobFilesSheet';
import JobFileThumb from '../files/JobFileThumb';
import { fetchJobFiles } from '../../data';
import {
  JOB_FILE_TYPE_META,
  formatJobFileDocumentDate,
  formatJobFileSize,
} from '../../domain/jobFiles';
import type { JobFile } from '../../domain/schemas';

export default function FilesPage() {
  const { jobId, projectName, authUser, showToast } = useApp();
  const [files, setFiles] = useState<JobFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);

  const loadFiles = useCallback(async () => {
    if (!jobId) {
      setFiles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await fetchJobFiles(jobId);
    if (!result.success) {
      setError(result.error || 'Could not load files');
      setFiles([]);
    } else {
      setError('');
      setFiles((result.files || []).filter((file) => file.status !== 'archived'));
    }
    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  if (!jobId) {
    return (
      <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
        <div className="max-w-7xl mx-auto">
          <EmptyState
            title="Open a job first"
            body="Files live on a job. There is no unfiled pile."
            actionLabel="Jobs"
            to="/"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow">On this job</div>
            <h1 className="text-[26px] font-bold tracking-tight mt-1">Files</h1>
            <p className="text-[13.5px] text-slate-600 mt-0.5">
              Typed documents for {projectName || 'this job'}. No folders.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="inline-flex items-center gap-1.5 min-h-[44px] bg-accent hover:bg-accent-600 text-white text-[13px] font-bold px-[15px] rounded-[9px]"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            Add files
          </button>
        </div>

        {loading ? (
          <LoadingSkeleton type="job" lines={4} />
        ) : error ? (
          <EmptyState
            title="Could not load files"
            body={error}
            actionLabel="Try again"
            onAction={loadFiles}
          />
        ) : files.length === 0 ? (
          <EmptyState
            title="No files on this job yet"
            body="Put the contract, variations, permits and certificates here. At the end of the job they become the handover pack. Nothing gets filed in the wrong folder, because there are no folders."
            actionLabel="Add files"
            onAction={() => setSheetOpen(true)}
          />
        ) : (
          <div className="bg-surface border border-hairline rounded-ot overflow-hidden">
            {files.map((file) => {
              const meta = JOB_FILE_TYPE_META[file.type];
              return (
                <div
                  key={file.id}
                  className="flex items-center gap-3 px-3.5 py-3 border-b border-hairline last:border-b-0"
                >
                  <JobFileThumb
                    thumbnailPath={file.thumbnailPath}
                    contentType={file.contentType}
                    type={file.type}
                    alt=""
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold text-ink truncate">{file.name}</div>
                    <div className="text-[12px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: meta?.color || '#8A9099' }}
                      />
                      <span>
                        {meta?.label || file.type}
                        {' · '}
                        {formatJobFileDocumentDate(file.documentDate)}
                      </span>
                    </div>
                  </div>
                  <div className="tabular text-[12px] text-slate-400 shrink-0">
                    {formatJobFileSize(file.sizeBytes)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AddJobFilesSheet
        open={sheetOpen}
        jobId={jobId}
        jobName={projectName}
        uploadedBy={(authUser && authUser.uid) || ''}
        onClose={() => setSheetOpen(false)}
        onUploaded={loadFiles}
        showToast={showToast}
      />
    </div>
  );
}
