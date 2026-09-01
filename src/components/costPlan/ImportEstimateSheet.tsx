import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { formatCents } from '../../money';
import { todayYmd } from '../../dates';
import {
  IMPORT_COLUMNS,
  buildImportedSections,
  guessTradeIdForSection,
  isEstimateSpreadsheetFile,
  parseSpreadsheetFile,
  reconcileImportedPlan,
  type ColumnMap,
  type ImportColumn,
} from '../../domain/costPlanImport';
import {
  checkAgainstFileTotals,
  findHeaderRowIndex,
  guessColumnMapStrict,
  matchTradeForSection,
  readBoqLayout,
} from '../../domain/boqLayout';
import { activeTrades } from '../../domain/costPlan';
import { queryKeys } from '../../query/client';
import type { CostPlan, TradeListItem } from '../../domain/schemas';

type ImportEstimateSheetProps = {
  open: boolean;
  orgId: string;
  jobId: string;
  userId: string;
  plan: CostPlan | null;
  trades: TradeListItem[];
  onClose: () => void;
  onSaved: (plan: CostPlan) => void;
  showToast: (message: string, type?: string) => void;
};

const COLUMN_LABELS: Record<ImportColumn, string> = {
  ignore: 'Ignore',
  code: 'Code',
  description: 'Description',
  section: 'Section',
  qty: 'Qty',
  unit: 'Unit',
  unitPrice: 'Unit price',
  amount: 'Amount',
};

export default function ImportEstimateSheet({
  open,
  orgId,
  jobId,
  userId,
  plan,
  trades,
  onClose,
  onSaved,
  showToast,
}: ImportEstimateSheetProps) {
  const queryClient = useQueryClient();
  const list = useMemo(() => activeTrades(trades), [trades]);
  const allowedTradeIds = useMemo(() => list.map((trade) => trade.id), [list]);
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<Array<{ sheetName: string; rows: string[][] }>>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [columnMap, setColumnMap] = useState<ColumnMap>({});
  const [tradeBySection, setTradeBySection] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [updateTarget, setUpdateTarget] = useState(!plan);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setSheets([]);
    setSheetIndex(0);
    setHeaderRowIndex(0);
    setColumnMap({});
    setTradeBySection({});
    setError('');
    setUpdateTarget(!plan);
  }, [open, plan]);

  const rows = sheets[sheetIndex]?.rows || [];
  const headers = rows[headerRowIndex] || [];
  const layout = useMemo(
    () => readBoqLayout(rows, columnMap, headerRowIndex),
    [rows, columnMap, headerRowIndex],
  );
  const sections = layout.sections;
  const warnings = layout.warnings;
  const grandTotals = layout.grandTotals;
  const names = useMemo(() => {
    const out: Record<string, string> = {};
    list.forEach((trade) => {
      out[trade.id] = trade.name;
    });
    return out;
  }, [list]);
  const imported = useMemo(
    () => buildImportedSections(sections, tradeBySection, names),
    [sections, tradeBySection, names],
  );
  const targetCents = plan && !updateTarget ? plan.targetCents : null;
  const reconcile = reconcileImportedPlan(imported, targetCents);
  const fileCheck = useMemo(
    () => checkAgainstFileTotals(reconcile.totalCents, grandTotals),
    [reconcile.totalCents, grandTotals],
  );
  const blockedByFile = sections.length > 0
    && fileCheck.statedCount > 0
    && !fileCheck.corroborated;
  const matchedCount = sections.filter((section) => tradeBySection[section.key]).length;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  useEffect(() => {
    if (sections.length === 0) return;
    setTradeBySection((current) => {
      const next: Record<string, string> = {};
      sections.forEach((section) => {
        if (current[section.key]) {
          next[section.key] = current[section.key];
          return;
        }
        const guessedId = matchTradeForSection(section.name, allowedTradeIds)
          || guessTradeIdForSection(section.name);
        if (guessedId) next[section.key] = guessedId;
      });
      const currentKeys = Object.keys(current);
      const nextKeys = Object.keys(next);
      if (
        currentKeys.length === nextKeys.length
        && nextKeys.every((key) => current[key] === next[key])
      ) {
        return current;
      }
      return next;
    });
  }, [sections, allowedTradeIds]);

  if (!open) return null;

  const applyHeaderRow = (nextSheets: Array<{ sheetName: string; rows: string[][] }>, nextSheetIndex: number) => {
    const sheetRows = nextSheets[nextSheetIndex]?.rows || [];
    const nextHeaderRow = findHeaderRowIndex(sheetRows);
    setHeaderRowIndex(nextHeaderRow);
    setColumnMap(guessColumnMapStrict(sheetRows[nextHeaderRow] || []));
    setTradeBySection({});
  };

  const handleFile = async (next: File | null) => {
    setFile(next);
    setSheets([]);
    setSheetIndex(0);
    setHeaderRowIndex(0);
    setColumnMap({});
    setTradeBySection({});
    setError('');
    if (!next) return;

    if (String(next.name || '').toLowerCase().endsWith('.pdf') || next.type === 'application/pdf') {
      setError('A PDF is not read. Export the bill of quantities to Excel or CSV first.');
      return;
    }

    if (!isEstimateSpreadsheetFile(next)) {
      setError('Use an Excel or CSV file.');
      return;
    }

    setBusy(true);
    try {
      const parsed = await parseSpreadsheetFile(next);
      setSheets(parsed);
      setSheetIndex(0);
      applyHeaderRow(parsed, 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!file) {
      setError('Choose a spreadsheet first.');
      return;
    }
    if (blockedByFile) {
      setError(
        `These sections add to ${formatCents(reconcile.totalCents)}, which is not a figure this file states. `
        + `The closest is ${fileCheck.nearest?.label} at ${formatCents(fileCheck.nearest?.amountCents || 0)}. `
        + 'Check the header row and the column mapping, or break the plan into trades by hand instead.',
      );
      return;
    }
    if (!reconcile.ok) {
      setError(reconcile.issues[0]);
      return;
    }
    const unmapped = sections.filter((section) => !tradeBySection[section.key]);
    if (unmapped.length > 0) {
      setError('Map every source section to a trade before saving.');
      return;
    }
    setBusy(true);
    try {
      const { uploadJobFile } = await import('../../firebase/uploadJobFile');
      const { saveCostPlanTarget, saveCostPlanTrades } = await import('../../firebase/costPlan');
      const uploaded = await uploadJobFile({
        jobId,
        file,
        type: 'estimate',
        uploadedBy: userId,
        documentDate: todayYmd(),
        note: 'Cost plan source spreadsheet',
      });
      if (!uploaded.success || !uploaded.file?.id) {
        throw new Error(uploaded.error || 'Could not keep the file in Files.');
      }
      const nextTarget = targetCents == null ? reconcile.totalCents : plan?.targetCents || reconcile.totalCents;
      if (!plan) {
        await saveCostPlanTarget(jobId, {
          targetCents: nextTarget,
          baselineDate: todayYmd(),
          createdBy: userId,
        });
      }
      const saved = await saveCostPlanTrades(jobId, {
        sections: imported,
        targetCents: nextTarget,
        sourceFileId: uploaded.file.id,
        level: 'imported',
      });
      queryClient.setQueryData(queryKeys.costPlan(orgId, jobId), saved);
      showToast('Estimate imported.', 'success');
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import that estimate.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-surface w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-ot sm:rounded-ot border border-hairline shadow-whisper">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-hairline">
          <div>
            <h2 className="text-[16px] font-extrabold">Import a bill of quantities</h2>
            <p className="text-[12.5px] text-slate-600 mt-0.5">
              Excel or CSV is mapped for you. Nothing is saved until the sections add up to a figure the file itself states.
            </p>
          </div>
          <button type="button" onClick={onClose} className="w-11 h-11 grid place-items-center rounded-ot-sm text-slate-500 hover:bg-canvas" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <input
            type="file"
            accept=".xlsx,.xls,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/plain"
            onChange={(event) => handleFile(event.target.files?.[0] || null)}
          />
          {sections.length > 0 ? (
            <p className="text-[12.5px] text-slate-600">
              {matchedCount} of {sections.length} headings matched to a trade. Check the mapping before saving.
            </p>
          ) : null}
          {sheets.length > 1 ? (
            <label className="block text-[12.5px] font-semibold">
              Sheet
              <select
                value={sheetIndex}
                onChange={(event) => {
                  const nextIndex = Number(event.target.value);
                  setSheetIndex(nextIndex);
                  applyHeaderRow(sheets, nextIndex);
                }}
                className="mt-1 w-full px-2 py-2 rounded-ot-sm border border-hairline text-[13px]"
              >
                {sheets.map((sheet, index) => (
                  <option key={sheet.sheetName} value={index}>{sheet.sheetName}</option>
                ))}
              </select>
            </label>
          ) : null}
          {headers.length > 0 ? (
            <div>
              <label className="block text-[12.5px] mb-3">
                <span className="font-semibold">Header row</span>
                <select
                  value={headerRowIndex}
                  onChange={(event) => {
                    const nextIndex = Number(event.target.value);
                    setHeaderRowIndex(nextIndex);
                    setColumnMap(guessColumnMapStrict(rows[nextIndex] || []));
                    setTradeBySection({});
                  }}
                  className="mt-1 w-full px-2 py-2 rounded-ot-sm border border-hairline text-[13px]"
                >
                  {rows.slice(0, 40).map((row, index) => (
                    <option key={index} value={index}>
                      {`Row ${index + 1}: ${row.filter(Boolean).slice(0, 6).join(' · ').slice(0, 70) || '(blank)'}`}
                    </option>
                  ))}
                </select>
                <span className="block mt-1 text-[11.5px] text-slate-500">
                  The row with Description, Qty, Price and Total on it. Everything above is the cover.
                </span>
              </label>
              {grandTotals.length > 0 ? (
                <div className="mb-3 text-[11.5px] text-slate-500">
                  <span className="font-semibold text-steel-900">The file says:</span>{' '}
                  {grandTotals.map((entry) => `${entry.label} ${formatCents(entry.amountCents)}`).join(' · ')}
                  <span className="block mt-1">
                    Sections add to cost. A final price on top of that is GST, a builder&rsquo;s margin, or both.
                  </span>
                </div>
              ) : null}
              <div className="text-[12.5px] font-semibold mb-2">Columns</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {headers.map((header, index) => (
                  <label key={`${header}-${index}`} className="text-[12px] text-slate-600">
                    <span className="block truncate mb-1">{header || `Column ${index + 1}`}</span>
                    <select
                      value={columnMap[index] || 'ignore'}
                      onChange={(event) => setColumnMap((current) => ({ ...current, [index]: event.target.value as ImportColumn }))}
                      className="w-full px-2 py-1.5 rounded-ot-sm border border-hairline text-[12.5px]"
                    >
                      {IMPORT_COLUMNS.map((column) => (
                        <option key={column} value={column}>{COLUMN_LABELS[column]}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          {sections.length > 0 ? (
            <div>
              <div className="text-[12.5px] font-semibold mb-2">Map sections to trades</div>
              <div className="space-y-2">
                {sections.map((section) => (
                  <div key={section.key} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium truncate">{section.name}</div>
                      <div className="text-[11px] text-slate-500 tabular">{formatCents(section.amountCents)}</div>
                    </div>
                    <select
                      value={tradeBySection[section.key] || ''}
                      onChange={(event) => setTradeBySection((current) => ({ ...current, [section.key]: event.target.value }))}
                      className="w-[180px] px-2 py-1.5 rounded-ot-sm border border-hairline text-[12.5px]"
                    >
                      <option value="">Choose a trade</option>
                      {list.map((trade) => (
                        <option key={trade.id} value={trade.id}>{trade.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {rows.length > 0 ? warnings.map((warning) => (
            <p key={warning} className="text-[12px] text-warn">{warning}</p>
          )) : null}
          {blockedByFile ? (
            <p className="text-[12.5px] text-neg" role="alert">
              These sections add to {formatCents(reconcile.totalCents)}, which is not a figure this file states.
              The closest is {fileCheck.nearest?.label} at {formatCents(fileCheck.nearest?.amountCents || 0)}.
              Check the header row before saving.
            </p>
          ) : null}
          {imported.length > 0 ? (
            <div className="text-[13px] flex items-center justify-between">
              <span className="text-slate-600">Imported total</span>
              <span className="tabular font-bold">{formatCents(reconcile.totalCents)}</span>
            </div>
          ) : null}
          {imported.length > 0 && plan && reconcile.totalCents !== plan.targetCents ? (
            <label className="flex items-start gap-2 text-[12.5px] text-slate-600">
              <input type="checkbox" checked={updateTarget} onChange={(event) => setUpdateTarget(event.target.checked)} className="mt-0.5" />
              Use the imported total as the new target. It currently does not match {formatCents(plan.targetCents)}.
            </label>
          ) : null}
          {error ? <p className="text-[12.5px] text-neg">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 text-[13px] text-slate-600">Cancel</button>
            <button
              type="submit"
              disabled={busy || blockedByFile || sections.length === 0}
              className="px-3.5 py-2 rounded-ot-sm bg-accent text-white text-[13px] font-bold disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save import'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
