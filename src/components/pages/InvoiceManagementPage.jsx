import React, { useEffect, useMemo, useState } from 'react';
import { Download, Eye, FileText, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { fetchJobFiles } from '../../firebase/jobFiles';
import LinkedJobFiles from '../files/LinkedJobFiles';
import NewInvoicePage from './NewInvoicePage';
import InvoicePreview from '../ui/InvoicePreview';
import EmptyState from '../EmptyState';
import { businessFromProfile } from '../invoices/InvoiceDocument';
import { formatMoney, getInvoiceTotal, isInvoiceOverdue, isPaidInvoice, isVoidInvoice } from '../../utils/jobMetrics';
import { parseCalendarDate } from '../../dates';

const DAY = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

function formatInvoiceDate(value) {
  const date = value instanceof Date ? value : parseCalendarDate(value);
  if (!date || Number.isNaN(date.getTime())) return '—';
  return DAY.format(date);
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
];

function statusTone(invoice) {
  const status = String(invoice.status || 'draft').toLowerCase();
  if (status === 'paid') return 'text-pos bg-pos-tint';
  if (status === 'overdue' || isInvoiceOverdue(invoice)) return 'text-neg bg-[#F9E9E7]';
  if (status === 'sent') return 'text-ink bg-canvas border border-hairline';
  return 'text-slate-600 bg-canvas border border-hairline';
}

const InvoiceManagementPage = () => {
  const {
    invoices,
    deleteInvoiceFromFirebase,
    restoreInvoiceFromFirebase,
    purgeInvoiceFromFirebase,
    updateInvoiceStatus,
    showToast,
    projectName: jobName,
    jobId,
    profile,
    authUser,
  } = useApp();
  const business = businessFromProfile(profile, authUser && authUser.email);
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [showRecentlyDeleted, setShowRecentlyDeleted] = useState(false);
  const [jobFiles, setJobFiles] = useState([]);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!jobId) {
      setJobFiles([]);
      return undefined;
    }
    fetchJobFiles(jobId).then((result) => {
      if (!cancelled && result.success) setJobFiles(result.files || []);
    });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const q = searchTerm.trim().toLowerCase();
  const matchesSearch = (invoice) => {
    if (!q) return true;
    return [invoice.clientName, invoice.projectName, jobName, invoice.invoiceNumber, String(getInvoiceTotal(invoice))]
      .some((value) => String(value || '').toLowerCase().includes(q));
  };

  const liveInvoices = useMemo(() => invoices.filter((invoice) => !isVoidInvoice(invoice)), [invoices]);
  const liveRows = liveInvoices.filter((invoice) => matchesSearch(invoice) && (filterStatus === 'all' || invoice.status === filterStatus));
  const deletedRows = invoices.filter((invoice) => isVoidInvoice(invoice) && matchesSearch(invoice));
  const rows = showRecentlyDeleted ? deletedRows : liveRows;

  const totalInvoiced = liveInvoices.reduce((sum, invoice) => sum + getInvoiceTotal(invoice), 0);
  const totalPaid = liveInvoices.filter(isPaidInvoice).reduce((sum, invoice) => sum + getInvoiceTotal(invoice), 0);
  const totalOutstanding = totalInvoiced - totalPaid;
  const overdueCount = liveInvoices.filter((invoice) => isInvoiceOverdue(invoice)).length;

  const handleDeleteInvoice = async (invoiceId) => {
    if (window.confirm('Move this invoice to Recently deleted? It leaves this list and totals ignore it. The number is kept until you remove it for good.')) {
      await deleteInvoiceFromFirebase(invoiceId);
    }
  };

  const handlePurgeInvoice = async (invoiceId) => {
    if (window.confirm('Remove this invoice for good? This cannot be undone. The number will not be reused.')) {
      await purgeInvoiceFromFirebase(invoiceId);
    }
  };

  const handleStatusUpdate = (invoice, next) => {
    const current = invoice.status || 'draft';
    if (next === current) return;
    if (next === 'paid' && !window.confirm(`Mark invoice ${invoice.invoiceNumber || ''} as paid?`)) return;
    updateInvoiceStatus(invoice.id, next);
  };

  const downloadInvoice = async (invoice) => {
    setDownloadingId(invoice.id);
    try {
      const { downloadInvoicePdf } = await import('../../pdf/invoicePdf');
      await downloadInvoicePdf({ invoice, business, jobName });
      showToast('Invoice PDF downloaded', 'success');
    } catch (error) {
      console.error('Error generating PDF:', error);
      showToast('Could not make that PDF', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  if (showNewInvoice) {
    return (
      <NewInvoicePage
        onComplete={() => setShowNewInvoice(false)}
        onCancel={() => setShowNewInvoice(false)}
      />
    );
  }

  const statusControl = (invoice) => (
    showRecentlyDeleted ? (
      <span className="text-[12px] font-semibold text-slate-400">Deleted</span>
    ) : (
      <select
        value={invoice.status || 'draft'}
        onChange={(e) => handleStatusUpdate(invoice, e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className={`px-2.5 py-1 rounded-full text-[12px] font-bold focus:outline-none focus:border-accent appearance-none ${statusTone(invoice)}`}
        aria-label="Invoice status"
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    )
  );

  const rowActions = (invoice) => (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setPreviewInvoice(invoice); }}
        className="w-8 h-8 grid place-items-center border border-hairline rounded-ot-sm text-slate-600 hover:text-ink hover:bg-canvas"
        title="Preview"
        aria-label={`Preview invoice ${invoice.invoiceNumber || ''}`}
      >
        <Eye className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); downloadInvoice(invoice); }}
        disabled={downloadingId === invoice.id}
        className="w-8 h-8 grid place-items-center border border-hairline rounded-ot-sm text-slate-600 hover:text-ink hover:bg-canvas disabled:opacity-50"
        title="Download PDF"
        aria-label={`Download invoice ${invoice.invoiceNumber || ''} as PDF`}
      >
        <Download className={`w-4 h-4 ${downloadingId === invoice.id ? 'animate-pulse' : ''}`} />
      </button>
      {showRecentlyDeleted ? (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); restoreInvoiceFromFirebase(invoice.id); }}
            className="w-8 h-8 grid place-items-center border border-hairline rounded-ot-sm text-slate-600 hover:text-ink hover:bg-canvas"
            title="Restore"
            aria-label={`Restore invoice ${invoice.invoiceNumber || ''}`}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handlePurgeInvoice(invoice.id); }}
            className="w-8 h-8 grid place-items-center border border-hairline rounded-ot-sm text-slate-600 hover:text-neg hover:bg-canvas"
            title="Remove for good"
            aria-label={`Remove invoice ${invoice.invoiceNumber || ''} for good`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleDeleteInvoice(invoice.id); }}
          className="w-8 h-8 grid place-items-center border border-hairline rounded-ot-sm text-slate-600 hover:text-neg hover:bg-canvas"
          title="Move to Recently deleted"
          aria-label={`Move invoice ${invoice.invoiceNumber || ''} to Recently deleted`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </>
  );

  return (
    <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-start mb-[18px] gap-4">
          <div>
            <div className="eyebrow">Billing</div>
            <h1 className="text-[25px] font-extrabold tracking-tight mt-1">Invoices</h1>
            <p className="text-[13.5px] text-slate-600 mt-0.5">
              {overdueCount > 0
                ? `${overdueCount} ${overdueCount === 1 ? 'invoice is' : 'invoices are'} past due.`
                : 'What you have billed on this job, and what has come in.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNewInvoice(true)}
            className="inline-flex items-center gap-1.5 shrink-0 bg-accent hover:bg-accent-600 text-white px-[15px] py-[9px] rounded-[9px] text-[13px] font-bold"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            New invoice
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2.5 md:gap-3.5 mb-4">
          <div className="relative bg-surface rounded-ot p-3 md:p-[18px] border border-hairline shadow-whisper min-w-0">
            <span className="absolute left-3 right-3 md:left-[18px] md:right-[18px] top-0 h-0.5 bg-accent rounded-b" />
            <p className="text-slate-400 text-[11px] md:text-[11.5px] font-semibold">Invoiced</p>
            <p className="tabular text-[17px] md:text-[25px] font-extrabold tracking-tight text-ink mt-1.5 truncate">{formatMoney(totalInvoiced)}</p>
          </div>
          <div className="bg-surface rounded-ot p-3 md:p-[18px] border border-hairline shadow-whisper min-w-0">
            <p className="text-slate-400 text-[11px] md:text-[11.5px] font-semibold">Paid in</p>
            <p className="tabular text-[17px] md:text-[25px] font-extrabold tracking-tight text-pos mt-1.5 truncate">{formatMoney(totalPaid)}</p>
          </div>
          <div className="bg-surface rounded-ot p-3 md:p-[18px] border border-hairline shadow-whisper min-w-0">
            <p className="text-slate-400 text-[11px] md:text-[11.5px] font-semibold">Outstanding</p>
            <p className={`tabular text-[17px] md:text-[25px] font-extrabold tracking-tight mt-1.5 truncate ${overdueCount > 0 ? 'text-neg' : 'text-ink'}`}>{formatMoney(totalOutstanding)}</p>
          </div>
        </div>

        <div className="bg-surface rounded-ot p-3.5 md:p-5 border border-hairline shadow-whisper mb-4">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <label className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="search"
                placeholder="Search by number, client or amount"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-canvas border border-hairline rounded-ot-sm text-ink placeholder:text-slate-400 focus:outline-none focus:border-accent"
              />
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3.5 py-2.5 bg-canvas border border-hairline rounded-ot-sm text-ink focus:outline-none focus:border-accent sm:max-w-[180px]"
              aria-label="Status"
            >
              <option value="all">Any status</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-surface rounded-ot border border-hairline shadow-whisper overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 md:px-5 py-3 border-b border-hairline">
            <p className="text-[13px] text-slate-600">
              {showRecentlyDeleted
                ? 'Off the job until you restore them or remove them for good.'
                : `${rows.length} ${rows.length === 1 ? 'invoice' : 'invoices'}.`}
            </p>
            <button
              type="button"
              onClick={() => setShowRecentlyDeleted((open) => !open)}
              className="shrink-0 text-[12.5px] font-semibold text-accent hover:text-accent-600"
            >
              {showRecentlyDeleted
                ? 'Back to invoices'
                : `Recently deleted${deletedRows.length ? ` (${deletedRows.length})` : ''}`}
            </button>
          </div>

          {rows.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title={showRecentlyDeleted ? 'Recently deleted is empty' : (q || filterStatus !== 'all' ? 'Nothing matches' : 'No invoices yet')}
                body={showRecentlyDeleted
                  ? 'Invoices you move here can be restored or removed for good.'
                  : (q || filterStatus !== 'all'
                    ? 'Try a different search or status.'
                    : 'Raise the first invoice for this job. The number is allocated for you.')}
                actionLabel={!showRecentlyDeleted && !q && filterStatus === 'all' ? 'New invoice' : undefined}
                onAction={!showRecentlyDeleted && !q && filterStatus === 'all' ? () => setShowNewInvoice(true) : undefined}
              />
            </div>
          ) : (
            <>
              {/* Phone: cards */}
              <ul className="md:hidden divide-y divide-hairline">
                {rows.map((invoice) => (
                  <li key={invoice.id} className="px-4 py-3">
                    <button type="button" className="w-full text-left" onClick={() => setPreviewInvoice(invoice)}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="tabular text-[14px] font-extrabold text-ink">{invoice.invoiceNumber || 'Draft'}</div>
                          <div className="text-[13px] text-ink truncate mt-0.5">{invoice.clientName || '—'}</div>
                          <div className="text-[12px] text-slate-400 mt-0.5">
                            Issued {formatInvoiceDate(invoice.invoiceDate)} · Due {formatInvoiceDate(invoice.dueDate)}
                          </div>
                          <LinkedJobFiles files={jobFiles} kind="invoice" recordId={invoice.id} compact />
                        </div>
                        <span className={`tabular text-[15px] font-extrabold shrink-0 ${showRecentlyDeleted ? 'text-slate-400 line-through' : 'text-ink'}`}>
                          {formatMoney(getInvoiceTotal(invoice) || 0, { cents: true })}
                        </span>
                      </div>
                    </button>
                    <div className="flex items-center justify-between gap-2 mt-2.5">
                      <div>{statusControl(invoice)}</div>
                      <div className="flex items-center gap-1.5">{rowActions(invoice)}</div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Desktop: table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-canvas">
                    <tr className="text-[11px] uppercase tracking-wide text-slate-600">
                      <th className="px-5 py-3 text-left font-semibold">Invoice</th>
                      <th className="px-5 py-3 text-left font-semibold">Client</th>
                      <th className="px-5 py-3 text-left font-semibold">Issued</th>
                      <th className="px-5 py-3 text-left font-semibold">Due</th>
                      <th className="px-5 py-3 text-right font-semibold">Amount</th>
                      <th className="px-5 py-3 text-left font-semibold">Status</th>
                      <th className="px-5 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {rows.map((invoice) => (
                      <tr
                        key={invoice.id}
                        className="hover:bg-canvas transition-colors cursor-pointer"
                        onClick={() => setPreviewInvoice(invoice)}
                      >
                        <td className="px-5 py-3.5 text-sm text-ink font-bold tabular">
                          <div>{invoice.invoiceNumber || 'Draft'}</div>
                          <LinkedJobFiles files={jobFiles} kind="invoice" recordId={invoice.id} compact />
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">{invoice.clientName || '—'}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-600 tabular whitespace-nowrap">{formatInvoiceDate(invoice.invoiceDate)}</td>
                        <td className={`px-5 py-3.5 text-sm tabular whitespace-nowrap ${!showRecentlyDeleted && isInvoiceOverdue(invoice) ? 'text-neg font-semibold' : 'text-slate-600'}`}>
                          {formatInvoiceDate(invoice.dueDate)}
                        </td>
                        <td className={`px-5 py-3.5 text-sm text-right tabular font-bold whitespace-nowrap ${showRecentlyDeleted ? 'text-slate-400 line-through' : 'text-ink'}`}>
                          {formatMoney(getInvoiceTotal(invoice) || 0, { cents: true })}
                        </td>
                        <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>{statusControl(invoice)}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1.5">{rowActions(invoice)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {previewInvoice ? (
          <InvoicePreview
            invoice={previewInvoice}
            business={business}
            jobName={jobName}
            isOpen
            onClose={() => setPreviewInvoice(null)}
            isNewInvoice={false}
            showSaveButton={false}
            showToast={showToast}
          />
        ) : null}
      </div>
    </div>
  );
};

export default InvoiceManagementPage;
