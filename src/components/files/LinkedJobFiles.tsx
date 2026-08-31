import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { JobFile } from '../../domain/schemas';
import type { JobFileLinkKind } from '../../domain/jobFiles';
import { filesDrawerMeta, formatJobFileDocumentDate } from '../../domain/jobFiles';
import { filesLinkedTo } from '../../domain/jobFileBrowser';
import JobFileThumb from './JobFileThumb';

type LinkedJobFilesProps = {
  files: JobFile[];
  kind: JobFileLinkKind;
  recordId?: string;
  jobId?: string;
  /** Names only — for a table cell that cannot take a card. */
  compact?: boolean;
};

export default function LinkedJobFiles({
  files,
  kind,
  recordId,
  jobId,
  compact = false,
}: LinkedJobFilesProps) {
  const navigate = useNavigate();
  const linked = filesLinkedTo(files, kind, recordId || '');
  if (linked.length === 0) return null;

  if (compact) {
    return (
      <div className="mt-1 text-[11.5px] text-slate-400 leading-snug">
        {linked.map((file) => file.name).join(' · ')}
      </div>
    );
  }

  return (
    <div className="border border-hairline rounded-ot-sm p-3">
      <div className="text-[12.5px] font-medium text-slate-600 mb-2">
        {linked.length === 1 ? '1 file on this record' : `${linked.length} files on this record`}
      </div>
      <ul className="space-y-2">
        {linked.map((file) => {
          const meta = filesDrawerMeta(file.type);
          return (
            <li key={file.id || file.storagePath} className="flex items-center gap-2.5 min-w-0">
              <JobFileThumb
                thumbnailPath={file.thumbnailPath}
                contentType={file.contentType}
                type={file.type}
                size={36}
                alt=""
              />
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-ink truncate">{file.name}</div>
                <div className="text-[11.5px] text-slate-400">
                  {meta.label}
                  {file.documentDate ? ` · ${formatJobFileDocumentDate(file.documentDate)}` : ''}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {jobId ? (
        <button
          type="button"
          onClick={() => navigate(`/jobs/${jobId}/files`)}
          className="mt-2 text-[12.5px] font-bold text-accent min-h-[44px]"
        >
          Open in Files
        </button>
      ) : null}
    </div>
  );
}
