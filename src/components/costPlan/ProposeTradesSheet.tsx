import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  expenseTradeId,
  listUncodedExpenses,
} from '../../domain/costPlan';
import { expenseDisplayName, formatExpenseDay } from '../../domain/expenseDisplay';
import { formatCents } from '../../money';
import { getExpenseTotalCents, isVoidExpense } from '../../utils/jobMetrics';
import {
  proposeTrades,
  type TradeProposal,
  type TradeRef,
} from '../../actions/proposeTrades';
import type { EvidenceSource } from '../../actions/core';
import type { ApplyTradeRow } from '../../actions/sortToCostPlan';

type DraftRow = TradeProposal & {
  selected: boolean;
  chosenTradeId: string | null;
  chosenSource: EvidenceSource | null;
};

type ProposeTradesSheetProps = {
  open: boolean;
  orgId: string;
  jobId: string;
  allowedJobs: Array<{ projectId?: string; id?: string }> | null | undefined;
  expenses: Array<Record<string, unknown>>;
  trades: TradeRef[];
  sections: TradeRef[];
  isOwner: boolean;
  onClose: () => void;
  showToast: (message: string, type?: string, extras?: { action?: { label: string; onClick: () => void } }) => void;
};

function toDraft(row: TradeProposal): DraftRow {
  return {
    ...row,
    selected: row.status === 'confident',
    chosenTradeId: row.proposedTradeId,
    chosenSource: row.source,
  };
}

function applySource(row: DraftRow): 'user' | 'record' | 'ocr' {
  if (row.chosenSource === 'record' || row.chosenSource === 'ocr' || row.chosenSource === 'user') {
    return row.chosenSource;
  }
  return 'user';
}

async function loadOtherJobExpenses(
  orgId: string,
  jobIds: string[],
): Promise<Array<Record<string, unknown>>> {
  if (!orgId || jobIds.length === 0) return [];
  const { collection, getDocs, limit, query } = await import('firebase/firestore');
  const { db } = await import('../../firebase/config');
  const rows: Array<Record<string, unknown>> = [];
  await Promise.all(jobIds.map(async (id) => {
    const snap = await getDocs(query(
      collection(db, 'organizations', orgId, 'projects', id, 'expenses'),
      limit(1000),
    ));
    snap.docs.forEach((docSnap) => {
      rows.push({ id: docSnap.id, jobId: id, ...docSnap.data() });
    });
  }));
  return rows;
}

type DisplayRow = DraftRow & {
  expenseLabel: string;
  amountLabel: string;
  dayLabel: string;
};

function RowBlock({
  row,
  trades,
  onToggle,
  onPick,
}: {
  row: DisplayRow;
  trades: TradeRef[];
  onToggle: (selected: boolean) => void;
  onPick: (tradeId: string) => void;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-hairline last:border-b-0">
      <input
        type="checkbox"
        checked={row.selected}
        onChange={(event) => onToggle(event.target.checked)}
        className="mt-1.5"
        aria-label={`Select ${row.expenseLabel}`}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-ink truncate">{row.expenseLabel}</div>
        <div className="text-[12px] text-slate-500 tabular">
          {row.amountLabel}
          {row.dayLabel ? ` · ${row.dayLabel}` : ''}
        </div>
        <div className="text-[12px] text-slate-600 mt-1">{row.reason}</div>
        {row.alternatives && row.alternatives.length > 0 ? (
          <div className="text-[11.5px] text-slate-500 mt-0.5">
            Also: {row.alternatives.map((item) => item.tradeName).join(', ')}
          </div>
        ) : null}
      </div>
      <select
        value={row.chosenTradeId || ''}
        onChange={(event) => onPick(event.target.value)}
        className="w-[160px] shrink-0 min-h-[36px] px-2 py-1.5 rounded-ot-sm border border-hairline bg-surface text-[12.5px] text-ink"
        aria-label="Proposed trade"
      >
        <option value="">Uncoded</option>
        {trades.map((trade) => (
          <option key={trade.id} value={trade.id}>{trade.name}</option>
        ))}
      </select>
    </div>
  );
}

export default function ProposeTradesSheet({
  open,
  orgId,
  jobId,
  allowedJobs,
  expenses,
  trades,
  sections,
  isOwner,
  onClose,
  showToast,
}: ProposeTradesSheetProps) {
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [orgCoded, setOrgCoded] = useState<Array<Record<string, unknown>>>([]);
  const [partyNamesById, setPartyNamesById] = useState<Map<string, string> | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [writesOff, setWritesOff] = useState(false);

  const uncoded = useMemo(() => listUncodedExpenses(expenses || []), [expenses]);
  const localCoded = useMemo(
    () => (expenses || []).filter((row) => isVoidExpense(row) === false && expenseTradeId(row)),
    [expenses],
  );
  const expenseById = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    (expenses || []).forEach((row) => {
      if (row && row.id) map.set(String(row.id), row);
    });
    return map;
  }, [expenses]);

  useEffect(() => {
    if (!open) return undefined;
    setError('');
    setOrgCoded(localCoded);
    const otherIds = (allowedJobs || [])
      .map((row) => String(row.projectId || row.id || '').trim())
      .filter((id) => id && id !== jobId);
    if (otherIds.length === 0 || !orgId) return undefined;
    let cancelled = false;
    void loadOtherJobExpenses(orgId, otherIds).then((rows) => {
      if (cancelled) return;
      setOrgCoded([...localCoded, ...rows]);
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, orgId, jobId, allowedJobs, localCoded]);

  useEffect(() => {
    if (!open || !orgId) return undefined;
    let cancelled = false;
    void import('../../firebase/parties')
      .then(({ listParties, followMergedParty }) => (
        listParties().then((parties) => ({ parties, followMergedParty }))
      ))
      .then(({ parties, followMergedParty }) => {
        if (cancelled) return;
        const map = new Map<string, string>();
        parties.forEach((party) => {
          const survivor = party.status === 'active' ? party : followMergedParty(parties, party.id);
          const name = String(survivor?.displayName || '').trim();
          if (name && !map.has(party.id)) map.set(party.id, name);
        });
        setPartyNamesById(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, orgId]);

  useEffect(() => {
    if (!open) return;
    const rows = proposeTrades({
      uncoded,
      orgCoded,
      trades,
      sections,
      partyNamesById,
    });
    setDrafts(rows.map(toDraft));
  }, [open, uncoded, orgCoded, trades, sections, partyNamesById]);

  useEffect(() => {
    if (!open || !orgId) return undefined;
    let cancelled = false;
    void import('../../firebase/assistantWrites')
      .then(({ readAssistantWritesEnabled }) => readAssistantWritesEnabled(orgId))
      .then((setting) => {
        if (!cancelled) setWritesOff(setting === false);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, orgId]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  const displayRows: DisplayRow[] = useMemo(() => drafts.map((row) => {
    const expense = expenseById.get(row.expenseId) || { id: row.expenseId };
    return {
      ...row,
      expenseLabel: expenseDisplayName(expense),
      amountLabel: formatCents(getExpenseTotalCents(expense)),
      dayLabel: formatExpenseDay(expense),
    };
  }), [drafts, expenseById]);

  const split = useMemo(() => ({
    confident: displayRows.filter((row) => row.status === 'confident'),
    uncertain: displayRows.filter((row) => row.status === 'uncertain'),
    none: displayRows.filter((row) => row.status === 'none'),
  }), [displayRows]);
  const confidentCount = split.confident.length;
  const selectedCount = drafts.filter((row) => row.selected && row.chosenTradeId).length;

  const updateRow = (expenseId: string, patch: Partial<DraftRow>) => {
    setDrafts((current) => current.map((row) => (
      row.expenseId === expenseId ? { ...row, ...patch } : row
    )));
  };

  const applyRows = async (rows: ApplyTradeRow[]) => {
    if (rows.length === 0) {
      setError('Nothing ready to accept.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { applyProposedTrades } = await import('../../actions/sortToCostPlan');
      const result = await applyProposedTrades({
        jobId,
        orgId,
        allowedJobs,
        rows,
        viewerIsOwner: isOwner,
      });
      if (result.kind === 'applied') {
        showToast(result.message, 'success', {
          action: { label: 'Undo all', onClick: result.undo },
        });
        onClose();
        return;
      }
      if (result.kind === 'proposed') {
        setError(result.message);
        return;
      }
      setError(result.message);
      showToast(result.message, 'error');
    } catch (applyError) {
      const message = applyError instanceof Error ? applyError.message : 'Could not code those expenses.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const acceptAllConfident = () => {
    const rows = drafts
      .filter((row) => row.status === 'confident' && row.chosenTradeId)
      .map((row) => ({
        expenseId: row.expenseId,
        tradeId: row.chosenTradeId as string,
        source: (row.chosenSource === 'user' ? 'user' : 'record') as ApplyTradeRow['source'],
      }));
    void applyRows(rows);
  };

  const acceptSelected = () => {
    const rows = drafts
      .filter((row) => row.selected && row.chosenTradeId)
      .map((row) => ({
        expenseId: row.expenseId,
        tradeId: row.chosenTradeId as string,
        source: applySource(row),
      }));
    void applyRows(rows);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-steel-900/50"
        aria-label="Close sort to cost plan"
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sort-trades-title"
        className="relative w-full md:max-w-3xl max-h-[90vh] overflow-y-auto bg-surface rounded-t-ot md:rounded-ot border border-hairline shadow-whisper px-4 pt-4 pb-4 md:mx-4 safe-area-bottom"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="sort-trades-title" className="text-[15px] font-extrabold text-ink">
              Sort to cost plan
            </h2>
            <p className="text-[12.5px] text-slate-500 mt-0.5">
              Review every proposal before anything is written. Accept all is the confident set only.
            </p>
            {writesOff ? (
              <p className="text-[12px] text-slate-500 mt-1">
                Assistant writes are off, but anything you accept here is your own choice, so it still saves.
                {isOwner ? ' Turn them back on in Profile.' : ' Only the owner can turn them on.'}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="w-11 h-11 grid place-items-center rounded-ot-sm text-slate-500 hover:bg-canvas disabled:opacity-40"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {split.confident.length > 0 ? (
          <section className="mt-4">
            <h3 className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-400">
              Ready to accept
            </h3>
            <p className="text-[12px] text-slate-500 mt-0.5">
              Same supplier, coded this way at least twice.
            </p>
            <div className="mt-1">
              {split.confident.map((row) => (
                <RowBlock
                  key={row.expenseId}
                  row={row}
                  trades={trades}
                  onToggle={(selected) => updateRow(row.expenseId, { selected })}
                  onPick={(tradeId) => updateRow(row.expenseId, {
                    chosenTradeId: tradeId || null,
                    chosenSource: 'user',
                    selected: Boolean(tradeId),
                  })}
                />
              ))}
            </div>
          </section>
        ) : null}

        {split.uncertain.length > 0 ? (
          <section className="mt-4">
            <h3 className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-400">
              Uncertain
            </h3>
            <p className="text-[12px] text-slate-500 mt-0.5">
              A guess from the description or trade name. Not included in Accept all.
            </p>
            <div className="mt-1">
              {split.uncertain.map((row) => (
                <RowBlock
                  key={row.expenseId}
                  row={row}
                  trades={trades}
                  onToggle={(selected) => updateRow(row.expenseId, { selected })}
                  onPick={(tradeId) => updateRow(row.expenseId, {
                    chosenTradeId: tradeId || null,
                    chosenSource: 'user',
                    selected: Boolean(tradeId),
                  })}
                />
              ))}
            </div>
          </section>
        ) : null}

        {split.none.length > 0 ? (
          <section className="mt-4">
            <h3 className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-400">
              Still uncoded
            </h3>
            <p className="text-[12px] text-slate-500 mt-0.5">
              No evidence. Pick a trade to include it.
            </p>
            <div className="mt-1">
              {split.none.map((row) => (
                <RowBlock
                  key={row.expenseId}
                  row={row}
                  trades={trades}
                  onToggle={(selected) => updateRow(row.expenseId, { selected })}
                  onPick={(tradeId) => updateRow(row.expenseId, {
                    chosenTradeId: tradeId || null,
                    chosenSource: 'user',
                    selected: Boolean(tradeId),
                  })}
                />
              ))}
            </div>
          </section>
        ) : null}

        {displayRows.length === 0 ? (
          <p className="text-[13px] text-slate-600 mt-4">Nothing uncoded on this job.</p>
        ) : null}

        {error ? <p className="text-[12.5px] text-neg mt-3" role="alert">{error}</p> : null}

        <div className="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            disabled={busy || confidentCount === 0}
            onClick={acceptAllConfident}
            className="inline-flex min-h-[44px] items-center justify-center px-3.5 py-2 rounded-ot-sm bg-accent text-white text-[13px] font-bold disabled:opacity-50"
          >
            {busy ? 'Saving…' : `Accept all${confidentCount ? ` (${confidentCount})` : ''}`}
          </button>
          <button
            type="button"
            disabled={busy || selectedCount === 0}
            onClick={acceptSelected}
            className="inline-flex min-h-[44px] items-center justify-center px-3.5 py-2 rounded-ot-sm bg-surface border border-hairline text-[13px] font-bold disabled:opacity-50"
          >
            Accept selected{selectedCount ? ` (${selectedCount})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
