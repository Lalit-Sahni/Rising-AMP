import React from 'react';
import { filesDrawerMeta, formatJobFileDocumentDate, formatJobFileSize } from '../../domain/jobFiles';
import {
  isSelectableFileItem,
  type FileBrowserItem,
  type FileSort,
  type FileSortColumn,
  type FileTypeCount,
  type FileTypeFilter,
  fileAddedByColumnLabel,
  fileRegisterLinkLabel,
  type FileLinkLookup,
} from '../../domain/jobFileBrowser';
import JobFileThumb from './JobFileThumb';

type FilesRegisterProps = {
  items: FileBrowserItem[];
  selectedKeys: string[];
  sort: FileSort;
  typeFilter: FileTypeFilter;
  chips: FileTypeCount[];
  currentUid: string;
  currentName: string;
  lookup: FileLinkLookup;
  onOpen: (item: FileBrowserItem) => void;
  onSort: (column: FileSortColumn) => void;
  onTypeFilter: (type: FileTypeFilter) => void;
  onToggle: (key: string) => void;
  onToggleAll: () => void;
};

function SortButton({
  column,
  label,
  sort,
  onSort,
}: {
  column: FileSortColumn;
  label: string;
  sort: FileSort;
  onSort: (column: FileSortColumn) => void;
}) {
  const active = sort.column === column;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={`inline-flex items-center gap-1 font-mono uppercase tracking-wide text-[11px] ${
        active ? 'text-ink' : 'text-slate-600'
      }`}
      aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {label}
      {active ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}
    </button>
  );
}

function TypeCell({ item }: { item: FileBrowserItem }) {
  const meta = filesDrawerMeta(item.type);
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color }} />
      <span className="truncate">
        {meta.label}
        {item.kind === 'receipt' ? ' · From an expense' : ''}
      </span>
    </span>
  );
}

export default function FilesRegister({
  items,
  selectedKeys,
  sort,
  typeFilter,
  chips,
  currentUid,
  currentName,
  lookup,
  onOpen,
  onSort,
  onTypeFilter,
  onToggle,
  onToggleAll,
}: FilesRegisterProps) {
  const selectable = items.filter(isSelectableFileItem);
  const selectedVisible = selectable.filter((item) => selectedKeys.includes(item.key));
  const allSelected = selectable.length > 0 && selectedVisible.length === selectable.length;
  const someSelected = selectedVisible.length > 0 && !allSelected;

  return (
    <div className="border border-hairline rounded-ot overflow-hidden bg-surface">
      <div className="md:hidden">
        <label className="flex items-center gap-2 h-12 px-3 border-b border-hairline text-[12px] text-slate-500">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(node) => {
              if (node) node.indeterminate = someSelected;
            }}
            onChange={onToggleAll}
            disabled={selectable.length === 0}
            className="accent-[#E85D1A]"
            aria-label="Select all files"
          />
          Select files
        </label>
        {items.map((item) => {
          const selectableRow = isSelectableFileItem(item);
          const checked = selectedKeys.includes(item.key);
          const meta = filesDrawerMeta(item.type);
          return (
            <div
              key={item.key}
              className="flex items-center gap-2 h-12 px-3 border-b border-hairline last:border-b-0 hover:bg-canvas"
            >
              {selectableRow ? (
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(item.key)}
                  onClick={(event) => event.stopPropagation()}
                  className="accent-[#E85D1A] shrink-0"
                  aria-label={`Select ${item.name}`}
                />
              ) : (
                <span className="w-4 shrink-0" />
              )}
              <button
                type="button"
                onClick={() => onOpen(item)}
                className="flex items-center gap-2 min-w-0 flex-1 text-left h-full"
              >
                <JobFileThumb
                  thumbnailPath={item.thumbnailPath}
                  contentType={item.contentType}
                  kind={item.kind}
                  size={32}
                  alt=""
                />
                <span className="min-w-0 flex-1 grid grid-cols-[1fr_auto] gap-x-3">
                  <span className="text-[13px] font-semibold text-ink truncate">{item.name}</span>
                  <span className="tabular text-[12px] text-slate-400">
                    {item.documentDate ? formatJobFileDocumentDate(item.documentDate) : ''}
                  </span>
                  <span className="text-[12px] text-slate-500 truncate inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color }} />
                    {meta.label}
                    {item.kind === 'receipt' ? ' · From an expense' : ''}
                  </span>
                  <span className="tabular text-[12px] text-slate-400">
                    {item.sizeBytes != null ? formatJobFileSize(item.sizeBytes) : ''}
                  </span>
                </span>
              </button>
            </div>
          );
        })}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-canvas border-b border-hairline">
            <tr className="h-10">
              <th className="w-10 px-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(node) => {
                    if (node) node.indeterminate = someSelected;
                  }}
                  onChange={onToggleAll}
                  disabled={selectable.length === 0}
                  className="accent-[#E85D1A]"
                  aria-label="Select all files"
                />
              </th>
              <th className="w-12 px-1" aria-hidden />
              <th className="px-3 py-2">
                <SortButton column="name" label="Name" sort={sort} onSort={onSort} />
              </th>
              <th className="px-3 py-2 whitespace-nowrap">
                <div className="flex flex-col items-start gap-0.5">
                  <SortButton column="type" label="Type" sort={sort} onSort={onSort} />
                  <select
                    value={typeFilter}
                    onChange={(event) => onTypeFilter(event.target.value as FileTypeFilter)}
                    className="text-[11px] font-sans font-medium normal-case tracking-normal text-slate-600 bg-transparent border-0 p-0 pr-4"
                    aria-label="Filter by type"
                  >
                    {chips.map((chip) => (
                      <option key={chip.type} value={chip.type}>
                        {chip.label} ({chip.count})
                      </option>
                    ))}
                  </select>
                </div>
              </th>
              <th className="px-3 py-2 whitespace-nowrap">
                <SortButton column="documentDate" label="Date" sort={sort} onSort={onSort} />
              </th>
              <th className="px-3 py-2 text-[11px] font-mono uppercase tracking-wide text-slate-600">
                Linked to
              </th>
              <th className="px-3 py-2 whitespace-nowrap">
                <SortButton column="size" label="Size" sort={sort} onSort={onSort} />
              </th>
              <th className="px-3 py-2 text-[11px] font-mono uppercase tracking-wide text-slate-600">
                Added by
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const selectableRow = isSelectableFileItem(item);
              const checked = selectedKeys.includes(item.key);
              return (
                <tr
                  key={item.key}
                  className="h-12 border-b border-hairline last:border-b-0 hover:bg-canvas cursor-pointer"
                  onClick={() => onOpen(item)}
                >
                  <td className="px-3" onClick={(event) => event.stopPropagation()}>
                    {selectableRow ? (
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggle(item.key)}
                        className="accent-[#E85D1A]"
                        aria-label={`Select ${item.name}`}
                      />
                    ) : null}
                  </td>
                  <td className="px-1">
                    <JobFileThumb
                      thumbnailPath={item.thumbnailPath}
                      contentType={item.contentType}
                      kind={item.kind}
                      size={32}
                      alt=""
                    />
                  </td>
                  <td className="px-3 text-[13px] font-semibold text-ink truncate max-w-[16rem]">
                    {item.name}
                  </td>
                  <td className="px-3 text-[12.5px] text-slate-600">
                    <TypeCell item={item} />
                  </td>
                  <td className="px-3 tabular text-[12.5px] text-slate-500 whitespace-nowrap">
                    {item.documentDate ? formatJobFileDocumentDate(item.documentDate) : '—'}
                  </td>
                  <td className="px-3 text-[12.5px] text-slate-500 truncate max-w-[10rem]">
                    {fileRegisterLinkLabel(item, lookup) || '—'}
                  </td>
                  <td className="px-3 tabular text-[12.5px] text-slate-500 whitespace-nowrap">
                    {item.sizeBytes != null ? formatJobFileSize(item.sizeBytes) : '—'}
                  </td>
                  <td className="px-3 text-[12.5px] text-slate-500 whitespace-nowrap">
                    {fileAddedByColumnLabel(item, currentUid, currentName) || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
