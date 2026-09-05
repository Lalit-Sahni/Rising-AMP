import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Download, FileCheck, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useJobBankDetails, useJobClients, useJobHiaContracts } from '../../hooks/useJobDirectories';
import { uniqueByName } from '../../firebase/partyName';
import { businessFromProfile } from '../invoices/InvoiceDocument';
import EmptyState from '../EmptyState';
import { addCents, dollarsFromUnknown, formatCents, fromCents, safeParseToCents } from '../../money';
import { addDaysYmd, todayYmd } from '../../dates';
import { formatMoney } from '../../utils/jobMetrics';

const STANDARD_STAGE_NAMES = [
  'Deposit',
  'Base stage',
  'Frame stage',
  'Lock-up stage',
  'Fixing stage',
  'Practical completion',
];

const fieldClass = 'w-full px-3.5 py-[10px] bg-surface border border-hairline rounded-ot-sm text-[13.5px] text-ink placeholder:text-slate-400 focus:outline-none focus:border-accent';
const labelClass = 'block text-[12.5px] font-semibold text-ink mb-1.5';

let stageKey = 1;
function blankStage(description = '') {
  return { key: stageKey++, description, percent: '', amount: '' };
}

function pct(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function stageAmountCents(stage) {
  return safeParseToCents(stage.amount);
}

/** Saved contracts list a stage as { stage, description, percent, amount }. */
function claimInvoice(contract, stage, index, stagesCount) {
  const today = todayYmd();
  const client = contract.clientDetails || {};
  const bank = contract.bankDetails || {};
  const amount = dollarsFromUnknown(stage.amount);
  return {
    invoiceNumber: `Stage ${stage.stage || index + 1} of ${stagesCount}`,
    invoiceDate: today,
    dueDate: addDaysYmd(today, 14),
    clientName: client.clientName || '',
    clientEmail: client.clientEmail || '',
    clientPhone: client.clientPhone || '',
    clientAddress: client.clientAddress || '',
    projectName: contract.projectName || '',
    lineItems: [{
      id: 1,
      description: `Stage ${stage.stage || index + 1}: ${stage.description || 'Progress claim'}`,
      quantity: 1,
      unitCost: amount,
      total: amount,
    }],
    includeGST: false,
    bsb: bank.bsb || '',
    accountName: bank.accountName || '',
    accountNumber: bank.accountNumber || '',
    notes: `${pct(stage.percent)}% of the contract sum of ${formatMoney(dollarsFromUnknown(contract.totalAmount))}.`,
  };
}

const HIAContractPage = () => {
  const {
    addHIAContractToFirebase,
    saveClientToFirebase,
    saveUserBankDetailsToFirebase,
    showToast,
    jobId,
    orgId,
    projectName,
    profile,
    authUser,
  } = useApp();

  const hiaQuery = useJobHiaContracts(orgId, jobId);
  const clientsQuery = useJobClients(orgId, jobId);
  const bankQuery = useJobBankDetails(orgId, jobId);
  const business = businessFromProfile(profile, authUser && authUser.email);

  const contracts = useMemo(
    () => (hiaQuery.data || []).filter((row) => String(row.status || '').toLowerCase() !== 'void'),
    [hiaQuery.data],
  );
  const clients = useMemo(() => uniqueByName(clientsQuery.data || [], (row) => row.name), [clientsQuery.data]);

  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [claimBusy, setClaimBusy] = useState(null);
  const [contractSum, setContractSum] = useState('');
  const [stages, setStages] = useState(() => [blankStage()]);
  const [clientId, setClientId] = useState('');
  const [client, setClient] = useState({ clientName: '', clientEmail: '', clientPhone: '', clientAddress: '' });
  const [bank, setBank] = useState({ bsb: '', accountName: '', accountNumber: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!hiaQuery.isLoading && contracts.length === 0) setAdding(true);
  }, [hiaQuery.isLoading, contracts.length]);

  const savedBank = bankQuery.data || null;
  useEffect(() => {
    if (!savedBank) return;
    setBank((prev) => (
      prev.bsb || prev.accountName || prev.accountNumber
        ? prev
        : { bsb: savedBank.bsb || '', accountName: savedBank.accountName || '', accountNumber: savedBank.accountNumber || '' }
    ));
  }, [savedBank]);

  const sumCents = safeParseToCents(contractSum);
  const stagedCents = addCents(...stages.map(stageAmountCents), 0);
  const stagedPct = round2(stages.reduce((sum, stage) => sum + pct(stage.percent), 0));
  const remainingCents = sumCents - stagedCents;

  const pickClient = (id) => {
    setClientId(id);
    const row = clients.find((c) => c.id === id);
    if (!row) return;
    setClient({
      clientName: row.name || '',
      clientEmail: row.email || '',
      clientPhone: row.phone || '',
      clientAddress: row.address || '',
    });
  };

  const setStage = (key, patch) => {
    setStages((prev) => prev.map((stage) => {
      if (stage.key !== key) return stage;
      const next = { ...stage, ...patch };
      if ('percent' in patch && sumCents > 0) {
        next.amount = round2(fromCents(sumCents) * (pct(patch.percent) / 100)).toFixed(2);
      } else if ('amount' in patch && sumCents > 0) {
        next.percent = String(round2((safeParseToCents(patch.amount) / sumCents) * 100));
      }
      return next;
    }));
  };

  const applySum = (value) => {
    setContractSum(value);
    const cents = safeParseToCents(value);
    if (cents > 0) {
      setStages((prev) => prev.map((stage) => (
        stage.percent !== '' ? { ...stage, amount: round2(fromCents(cents) * (pct(stage.percent) / 100)).toFixed(2) } : stage
      )));
    }
  };

  const useStandardNames = () => {
    setStages((prev) => {
      const filled = prev.filter((stage) => stage.description || stage.percent || stage.amount);
      if (filled.length > 0 && !window.confirm('Replace the stages you have typed with the six standard HIA stage names?')) return prev;
      return STANDARD_STAGE_NAMES.map((name) => blankStage(name));
    });
  };

  const resetForm = () => {
    setContractSum('');
    setStages([blankStage()]);
    setClientId('');
    setClient({ clientName: '', clientEmail: '', clientPhone: '', clientAddress: '' });
    setError('');
  };

  const save = async (event) => {
    event.preventDefault();
    setError('');
    if (!(sumCents > 0)) {
      setError('Enter the contract sum first.');
      return;
    }
    const live = stages.filter((stage) => stage.description.trim() || stageAmountCents(stage) > 0);
    if (live.length === 0) {
      setError('Add at least one stage.');
      return;
    }
    if (live.some((stage) => !stage.description.trim())) {
      setError('Every stage needs a name.');
      return;
    }
    if (remainingCents !== 0) {
      setError(`The stages add up to ${formatCents(stagedCents)}, not the contract sum of ${formatCents(sumCents)}.`);
      return;
    }
    if (!client.clientName.trim()) {
      setError('Who is the contract with? Pick a client or type a name.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        projectName: projectName || '',
        totalAmount: fromCents(sumCents),
        stages: live.map((stage, index) => ({
          stage: index + 1,
          description: stage.description.trim(),
          percent: round2(pct(stage.percent)),
          amount: fromCents(stageAmountCents(stage)),
        })),
        clientDetails: { ...client, projectName: projectName || '' },
        bankDetails: { ...bank },
        createdAt: new Date(),
      };
      const result = await addHIAContractToFirebase(payload);
      if (!result || !result.success) return;
      if (!clientId && client.clientName.trim() && saveClientToFirebase) {
        saveClientToFirebase({
          name: client.clientName.trim(),
          email: client.clientEmail || '',
          phone: client.clientPhone || '',
          address: client.clientAddress || '',
        }, { quiet: true }).catch(() => {});
      }
      const bankChanged = ['bsb', 'accountName', 'accountNumber'].some(
        (key) => String(bank[key] || '').trim() !== String((savedBank && savedBank[key]) || '').trim(),
      );
      if (bankChanged && (bank.bsb || bank.accountName || bank.accountNumber) && saveUserBankDetailsToFirebase) {
        saveUserBankDetailsToFirebase({ ...bank }, { quiet: true }).catch(() => {});
      }
      resetForm();
      setAdding(false);
      if (result.hiaContract && result.hiaContract.id) setExpandedId(result.hiaContract.id);
    } finally {
      setSaving(false);
    }
  };

  const downloadClaim = async (contract, stage, index) => {
    const id = `${contract.id}:${index}`;
    setClaimBusy(id);
    try {
      const { downloadInvoicePdf } = await import('../../pdf/invoicePdf');
      const stagesCount = (contract.stages || []).length;
      await downloadInvoicePdf(
        {
          invoice: claimInvoice(contract, stage, index, stagesCount),
          business,
          jobName: projectName || contract.projectName,
          title: 'Progress claim',
          gstNote: 'GST is included in the contract sum',
        },
        `Progress_claim_stage_${stage.stage || index + 1}_${String(contract.projectName || projectName || 'job').replace(/[^\w.-]+/g, '_')}.pdf`,
      );
      showToast(`Stage ${stage.stage || index + 1} claim downloaded`, 'success');
    } catch (err) {
      console.error('Progress claim PDF failed:', err);
      showToast('Could not make that PDF', 'error');
    } finally {
      setClaimBusy(null);
    }
  };

  if (!jobId) {
    return (
      <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
        <EmptyState title="Open a job" body="HIA contracts are saved on a job." actionLabel="Jobs" to="/" />
      </div>
    );
  }

  return (
    <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow">Progress payments</div>
            <h1 className="text-[25px] font-extrabold tracking-tight mt-1">HIA contracts</h1>
            <p className="text-[13.5px] text-slate-600 mt-0.5">
              The contract sum split into the stages you claim. Each stage prints as a progress claim with your details on it.
            </p>
          </div>
          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 shrink-0 bg-accent hover:bg-accent-600 text-white px-[15px] py-[9px] rounded-[9px] text-[13px] font-bold"
            >
              <Plus className="w-4 h-4" strokeWidth={2} />
              Add contract
            </button>
          )}
        </div>

        {adding ? (
          <form onSubmit={save} className="bg-surface border border-hairline rounded-ot p-4 md:p-6 shadow-whisper space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-extrabold">New contract</h2>
                <p className="text-[12.5px] text-slate-400 mt-0.5">Type the stages from the signed contract. Nothing is guessed.</p>
              </div>
              {contracts.length > 0 ? (
                <button type="button" onClick={() => { setAdding(false); resetForm(); }} className="text-[12.5px] font-semibold text-slate-600 hover:text-ink">
                  Cancel
                </button>
              ) : null}
            </div>

            {error ? <p className="text-neg text-sm bg-[#F9E9E7] border border-hairline rounded-ot-sm px-3 py-2">{error}</p> : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Contract sum (GST inclusive) *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={contractSum}
                  onChange={(e) => applySum(e.target.value)}
                  placeholder="1,250,000"
                  className={`${fieldClass} tabular`}
                />
              </div>
              <div>
                <label className={labelClass}>Client *</label>
                {clients.length > 0 ? (
                  <select value={clientId} onChange={(e) => pickClient(e.target.value)} className={`${fieldClass} mb-2`}>
                    <option value="">Type a new client below</option>
                    {clients.map((row) => (
                      <option key={row.id} value={row.id}>{row.name}{row.company ? ` (${row.company})` : ''}</option>
                    ))}
                  </select>
                ) : null}
                <input
                  type="text"
                  value={client.clientName}
                  onChange={(e) => { setClientId(''); setClient({ ...client, clientName: e.target.value }); }}
                  placeholder="Client name"
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Client email</label>
                <input type="email" value={client.clientEmail} onChange={(e) => setClient({ ...client, clientEmail: e.target.value })} className={fieldClass} placeholder="client@example.com" />
              </div>
              <div>
                <label className={labelClass}>Client phone</label>
                <input type="tel" value={client.clientPhone} onChange={(e) => setClient({ ...client, clientPhone: e.target.value })} className={fieldClass} placeholder="04XX XXX XXX" />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Client address</label>
                <input type="text" value={client.clientAddress} onChange={(e) => setClient({ ...client, clientAddress: e.target.value })} className={fieldClass} placeholder="Street, suburb, state" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <label className={`${labelClass} mb-0`}>Stages *</label>
                <button type="button" onClick={useStandardNames} className="text-[12.5px] font-semibold text-accent hover:text-accent-600">
                  Use the six standard HIA stage names
                </button>
              </div>
              <div className="space-y-2">
                {stages.map((stage, index) => (
                  <div key={stage.key} className="grid grid-cols-[28px_minmax(0,1fr)_78px_120px_36px] gap-2 items-center">
                    <span className="text-[12px] font-bold text-slate-400 tabular text-center">{index + 1}</span>
                    <input
                      type="text"
                      value={stage.description}
                      onChange={(e) => setStage(stage.key, { description: e.target.value })}
                      placeholder="Stage name"
                      className={fieldClass}
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={stage.percent}
                      onChange={(e) => setStage(stage.key, { percent: e.target.value })}
                      placeholder="%"
                      className={`${fieldClass} tabular text-right`}
                      aria-label="Percent"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={stage.amount}
                      onChange={(e) => setStage(stage.key, { amount: e.target.value })}
                      placeholder="$"
                      className={`${fieldClass} tabular text-right`}
                      aria-label="Amount"
                    />
                    <button
                      type="button"
                      onClick={() => setStages((prev) => (prev.length > 1 ? prev.filter((s) => s.key !== stage.key) : prev))}
                      className="w-9 h-9 grid place-items-center rounded-ot-sm border border-hairline text-slate-400 hover:text-neg"
                      aria-label="Remove stage"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
                <button type="button" onClick={() => setStages((prev) => [...prev, blankStage()])} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink border border-hairline rounded-ot-sm px-3 py-2 hover:bg-canvas">
                  <Plus className="w-4 h-4" />
                  Add a stage
                </button>
                <p className={`text-[12.5px] tabular ${remainingCents === 0 && sumCents > 0 ? 'text-pos font-semibold' : 'text-slate-600'}`}>
                  {sumCents > 0
                    ? (remainingCents === 0
                      ? `All ${formatCents(sumCents)} allocated (${stagedPct}%)`
                      : `${formatCents(Math.abs(remainingCents))} ${remainingCents > 0 ? 'still to allocate' : 'over the contract sum'} · ${stagedPct}% so far`)
                    : 'Enter the contract sum to work out amounts from percentages.'}
                </p>
              </div>
            </div>

            <div>
              <label className={labelClass}>Bank details on each claim</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input type="text" value={bank.accountName} onChange={(e) => setBank({ ...bank, accountName: e.target.value })} placeholder="Account name" className={fieldClass} />
                <input type="text" inputMode="numeric" value={bank.bsb} onChange={(e) => setBank({ ...bank, bsb: e.target.value })} placeholder="BSB" className={`${fieldClass} tabular`} />
                <input type="text" inputMode="numeric" value={bank.accountNumber} onChange={(e) => setBank({ ...bank, accountNumber: e.target.value })} placeholder="Account number" className={`${fieldClass} tabular`} />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-hairline">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-[9px] rounded-ot-sm bg-accent hover:bg-accent-600 disabled:opacity-50 text-white text-[13px] font-bold"
              >
                {saving ? 'Saving…' : 'Save contract'}
              </button>
            </div>
          </form>
        ) : null}

        {hiaQuery.isLoading ? (
          <p className="text-[13px] text-slate-400">Loading contracts…</p>
        ) : contracts.length === 0 && !adding ? (
          <EmptyState title="No contracts yet" body="Add the signed HIA contract's stages once, then print a claim for each stage when it falls due." actionLabel="Add contract" onAction={() => setAdding(true)} />
        ) : (
          contracts.map((contract) => {
            const open = expandedId === contract.id;
            const contractStages = Array.isArray(contract.stages) ? contract.stages : [];
            const clientName = contract.clientDetails && contract.clientDetails.clientName;
            return (
              <div key={contract.id} className="bg-surface border border-hairline rounded-ot shadow-whisper overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedId(open ? null : contract.id)}
                  className="w-full flex items-center gap-3.5 px-4 md:px-5 py-4 text-left"
                >
                  <span className="w-[38px] h-[38px] rounded-[9px] bg-canvas border border-hairline grid place-items-center text-slate-600 shrink-0">
                    <FileCheck className="w-[18px] h-[18px]" strokeWidth={1.7} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-[14.5px] font-extrabold truncate">{contract.projectName || projectName || 'HIA contract'}</b>
                    <small className="block text-[12.5px] text-slate-400 truncate">
                      {[clientName, `${contractStages.length} ${contractStages.length === 1 ? 'stage' : 'stages'}`].filter(Boolean).join(' · ')}
                    </small>
                  </span>
                  <span className="tabular text-[15px] font-extrabold shrink-0">{formatMoney(dollarsFromUnknown(contract.totalAmount))}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open ? (
                  <div className="border-t border-hairline">
                    {contractStages.length === 0 ? (
                      <p className="px-5 py-4 text-[13px] text-slate-400">This contract was saved without stages.</p>
                    ) : contractStages.map((stage, index) => {
                      const busyId = `${contract.id}:${index}`;
                      return (
                        <div key={index} className="flex items-center gap-3 px-4 md:px-5 py-3 border-b border-hairline last:border-0">
                          <span className="w-7 h-7 rounded-full bg-canvas border border-hairline grid place-items-center text-[11px] font-bold text-slate-600 shrink-0 tabular">
                            {stage.stage || index + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <b className="block text-[13.5px] font-bold truncate">{stage.description || `Stage ${index + 1}`}</b>
                            <small className="block text-[12px] text-slate-400 tabular">{pct(stage.percent)}% of the contract sum</small>
                          </span>
                          <span className="tabular text-[13.5px] font-bold shrink-0">{formatMoney(dollarsFromUnknown(stage.amount))}</span>
                          <button
                            type="button"
                            onClick={() => downloadClaim(contract, stage, index)}
                            disabled={claimBusy === busyId}
                            className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-ot-sm border border-hairline text-[12px] font-semibold text-ink hover:bg-canvas disabled:opacity-50"
                            title="Download this stage as a progress claim PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{claimBusy === busyId ? 'Making…' : 'Claim PDF'}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default HIAContractPage;
