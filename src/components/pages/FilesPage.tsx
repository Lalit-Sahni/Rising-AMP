import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutGrid, List, Plus, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import EmptyState from '../EmptyState';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import AddJobFilesSheet from '../files/AddJobFilesSheet';
import JobFileThumb from '../files/JobFileThumb';
import JobFileViewer from '../files/JobFileViewer';
import { archiveJobFile, fetchJobFiles, updateJobFileRecord } from '../../data';
import {
  filesDrawerMeta,
  formatJobFileDocumentDate,
  formatJobFileSize,
  type JobFileType,
} from '../../domain/jobFiles';
import type { JobFile } from '../../domain/schemas';
import {
  combineJobFilesAndReceipts,
  fileAddedByLabel,
  fileLinkLabel,
  fileTypeCounts,
  searchFileItems,
  visibleFileItems,
  type FileBrowserItem,
  type FileTypeFilter,
} from '../../domain/jobFileBrowser';

export default function FilesPage() {
  const navigate = useNavigate();
  const {
    jobId,
    projectName,
    authUser,
    profile,
    expenses,
    invoices,
    hiaContracts,
    showToast,
  } = useApp();
  const [files, setFiles] = useState<JobFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<FileTypeFilter>('all');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [openItem, setOpenItem] = useState<FileBrowserItem | null>(null);
  const [viewerBusy, setViewerBusy] = useState(false);

  const currentUid = (authUser && authUser.uid) || '';
  const currentName = (profile && profile.displayName) || (authUser && authUser.displayName) || '';

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
      setFiles(result.files || []);
    }
    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const items = useMemo(
    () => combineJobFilesAndReceipts(files, expenses || []),
    [files, expenses],
  );
  const searched = useMemo(() => searchFileItems(items, query), [items, query]);

  const chips = useMemo(() => fileTypeCounts(searched, typeFilter), [searched, typeFilter]);
  const visible = useMemo(
    () => visibleFileItems(items, query, typeFilter),
    [items, query, typeFilter],
  );

  const lookup = useMemo(
    () => ({ expenses: expenses || [], invoices: invoices || [] }),
    [expenses, invoices],
  );

  const handleSave = async (patch: {
    name: string;
    type: JobFileType;
    documentDate: string;
    note: string;
    linkedTo: { kind: 'expense' | 'invoice' | 'hiaContract'; id: string } | null;
  }) => {
    if (!jobId || !openItem?.fileId) return;
    setViewerBusy(true);
    const result = await updateJobFileRecord(jobId, openItem.fileId, patch);
    setViewerBusy(false);
    if (!result.success) {
      showToast(result.error || 'Could not save that file', 'error');
      return;
    }
    showToast('File updated.', 'success');
    setOpenItem(null);
    loadFiles();
  };

  const handleArchive = async () => {
    if (!jobId || !openItem?.fileId) return;
    setViewerBusy(true);
    const result = await archiveJobFile(jobId, openItem.fileId);
    setViewerBusy(false);
    if (!result.success) {
      showToast(result.error || 'Could not archive that file', 'error');
      return;
    }
    showToast('File archived.', 'success');
    setOpenItem(null);
    loadFiles();
  };

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

  const emptyLibrary = !loading && !error && items.length === 0;
  const noMatches = !loading && !error && items.length > 0 && visible.length === 0;

  return (
    <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
      <div className="max-w-7xl mx-auto space-y-4">
        <div>
          <div className="eyebrow">On this job</div>
          <h1 className="text-[26px] font-bold tracking-tight mt-1">Files</h1>
          <p className="text-[13.5px] text-slate-600 mt-0.5">
            Typed documents for {projectName || 'this job'}. No folders.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <label className="relative flex-1 min-w-0">
            <span className="sr-only">Search files, notes and types</span>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search files, notes and types…"
              className="w-full min-h-[44px] pl-10 pr-3 rounded-ot-sm border border-hairline bg-surface text-[14px] text-ink"
            />
          </label>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setView(view === 'list' ? 'grid' : 'list')}
              className="min-h-[44px] min-w-[44px] grid place-items-center rounded-ot-sm border border-hairline bg-surface text-slate-600"
              aria-label={view === 'list' ? 'Show as grid' : 'Show as list'}
            >
              {view === 'list' ? <LayoutGrid className="w-4 h-4" /> : <List className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="inline-flex items-center gap-1.5 min-h-[44px] bg-accent hover:bg-accent-600 text-white text-[13px] font-bold px-[15px] rounded-[9px]"
            >
              <Plus className="w-4 h-4" strokeWidth={2} />
              Add files
            </button>
          </div>
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
        ) : emptyLibrary ? (
          <EmptyState
            title="No files on this job yet"
            body="Put the contract, variations, permits and certificates here. At the end of the job they become the handover pack. Nothing gets filed in the wrong folder, because there are no folders."
            actionLabel="Add files"
            onAction={() => setSheetOpen(true)}
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {chips.map((chip) => {
                const selected = typeFilter === chip.type;
                return (
                  <button
                    key={chip.type}
                    type="button"
                    onClick={() => setTypeFilter(chip.type)}
                    className={`inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-full text-[12.5px] font-semibold border ${
                      selected
                        ? 'border-ink text-ink bg-surface'
                        : 'border-hairline text-slate-600 bg-surface'
                    }`}
                  >
                    {chip.color ? (
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: chip.color }} />
                    ) : null}
                    {chip.label}
                    <i className="not-italic text-slate-400 font-semibold">{chip.count}</i>
                  </button>
                );
              })}
            </div>

            {noMatches ? (
              <EmptyState
                title="Nothing matches"
                body={query ? 'Try a different search, or clear the type filter.' : 'No files of that type on this job.'}
              />
            ) : view === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {visible.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setOpenItem(item)}
                    className={`text-left bg-surface border rounded-ot overflow-hidden ${
                      item.kind === 'receipt' ? 'border-dashed border-zinc-300' : 'border-hairline'
                    }`}
                  >
                    <JobFileThumb
                      thumbnailPath={item.thumbnailPath}
                      contentType={item.contentType}
                      type={item.type}
                      className="w-full aspect-square rounded-none border-0"
                      alt=""
                    />
                    <div className="px-2.5 py-2">
                      <div className="text-[13px] font-semibold text-ink truncate">{item.name}</div>
                      <div className="text-[11.5px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: filesDrawerMeta(item.type).color }}
                        />
                        <span className="truncate">{filesDrawerMeta(item.type).label}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {visible.map((item) => {
                  const meta = filesDrawerMeta(item.type);
                  const added = fileAddedByLabel(item, currentUid, currentName);
                  const linked = fileLinkLabel(item.linkedTo, lookup);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setOpenItem(item)}
                      className={`w-full flex items-center gap-3 px-3.5 py-3 bg-surface border rounded-ot text-left min-h-[44px] ${
                        item.kind === 'receipt' ? 'border-dashed border-zinc-300' : 'border-hairline'
                      }`}
                    >
                      <JobFileThumb
                        thumbnailPath={item.thumbnailPath}
                        contentType={item.contentType}
                        type={item.type}
                        alt=""
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-semibold text-ink truncate">{item.name}</div>
                        <div className="text-[12px] text-slate-400 flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: meta.color }}
                          />
                          <span>
                            {meta.label}
                            {item.documentDate ? ` · ${formatJobFileDocumentDate(item.documentDate)}` : ''}
                            {linked ? ` · ${linked}` : added ? ` · ${added}` : ''}
                          </span>
                        </div>
                      </div>
                      <div className="tabular text-[12px] text-slate-400 shrink-0">
                        {item.sizeBytes != null ? formatJobFileSize(item.sizeBytes) : ''}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <AddJobFilesSheet
        open={sheetOpen}
        jobId={jobId}
        jobName={projectName}
        uploadedBy={currentUid}
        onClose={() => setSheetOpen(false)}
        onUploaded={loadFiles}
        showToast={showToast}
      />

      <JobFileViewer
        open={Boolean(openItem)}
        item={openItem}
        currentUid={currentUid}
        currentName={currentName}
        expenses={expenses || []}
        invoices={invoices || []}
        hiaContracts={hiaContracts || []}
        busy={viewerBusy}
        onClose={() => setOpenItem(null)}
        onSave={handleSave}
        onArchive={handleArchive}
        onOpenExpense={(expenseId) => {
          setOpenItem(null);
          navigate(`/jobs/${jobId}/history`, { state: { openExpenseId: expenseId } });
        }}
      />
    </div>
  );
}
