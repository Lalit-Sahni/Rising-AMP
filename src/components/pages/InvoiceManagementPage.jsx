import React, { useEffect, useState } from 'react';
import { 
  FileText, 
  Plus, 
  Download, 
  Trash2, 
  Search,
  Filter,
  Eye,
  RotateCcw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { fetchJobFiles } from '../../firebase/jobFiles';
import LinkedJobFiles from '../files/LinkedJobFiles';
import NewInvoicePage from './NewInvoicePage';
import InvoicePreview from '../ui/InvoicePreview';
import { getInvoiceTotal, isPaidInvoice, isVoidInvoice } from '../../utils/jobMetrics';
import { formatCents, lineCents, percentOf, safeParseToCents } from '../../money';

function formatInvoiceDate(value) {
  if (!value) return '—';
  try {
    const date = value.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (error) {
    return '—';
  }
}

const InvoiceManagementPage = () => {
  const { invoices, deleteInvoiceFromFirebase, restoreInvoiceFromFirebase, purgeInvoiceFromFirebase, updateInvoiceStatus, showToast, projectName: jobName, jobId } = useApp();
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showRecentlyDeleted, setShowRecentlyDeleted] = useState(false);
  const [jobFiles, setJobFiles] = useState([]);

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

  // Filter invoices based on search and status
  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.projectName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      jobName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || invoice.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const liveInvoices = invoices.filter((invoice) => !isVoidInvoice(invoice));
  const liveRows = filteredInvoices.filter((invoice) => !isVoidInvoice(invoice));
  const deletedRows = invoices.filter((invoice) => {
    if (!isVoidInvoice(invoice)) return false;
    const matchesSearch = 
      invoice.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.projectName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      jobName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });
  const rows = showRecentlyDeleted ? deletedRows : liveRows;
  const totalInvoiced = liveInvoices.reduce((sum, invoice) => sum + getInvoiceTotal(invoice), 0);
  const totalPaid = liveInvoices.filter(isPaidInvoice).reduce((sum, invoice) => sum + getInvoiceTotal(invoice), 0);
  const totalPending = totalInvoiced - totalPaid;

  const handleDeleteInvoice = async (invoiceId) => {
    if (window.confirm('Move this invoice to Recently deleted? It leaves this list. Totals will ignore it. The number is kept until you remove it for good.')) {
      try {
        await deleteInvoiceFromFirebase(invoiceId);
      } catch (error) {
        showToast('Failed to move invoice', 'error');
      }
    }
  };

  const handleRestoreInvoice = async (invoiceId) => {
    await restoreInvoiceFromFirebase(invoiceId);
  };

  const handlePurgeInvoice = async (invoiceId) => {
    if (window.confirm('Remove this invoice for good? This cannot be undone. The number will not be reused.')) {
      await purgeInvoiceFromFirebase(invoiceId);
    }
  };

  // Handle invoice status update
  const handleStatusUpdate = async (invoiceId, newStatus) => {
    try {
      await updateInvoiceStatus(invoiceId, newStatus);
    } catch (error) {
      showToast('Failed to update status', 'error');
    }
  };

  // Preview invoice
  const handlePreviewInvoice = (invoice) => {
    setPreviewInvoice(invoice);
    setShowPreview(true);
  };

  // Download invoice PDF
  const downloadInvoice = async (invoice) => {
    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = await import('html2canvas');
      
      // Create a temporary div to render the invoice
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '0';
      tempDiv.style.width = '800px';
      tempDiv.style.backgroundColor = 'white';
      tempDiv.style.color = 'black';
      tempDiv.style.padding = '40px';
      tempDiv.style.fontFamily = 'Arial, sans-serif';
      
      // Generate invoice HTML
      tempDiv.innerHTML = `
        <div style="max-width: 720px; margin: 0 auto;">
          <!-- Invoice Header -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px;">
            <div>
              <h1 style="font-size: 32px; font-weight: bold; color: #1f2937; margin-bottom: 8px;">INVOICE</h1>
              <p style="color: #6b7280; margin: 4px 0;">Invoice #: ${invoice.invoiceNumber}</p>
              <p style="color: #6b7280; margin: 4px 0;">Date: ${formatInvoiceDate(invoice.invoiceDate)}</p>
              <p style="color: #6b7280; margin: 4px 0;">Due: ${formatInvoiceDate(invoice.dueDate)}</p>
            </div>
            <div style="text-align: right;">
              <div style="width: 64px; height: 64px; background-color: #2563eb; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-bottom: 8px;">
                <span style="color: white; font-size: 24px;">OT</span>
              </div>
              <p style="font-size: 14px; color: #6b7280; margin: 2px 0;">RisingAMP</p>
              <p style="font-size: 14px; color: #6b7280; margin: 2px 0;">Construction Management</p>
            </div>
          </div>

          <!-- Client Information -->
          <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
            <div>
              <h3 style="font-size: 18px; font-weight: bold; color: #1f2937; margin-bottom: 12px;">Bill To:</h3>
              <p style="font-size: 16px; color: #374151; margin: 4px 0; font-weight: 600;">${invoice.clientName || 'N/A'}</p>
              <p style="font-size: 14px; color: #6b7280; margin: 4px 0;">${invoice.clientEmail || 'N/A'}</p>
              <p style="font-size: 14px; color: #6b7280; margin: 4px 0;">Project: ${invoice.projectName || 'N/A'}</p>
            </div>
            <div style="text-align: right;">
              <h3 style="font-size: 18px; font-weight: bold; color: #1f2937; margin-bottom: 12px;">Invoice Details:</h3>
              <p style="font-size: 14px; color: #6b7280; margin: 4px 0;"><strong>Status:</strong> ${invoice.status || 'Draft'}</p>
              <p style="font-size: 14px; color: #6b7280; margin: 4px 0;"><strong>Total:</strong> ${formatCents(safeParseToCents(invoice.total))}</p>
            </div>
          </div>

          <!-- Invoice Items Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="border: 1px solid #d1d5db; padding: 12px; text-align: left; font-weight: bold; color: #1f2937;">Description</th>
                <th style="border: 1px solid #d1d5db; padding: 12px; text-align: right; font-weight: bold; color: #1f2937;">Quantity</th>
                <th style="border: 1px solid #d1d5db; padding: 12px; text-align: right; font-weight: bold; color: #1f2937;">Unit Cost</th>
                <th style="border: 1px solid #d1d5db; padding: 12px; text-align: right; font-weight: bold; color: #1f2937;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.lineItems?.map(item => `
                <tr>
                  <td style="border: 1px solid #d1d5db; padding: 12px; color: #374151;">${item.description || 'N/A'}</td>
                  <td style="border: 1px solid #d1d5db; padding: 12px; text-align: right; color: #374151;">${item.quantity || 0}</td>
                  <td style="border: 1px solid #d1d5db; padding: 12px; text-align: right; color: #374151;">${formatCents(safeParseToCents(item.unitCost))}</td>
                  <td style="border: 1px solid #d1d5db; padding: 12px; text-align: right; color: #374151;">${formatCents(lineCents(item.quantity, item.unitCost))}</td>
                </tr>
              `).join('') || '<tr><td colspan="4" style="border: 1px solid #d1d5db; padding: 12px; text-align: center; color: #6b7280;">No items</td></tr>'}
            </tbody>
          </table>

          <!-- Totals -->
          <div style="display: flex; justify-content: flex-end; margin-bottom: 30px;">
            <div style="width: 300px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #374151;">Subtotal:</span>
                <span style="color: #374151;">${formatCents(safeParseToCents(invoice.total))}</span>
              </div>
              ${invoice.gst ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span style="color: #374151;">GST (10%):</span>
                  <span style="color: #374151;">${formatCents(percentOf(safeParseToCents(invoice.total), 10))}</span>
                </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 18px; border-top: 2px solid #d1d5db; padding-top: 8px;">
                <span style="color: #1f2937;">Total:</span>
                <span style="color: #1f2937;">${formatCents(safeParseToCents(invoice.total))}</span>
              </div>
            </div>
          </div>

          <!-- Payment Details -->
          ${invoice.bsb && invoice.accountName && invoice.accountNumber ? `
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
              <h3 style="font-size: 16px; font-weight: bold; color: #1f2937; margin-bottom: 12px;">Payment Details:</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div>
                  <p style="font-size: 14px; color: #6b7280; margin: 2px 0;"><strong>BSB:</strong> ${invoice.bsb}</p>
                  <p style="font-size: 14px; color: #6b7280; margin: 2px 0;"><strong>Account Name:</strong> ${invoice.accountName}</p>
                  <p style="font-size: 14px; color: #6b7280; margin: 2px 0;"><strong>Account Number:</strong> ${invoice.accountNumber}</p>
                </div>
              </div>
            </div>
          ` : ''}

          <!-- Notes -->
          ${invoice.notes ? `
            <div style="margin-bottom: 30px;">
              <h3 style="font-size: 16px; font-weight: bold; color: #1f2937; margin-bottom: 8px;">Notes:</h3>
              <p style="font-size: 14px; color: #374151; line-height: 1.5;">${invoice.notes}</p>
            </div>
          ` : ''}

          <!-- Footer -->
          <div style="text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #d1d5db; padding-top: 20px;">
            <p style="margin: 4px 0;">Thank you for your business!</p>
            <p style="margin: 4px 0;">Please make payment within 14 days of invoice date.</p>
          </div>
        </div>
      `;
      
      document.body.appendChild(tempDiv);
      
      // Convert to canvas and then to PDF
      const canvas = await html2canvas.default(tempDiv, {
        scale: 2,
        useCORS: true,
        allowTaint: true
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      // Clean up
      document.body.removeChild(tempDiv);
      
      // Download the PDF
      pdf.save(`Invoice_${invoice.invoiceNumber}_${invoice.clientName}.pdf`);
      showToast('Invoice PDF downloaded successfully!', 'success');
    } catch (error) {
      console.error('Error generating PDF:', error);
      showToast('Error generating PDF', 'error');
    }
  };

  if (showNewInvoice) {
    return (
      <NewInvoicePage 
        onComplete={() => {
          setShowNewInvoice(false);
          showToast('Invoice created successfully!', 'success');
        }}
        onCancel={() => setShowNewInvoice(false)}
      />
    );
  }

  return (
    <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-start mb-[22px] gap-4">
          <div>
            <div className="eyebrow">Billing</div>
            <h1 className="text-[26px] font-bold tracking-tight mt-1">Invoices</h1>
            <p className="text-[13.5px] text-slate-600 mt-0.5">Manage and track job invoices.</p>
          </div>
          <button
            onClick={() => setShowNewInvoice(true)}
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-600 text-white px-3.5 py-2 rounded-ot-sm text-[12.5px] font-medium"
          >
            <Plus className="w-5 h-5" />
            New Invoice
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-4">
          <div className="relative bg-surface rounded-ot p-[18px] border border-hairline shadow-whisper">
            <span className="absolute left-[18px] right-[18px] top-0 h-0.5 bg-accent rounded-b" />
            <p className="text-slate-400 text-xs font-medium">Total invoiced</p>
            <p className="tabular text-[25px] font-semibold text-ink mt-2.5">${totalInvoiced.toLocaleString()}</p>
          </div>
          <div className="bg-surface rounded-ot p-[18px] border border-hairline shadow-whisper">
            <p className="text-slate-400 text-xs font-medium">Paid</p>
            <p className="tabular text-[25px] font-semibold text-ink mt-2.5">${totalPaid.toLocaleString()}</p>
            <p className="text-xs text-pos mt-2">received</p>
          </div>
          <div className="bg-surface rounded-ot p-[18px] border border-hairline shadow-whisper">
            <p className="text-slate-400 text-xs font-medium">Pending</p>
            <p className="tabular text-[25px] font-semibold text-ink mt-2.5">${totalPending.toLocaleString()}</p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-surface rounded-ot p-4 md:p-5 border border-hairline shadow-whisper mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-canvas border border-hairline rounded-ot-sm text-ink placeholder-slate-400 focus:outline-none focus:border-accent"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-canvas border border-hairline rounded-ot-sm text-ink focus:outline-none focus:border-accent appearance-none"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="bg-surface rounded-ot border border-hairline shadow-whisper overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-hairline">
            <p className="text-[13px] text-slate-600">
              {showRecentlyDeleted
                ? 'Off the job until you restore them or remove them for good.'
                : 'Live invoices on this job.'}
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-canvas">
                <tr>
                  <th className="px-5 py-3 text-left text-[11px] font-mono uppercase tracking-wide text-slate-600">Invoice #</th>
                  <th className="px-5 py-3 text-left text-[11px] font-mono uppercase tracking-wide text-slate-600">Client</th>
                  <th className="px-5 py-3 text-left text-[11px] font-mono uppercase tracking-wide text-slate-600">Project</th>
                  <th className="px-5 py-3 text-left text-[11px] font-mono uppercase tracking-wide text-slate-600">Date</th>
                  <th className="px-5 py-3 text-left text-[11px] font-mono uppercase tracking-wide text-slate-600">Due</th>
                  <th className="px-5 py-3 text-right text-[11px] font-mono uppercase tracking-wide text-slate-600">Amount</th>
                  <th className="px-5 py-3 text-center text-[11px] font-mono uppercase tracking-wide text-slate-600">Status</th>
                  <th className="px-5 py-3 text-center text-[11px] font-mono uppercase tracking-wide text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {rows.map((invoice, index) => (
                  <tr key={index} className="hover:bg-canvas transition-colors">
                    <td className="px-5 py-3.5 text-sm text-ink font-medium font-mono">
                      <div>{invoice.invoiceNumber}</div>
                      <LinkedJobFiles
                        files={jobFiles}
                        kind="invoice"
                        recordId={invoice.id}
                        compact
                      />
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">
                      {invoice.clientName}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">
                      {jobName || invoice.projectName}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-600 font-mono">
                      {formatInvoiceDate(invoice.invoiceDate)}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-600 font-mono">
                      {formatInvoiceDate(invoice.dueDate)}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-ink text-right tabular font-medium">
                      {formatCents(safeParseToCents(invoice.total))}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {showRecentlyDeleted ? (
                        <span className="text-[12px] font-semibold text-slate-400">Deleted</span>
                      ) : (
                      <select
                        value={invoice.status || 'draft'}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (next === (invoice.status || 'draft')) return;
                          if (next === 'paid' && !window.confirm('Mark this invoice as paid?')) return;
                          handleStatusUpdate(invoice.id, next);
                        }}
                        className="px-2.5 py-1 bg-surface border border-hairline rounded-ot-sm text-sm text-ink focus:outline-none focus:border-accent"
                      >
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="paid">Paid</option>
                        <option value="overdue">Overdue</option>
                      </select>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handlePreviewInvoice(invoice)}
                          className="pressable w-8 h-8 grid place-items-center border border-hairline rounded-ot-sm text-slate-600 hover:text-ink"
                          title="Preview Invoice"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => downloadInvoice(invoice)}
                          className="pressable w-8 h-8 grid place-items-center border border-hairline rounded-ot-sm text-slate-600 hover:text-ink"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {showRecentlyDeleted ? (
                          <>
                            <button
                              onClick={() => handleRestoreInvoice(invoice.id)}
                              className="pressable w-8 h-8 grid place-items-center border border-hairline rounded-ot-sm text-slate-600 hover:text-ink"
                              title="Restore invoice"
                              aria-label={`Restore invoice ${invoice.invoiceNumber || ''}`}
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handlePurgeInvoice(invoice.id)}
                              className="pressable w-8 h-8 grid place-items-center border border-hairline rounded-ot-sm text-slate-600 hover:text-neg"
                              title="Remove for good"
                              aria-label={`Remove invoice ${invoice.invoiceNumber || ''} for good`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleDeleteInvoice(invoice.id)}
                            className="pressable w-8 h-8 grid place-items-center border border-hairline rounded-ot-sm text-slate-600 hover:text-neg"
                            title="Move to Recently deleted"
                            aria-label={`Move invoice ${invoice.invoiceNumber || ''} to Recently deleted`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {rows.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600">{showRecentlyDeleted ? 'Recently deleted is empty' : 'No invoices found'}</p>
              {!showRecentlyDeleted && (
              <button
                onClick={() => setShowNewInvoice(true)}
                className="mt-4 bg-accent hover:bg-accent-600 text-white px-3.5 py-2 rounded-ot-sm text-[12.5px] font-medium"
              >
                Create Your First Invoice
              </button>
              )}
            </div>
          )}
        </div>

        {showPreview && previewInvoice ? (
          <InvoicePreview
            invoice={previewInvoice}
            isOpen={showPreview}
            onClose={() => {
              setShowPreview(false);
              setPreviewInvoice(null);
            }}
            isNewInvoice={false}
            showSaveButton={false}
          />
        ) : null}
      </div>
    </div>
  );
};

export default InvoiceManagementPage; 