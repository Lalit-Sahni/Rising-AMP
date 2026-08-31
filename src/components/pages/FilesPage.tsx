import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutGrid, List, Plus, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import EmptyState from '../EmptyState';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import AddJobFilesSheet from '../files/AddJobFilesSheet';
import FilesRegister from '../files/FilesRegister';
import HandoverPackSheet from '../files/HandoverPackSheet';
import JobFileThumb from '../files/JobFileThumb';
import JobFileViewer from '../files/JobFileViewer';
import { archiveJobFile, fetchJobFiles, updateJobFileRecord } from '../../firebase/jobFiles';
import {
  JOB_FILE_TYPES,
  filesDrawerMeta,
  formatJobFileDocumentDate,
  type JobFileType,
} from '../../domain/jobFiles';
import type { JobFile } from '../../domain/schemas';
import {
  DEFAULT_FILE_SORT,
  combineJobFilesAndReceipts,
  fileRegisterSummary,
  fileTypeCounts,
  formatFileRegisterSummary,
  isSelectableFileItem,
  visibleFileItems,
  type FileBrowserItem,
  type FileSort,
  type FileSortColumn,
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
    clients,
    showToast,
  } = useApp();
  const [files, setFiles] = useState<JobFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [handoverPresetIds, setHandoverPresetIds] = useState<string[] | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<FileTypeFilter>('all');
  const [sort, setSort] = useState<FileSort>(DEFAULT_FILE_SORT);
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [openItem, setOpenItem] = useState<FileBrowserItem | null>(null);
  const [viewerBusy, setViewerBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

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
  const searched = useMemo(() => {
    return visibleFileItems(items, query, 'all', sort);
  }, [items, query, sort]);
  const chips = useMemo(() => fileTypeCounts(searched, typeFilter), [searched, typeFilter]);
  const visible = useMemo(
    () => visibleFileItems(items, query, typeFilter, sort),
    [items, query, typeFilter, sort],
  );
  const summary = useMemo(() => formatFileRegisterSummary(fileRegisterSummary(searched)), [searched]);
  const lookup = useMemo(
    () => ({ expenses: expenses || [], invoices: invoices || [] }),
    [expenses, invoices],
  );
  const selectableVisible = useMemo(() => visible.filter(isSelectableFileItem), [visible]);
  const selectedItems = useMemo(
    () => selectableVisible.filter((item) => selectedKeys.includes(item.key)),
    [selectableVisible, selectedKeys],
  );

  const handleSort = (column: FileSortColumn) => {
    setSort((current) => {
      if (current.column === column) {
        return { column, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { column, direction: column === 'name' || column === 'type' ? 'asc' : 'desc' };
    });
  };

  const handleToggle = (key: string) => {
    setSelectedKeys((current) => (
      current.includes(key) ? current.filter((row) => row !== key) : [...current, key]
    ));
    setConfirmArchive(false);
  };

  const handleToggleAll = () => {
    const keys = selectableVisible.map((item) => item.key);
    const allOn = keys.length > 0 && keys.every((key) => selectedKeys.includes(key));
    setSelectedKeys(allOn ? selectedKeys.filter((key) => !keys.includes(key)) : Array.from(new Set([...selectedKeys, ...keys])));
    setConfirmArchive(false);
  };

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

  const handleBulkType = async (type: JobFileType) => {
    if (!jobId || selectedItems.length === 0) return;
    setBulkBusy(true);
    let failed = 0;
    for (const item of selectedItems) {
      if (!item.fileId) continue;
      const result = await updateJobFileRecord(jobId, item.fileId, { type });
      if (!result.success) failed += 1;
    }
    setBulkBusy(false);
    setSelectedKeys([]);
    setConfirmArchive(false);
    loadFiles();
    if (failed > 0) {
      showToast('Some files could not be updated.', 'error');
      return;
    }
    showToast(selectedItems.length === 1 ? 'Type updated.' : `${selectedItems.length} files updated.`, 'success');
  };

  const handleBulkArchive = async () => {
    if (!jobId || selectedItems.length === 0) return;
    setBulkBusy(true);
    let failed = 0;
    for (const item of selectedItems) {
      if (!item.fileId) continue;
      const result = await archiveJobFile(jobId, item.fileId);
      if (!result.success) failed += 1;
    }
    setBulkBusy(false);
    setSelectedKeys([]);
    setConfirmArchive(false);
    loadFiles();
    if (failed > 0) {
      showToast('Some files could not be archived.', 'error');
      return;
    }
    showToast(selectedItems.length === 1 ? 'File archived.' : `${selectedItems.length} files archived.`, 'success');
  };

  const handleAddToPack = () => {
    const ids = selectedItems.map((item) => item.fileId).filter(Boolean) as string[];
    setHandoverPresetIds(ids);
    setHandoverOpen(true);
  };

  if (!jobId) {
    return (
      <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
        <div className="max-w-7xl mx-auto">
          <EmptyState
            title="Open a job"
            body="Open a job to see its documents."
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
      <div className="max-w-7xl mx-auto space-y-3">
        <div>
          <div className="eyebrow">On this job</div>
          <h1 className="text-[26px] font-bold tracking-tight mt-1">Files</h1>
          <p className="text-[13.5px] text-slate-600 mt-0.5">
            Contracts, variations, permits, certificates and site photos for {projectName || 'this job'}.
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
          <div className="flex gap-2 shrink-0 flex-wrap items-center">
            <div className="inline-flex border border-hairline rounded-ot-sm overflow-hidden bg-surface">
              <button
                type="button"
                onClick={() => setView('list')}
                className={`min-h-[36px] px-3 text-[12.5px] font-semibold inline-flex items-center gap-1.5 ${
                  view === 'list' ? 'bg-canvas text-ink' : 'text-slate-400'
                }`}
                aria-pressed={view === 'list'}
              >
                <List className="w-3.5 h-3.5" />
                List
              </button>
              <button
                type="button"
                onClick={() => setView('grid')}
                className={`min-h-[36px] px-3 text-[12.5px] font-semibold inline-flex items-center gap-1.5 border-l border-hairline ${
                  view === 'grid' ? 'bg-canvas text-ink' : 'text-slate-400'
                }`}
                aria-pressed={view === 'grid'}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Grid
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setHandoverPresetIds(null);
                setHandoverOpen(true);
              }}
              className="inline-flex items-center min-h-[44px] border border-hairline bg-surface text-ink text-[13px] font-bold px-[15px] rounded-ot-sm"
            >
              Handover pack
            </button>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="inline-flex items-center gap-1.5 min-h-[44px] bg-accent hover:bg-accent-600 text-white text-[13px] font-bold px-[15px] rounded-ot-sm"
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
            title="Nothing here yet"
            body="Add the contract, permits and certificates as they come in, and they will be ready as a handover pack at the end."
            actionLabel="Add files"
            onAction={() => setSheetOpen(true)}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[12.5px] text-slate-500">{summary}</p>
              <div className="flex flex-wrap gap-1 md:hidden">
                {chips.map((chip) => {
                  const selected = typeFilter === chip.type;
                  return (
                    <button
                      key={chip.type}
                      type="button"
                      onClick={() => setTypeFilter(chip.type)}
                      className={`inline-flex items-center gap-1 h-[30px] px-2.5 rounded-ot-sm text-[12px] font-medium border ${
                        selected
                          ? 'border-ink text-ink bg-surface'
                          : 'border-hairline text-slate-600 bg-surface'
                      }`}
                    >
                      {chip.color ? (
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: chip.color }} />
                      ) : null}
                      {chip.label} {chip.count}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedItems.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 border border-hairline rounded-ot-sm bg-surface px-3 py-2">
                <span className="text-[12.5px] font-semibold text-ink">
                  {selectedItems.length} selected
                </span>
                <label className="text-[12.5px] text-slate-600 inline-flex items-center gap-1.5">
                  Change type
                  <select
                    disabled={bulkBusy}
                    defaultValue=""
                    onChange={(event) => {
                      const next = event.target.value as JobFileType | '';
                      if (next) handleBulkType(next);
                      event.target.value = '';
                    }}
                    className="min-h-[36px] border border-hairline rounded-ot-sm px-2 text-[13px] text-ink bg-surface"
                  >
                    <option value="">Choose…</option>
                    {JOB_FILE_TYPES.map((type) => (
                      <option key={type} value={type}>{filesDrawerMeta(type).label}</option>
                    ))}
                  </select>
                </label>
                {confirmArchive ? (
                  <>
                    <span className="text-[12.5px] text-slate-600">
                      Archive {selectedItems.length === 1 ? 'this file' : `${selectedItems.length} files`}? They stay on the job, off the list.
                    </span>
                    <button
                      type="button"
                      disabled={bulkBusy}
                      onClick={handleBulkArchive}
                      className="min-h-[36px] px-3 rounded-ot-sm border border-ink text-[12.5px] font-bold"
                    >
                      Archive
                    </button>
                    <button
                      type="button"
                      disabled={bulkBusy}
                      onClick={() => setConfirmArchive(false)}
                      className="min-h-[36px] px-3 rounded-ot-sm border border-hairline text-[12.5px] font-bold text-slate-600"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={() => setConfirmArchive(true)}
                    className="min-h-[36px] px-3 rounded-ot-sm border border-hairline text-[12.5px] font-bold text-slate-600"
                  >
                    Archive
                  </button>
                )}
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={handleAddToPack}
                  className="min-h-[36px] px-3 rounded-ot-sm border border-hairline text-[12.5px] font-bold text-ink"
                >
                  Add to handover pack
                </button>
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => {
                    setSelectedKeys([]);
                    setConfirmArchive(false);
                  }}
                  className="min-h-[36px] px-3 text-[12.5px] font-medium text-slate-400"
                >
                  Clear
                </button>
              </div>
            ) : null}

            {noMatches ? (
              <EmptyState
                title="Nothing matches"
                body={query ? 'Try a different search, or clear the type filter.' : 'No files of that type on this job.'}
              />
            ) : view === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-0 border border-hairline rounded-ot overflow-hidden">
                {visible.map((item) => {
                  const selectableRow = isSelectableFileItem(item);
                  const checked = selectedKeys.includes(item.key);
                  return (
                    <div key={item.key} className="relative border-b border-r border-hairline bg-surface">
                      {selectableRow ? (
                        <label className="absolute top-2 left-2 z-10 w-8 h-8 grid place-items-center bg-surface/90 border border-hairline">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggle(item.key)}
                            className="accent-[#E85D1A]"
                            aria-label={`Select ${item.name}`}
                          />
                        </label>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setOpenItem(item)}
                        className="text-left w-full"
                      >
                        <JobFileThumb
                          thumbnailPath={item.thumbnailPath}
                          contentType={item.contentType}
                          className="w-full aspect-square rounded-none border-0 border-b border-hairline"
                          alt=""
                        />
                        <div className="px-2.5 py-2">
                          <div className="text-[13px] font-semibold text-ink truncate">{item.name}</div>
                          <div className="text-[11.5px] text-slate-400 mt-0.5">
                            {item.documentDate ? formatJobFileDocumentDate(item.documentDate) : ''}
                          </div>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <FilesRegister
                items={visible}
                selectedKeys={selectedKeys}
                sort={sort}
                typeFilter={typeFilter}
                chips={chips}
                currentUid={currentUid}
                currentName={currentName}
                lookup={lookup}
                onOpen={setOpenItem}
                onSort={handleSort}
                onTypeFilter={setTypeFilter}
                onToggle={handleToggle}
                onToggleAll={handleToggleAll}
              />
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

      <HandoverPackSheet
        open={handoverOpen}
        jobName={projectName}
        files={files}
        clients={clients || []}
        profile={profile}
        presetIds={handoverPresetIds}
        onClose={() => {
          setHandoverOpen(false);
          setHandoverPresetIds(null);
        }}
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
