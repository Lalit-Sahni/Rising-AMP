import React, { useState } from 'react';
import { X, Download, FileText } from 'lucide-react';
import InvoiceDocument from '../invoices/InvoiceDocument';

const InvoicePreview = ({
  invoice,
  business,
  jobName,
  isOpen,
  onClose,
  onSave,
  isNewInvoice = false,
  showSaveButton = true,
  showToast,
}) => {
  const [busy, setBusy] = useState(false);

  const downloadPDF = async () => {
    setBusy(true);
    try {
      const { downloadInvoicePdf } = await import('../../pdf/invoicePdf');
      await downloadInvoicePdf({ invoice, business, jobName });
      if (showToast) showToast('Invoice PDF downloaded', 'success');
    } catch (error) {
      console.error('Error generating PDF:', error);
      if (showToast) showToast('Could not make that PDF', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-steel-900/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-canvas rounded-t-ot md:rounded-ot w-full max-w-5xl h-[100dvh] md:h-[90vh] flex flex-col shadow-[0_24px_64px_rgba(23,24,28,0.28)] border border-hairline overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 md:px-5 py-3.5 border-b border-hairline bg-surface" style={{ paddingTop: 'max(14px, var(--safe-top))' }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-[9px] bg-canvas border border-hairline grid place-items-center shrink-0">
              <FileText className="w-4 h-4 text-ink" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-extrabold text-ink truncate">
                {isNewInvoice ? 'Check the invoice' : `Invoice ${invoice.invoiceNumber || ''}`}
              </h2>
              <p className="text-slate-400 text-[12px] truncate">
                {isNewInvoice ? 'This is what the client receives.' : (invoice.clientName || 'Invoice')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={downloadPDF}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-ot-sm border border-hairline bg-surface text-ink text-[12.5px] font-semibold hover:border-[#D6D9DD] disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{busy ? 'Making PDF…' : 'Download PDF'}</span>
            </button>
            {showSaveButton && isNewInvoice ? (
              <button
                type="button"
                onClick={() => onSave && onSave()}
                className="px-3.5 py-2 rounded-ot-sm bg-accent hover:bg-accent-600 text-white text-[12.5px] font-bold"
              >
                Save invoice
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 grid place-items-center rounded-ot-sm border border-hairline bg-surface text-slate-600 hover:text-ink"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-3 md:p-6" style={{ paddingBottom: 'calc(16px + var(--safe-bottom))' }}>
          <div className="mx-auto max-w-[794px] bg-white border border-hairline shadow-whisper rounded-[6px] overflow-hidden">
            <InvoiceDocument invoice={invoice} business={business} jobName={jobName} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoicePreview;
