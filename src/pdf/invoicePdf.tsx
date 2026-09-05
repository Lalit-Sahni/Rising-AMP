import React from 'react';
import { createRoot } from 'react-dom/client';
import InvoiceDocument, { type InvoiceBusiness } from '../components/invoices/InvoiceDocument';

type Options = {
  invoice: Record<string, any>;
  business: InvoiceBusiness;
  jobName?: string;
};

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Renders the same InvoiceDocument the preview shows into an off-screen A4
 * frame and prints it to a PDF. jspdf and html2canvas load only here.
 */
export async function renderInvoicePdf({ invoice, business, jobName }: Options) {
  const [{ jsPDF }, html2canvasModule] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);
  const html2canvas = html2canvasModule.default;

  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.width = '794px';
  host.style.background = '#ffffff';
  document.body.appendChild(host);
  const root = createRoot(host);

  try {
    root.render(<InvoiceDocument invoice={invoice} business={business} jobName={jobName} fixedWidth />);
    await nextFrame();
    await nextFrame();
    if (typeof document !== 'undefined' && 'fonts' in document) {
      try {
        await (document as Document & { fonts: FontFaceSet }).fonts.ready;
      } catch (error) {
        // Fonts are a nicety; the PDF still prints.
      }
    }
    const node = host.firstElementChild as HTMLElement | null;
    if (!node) throw new Error('Invoice did not render');
    const canvas = await html2canvas(node, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * pageWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    return pdf;
  } finally {
    root.unmount();
    host.remove();
  }
}

function safeName(value: unknown): string {
  return String(value || '').replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'invoice';
}

export function invoiceFileName(invoice: Record<string, any>): string {
  const parts = ['Invoice', invoice.invoiceNumber, invoice.clientName].filter(Boolean).map(safeName);
  return `${parts.join('_')}.pdf`;
}

export async function downloadInvoicePdf(options: Options, fileName?: string) {
  const pdf = await renderInvoicePdf(options);
  pdf.save(fileName || invoiceFileName(options.invoice));
}
