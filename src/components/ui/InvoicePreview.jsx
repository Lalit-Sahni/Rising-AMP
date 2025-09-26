import React, { useState, useRef } from 'react';
import { X, Download, Eye, EyeOff, RotateCcw, FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const InvoicePreview = ({ 
  invoice, 
  isOpen, 
  onClose, 
  onSave, 
  isNewInvoice = false,
  showSaveButton = true 
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showRawData, setShowRawData] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const invoiceRef = useRef();

  const calculateSubtotal = () => {
    if (!invoice.lineItems) return 0;
    return invoice.lineItems.reduce((sum, item) => {
      const total = parseFloat(item.total) || 0;
      return sum + total;
    }, 0);
  };

  const calculateGST = () => {
    return invoice.includeGST ? calculateSubtotal() * 0.1 : 0;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateGST();
  };

  const generatePDF = async () => {
    if (!invoiceRef.current) return;
    
    setIsGenerating(true);
    try {
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
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

      const pdfBlob = pdf.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      setPdfUrl(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadPDF = async () => {
    if (!pdfUrl) {
      await generatePDF();
      return;
    }

    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `Invoice-${invoice.invoiceNumber || 'Draft'}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSave = async () => {
    if (onSave) {
      await onSave();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                Invoice Preview
              </h2>
              <p className="text-slate-400 text-sm">
                {isNewInvoice ? 'Review before saving' : 'Invoice details'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle Raw Data */}
            <button
              onClick={() => setShowRawData(!showRawData)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title={showRawData ? 'Hide raw data' : 'Show raw data'}
            >
              {showRawData ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>

            {/* Generate PDF */}
            <button
              onClick={generatePDF}
              disabled={isGenerating}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
              title="Generate PDF"
            >
              {isGenerating ? (
                <RotateCcw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </button>

            {/* Download PDF */}
            {pdfUrl && (
              <button
                onClick={downloadPDF}
                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
              >
                Download PDF
              </button>
            )}

            {/* Save Button for New Invoices */}
            {showSaveButton && isNewInvoice && (
              <button
                onClick={handleSave}
                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors"
              >
                Save Invoice
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {showRawData ? (
            /* Raw Data View */
            <div className="h-full overflow-auto p-6">
              <div className="bg-slate-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Invoice Data</h3>
                <pre className="text-sm text-slate-300 overflow-auto">
                  {JSON.stringify(invoice, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            /* Invoice Preview */
            <div className="h-full overflow-auto p-6">
              <div 
                ref={invoiceRef}
                className="bg-white text-black mx-auto max-w-4xl min-h-full p-8 rounded-xl shadow-lg"
              >
                {/* Invoice Header */}
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">INVOICE</h1>
                    <p className="text-gray-600 mb-1">Invoice #: {invoice.invoiceNumber || 'Draft'}</p>
                    <p className="text-gray-600 mb-1">
                      Date: {invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString() : 'Not set'}
                    </p>
                    <p className="text-gray-600">
                      Due: {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'Not set'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center mb-2">
                      <span className="text-white text-2xl font-bold">BT</span>
                    </div>
                    <p className="text-sm text-gray-600">BuildTrack</p>
                    <p className="text-sm text-gray-600">Construction Management</p>
                  </div>
                </div>

                                 {/* Client Information */}
                 <div className="grid grid-cols-2 gap-8 mb-8">
                   <div>
                     <h3 className="text-lg font-semibold text-gray-800 mb-3">Bill To:</h3>
                     <p className="text-gray-700 font-medium">{invoice.clientName || 'Client Name'}</p>
                     {invoice.clientCompany && (
                       <p className="text-gray-600 font-medium">{invoice.clientCompany}</p>
                     )}
                     {invoice.clientEmail && (
                       <p className="text-gray-600">{invoice.clientEmail}</p>
                     )}
                     {invoice.clientPhone && (
                       <p className="text-gray-600">{invoice.clientPhone}</p>
                     )}
                     {invoice.clientAddress && (
                       <p className="text-gray-600 mt-2">{invoice.clientAddress}</p>
                     )}
                     {invoice.clientABN && (
                       <p className="text-gray-600">ABN: {invoice.clientABN}</p>
                     )}
                   </div>
                   <div>
                     <h3 className="text-lg font-semibold text-gray-800 mb-3">Project:</h3>
                     <p className="text-gray-700 font-medium">{invoice.projectName || 'Project Name'}</p>
                     <p className="text-gray-600">Ref: {invoice.projectReference || 'N/A'}</p>
                   </div>
                 </div>

                {/* Line Items */}
                <div className="mb-8">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b-2 border-gray-300">
                        <th className="text-left py-3 px-4 font-semibold text-gray-800">Description</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-800">Quantity</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-800">Unit Cost</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-800">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.lineItems && invoice.lineItems.map((item, index) => (
                        <tr key={item.id || index} className="border-b border-gray-200">
                          <td className="py-3 px-4 text-gray-700">{item.description || 'Item description'}</td>
                          <td className="py-3 px-4 text-right text-gray-700">{item.quantity || 0}</td>
                          <td className="py-3 px-4 text-right text-gray-700">
                            ${(item.unitCost || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right text-gray-700 font-medium">
                            ${(item.total || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="flex justify-end mb-8">
                  <div className="w-64">
                    <div className="flex justify-between py-2">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="text-gray-800 font-medium">${calculateSubtotal().toFixed(2)}</span>
                    </div>
                    {invoice.includeGST && (
                      <div className="flex justify-between py-2">
                        <span className="text-gray-600">GST (10%):</span>
                        <span className="text-gray-800 font-medium">${calculateGST().toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-2 border-t-2 border-gray-300">
                      <span className="text-gray-800 font-semibold">Total:</span>
                      <span className="text-gray-800 font-bold text-lg">${calculateTotal().toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Instructions */}
                {invoice.paymentInstructions && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Payment Instructions:</h3>
                    <p className="text-gray-700">{invoice.paymentInstructions}</p>
                  </div>
                )}

                {/* Bank Details */}
                {(invoice.bsb || invoice.accountName || invoice.accountNumber) && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Bank Details:</h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      {invoice.bsb && <p className="text-gray-700 mb-1">BSB: {invoice.bsb}</p>}
                      {invoice.accountName && <p className="text-gray-700 mb-1">Account Name: {invoice.accountName}</p>}
                      {invoice.accountNumber && <p className="text-gray-700">Account Number: {invoice.accountNumber}</p>}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {invoice.notes && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Notes:</h3>
                    <p className="text-gray-700">{invoice.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvoicePreview; 