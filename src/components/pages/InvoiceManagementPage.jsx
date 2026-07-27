import React, { useState } from 'react';
import { 
  FileText, 
  Plus, 
  Download, 
  Trash2, 
  DollarSign,
  Calendar,
  User,
  Search,
  Filter,
  Eye
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import NewInvoicePage from './NewInvoicePage';
import InvoicePreview from '../ui/InvoicePreview';

const InvoiceManagementPage = () => {
  const { invoices, deleteInvoiceFromFirebase, updateInvoiceStatus, showToast } = useApp();
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // Filter invoices based on search and status
  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.projectName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || invoice.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  // Calculate total invoiced amount
  const totalInvoiced = invoices.reduce((sum, invoice) => sum + (parseFloat(invoice.total) || 0), 0);
  const totalPaid = invoices.filter(inv => inv.status === 'paid').reduce((sum, invoice) => sum + (parseFloat(invoice.total) || 0), 0);
  const totalPending = totalInvoiced - totalPaid;

  // Handle invoice deletion
  const handleDeleteInvoice = async (invoiceId) => {
    if (window.confirm('Are you sure you want to delete this invoice?')) {
      try {
        await deleteInvoiceFromFirebase(invoiceId);
        showToast('Invoice deleted successfully', 'success');
      } catch (error) {
        showToast('Failed to delete invoice', 'error');
      }
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
              <p style="color: #6b7280; margin: 4px 0;">Date: ${invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString() : 'Invalid Date'}</p>
              <p style="color: #6b7280; margin: 4px 0;">Due: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'Invalid Date'}</p>
            </div>
            <div style="text-align: right;">
              <div style="width: 64px; height: 64px; background-color: #2563eb; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-bottom: 8px;">
                <span style="color: white; font-size: 24px;">OT</span>
              </div>
              <p style="font-size: 14px; color: #6b7280; margin: 2px 0;">Opal Track</p>
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
              <p style="font-size: 14px; color: #6b7280; margin: 4px 0;"><strong>Total:</strong> $${(parseFloat(invoice.total) || 0).toLocaleString()}</p>
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
                  <td style="border: 1px solid #d1d5db; padding: 12px; text-align: right; color: #374151;">$${(parseFloat(item.unitCost) || 0).toFixed(2)}</td>
                  <td style="border: 1px solid #d1d5db; padding: 12px; text-align: right; color: #374151;">$${((parseFloat(item.quantity) || 0) * (parseFloat(item.unitCost) || 0)).toFixed(2)}</td>
                </tr>
              `).join('') || '<tr><td colspan="4" style="border: 1px solid #d1d5db; padding: 12px; text-align: center; color: #6b7280;">No items</td></tr>'}
            </tbody>
          </table>

          <!-- Totals -->
          <div style="display: flex; justify-content: flex-end; margin-bottom: 30px;">
            <div style="width: 300px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #374151;">Subtotal:</span>
                <span style="color: #374151;">$${(parseFloat(invoice.total) || 0).toFixed(2)}</span>
              </div>
              ${invoice.gst ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span style="color: #374151;">GST (10%):</span>
                  <span style="color: #374151;">$${((parseFloat(invoice.total) || 0) * 0.1).toFixed(2)}</span>
                </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 18px; border-top: 2px solid #d1d5db; padding-top: 8px;">
                <span style="color: #1f2937;">Total:</span>
                <span style="color: #1f2937;">$${(parseFloat(invoice.total) || 0).toFixed(2)}</span>
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
    <div className="min-h-screen text-zinc-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-zinc-900">Invoice Management</h1>
          <button
            onClick={() => setShowNewInvoice(true)}
            className="bg-accent hover:bg-accent-dark text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Invoice
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-xl p-6 border border-zinc-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-500 text-sm">Total Invoiced</p>
                <p className="text-2xl font-bold text-zinc-900">${totalInvoiced.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                <DollarSign className="w-6 h-6 text-accent" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-zinc-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-500 text-sm">Total Paid</p>
                <p className="text-2xl font-bold text-emerald-600">${totalPaid.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                <Calendar className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-zinc-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-500 text-sm">Pending</p>
                <p className="text-2xl font-bold text-amber-600">${totalPending.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                <User className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-xl p-6 border border-zinc-200 shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-accent appearance-none"
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
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-100">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-medium text-zinc-700">Invoice #</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-zinc-700">Client</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-zinc-700">Project</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-zinc-700">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-zinc-700">Due</th>
                  <th className="px-6 py-4 text-right text-sm font-medium text-zinc-700">Amount</th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-zinc-700">Status</th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-zinc-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {filteredInvoices.map((invoice, index) => (
                  <tr key={index} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-zinc-900 font-medium">
                      {invoice.invoiceNumber}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-600">
                      {invoice.clientName}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-600">
                      {invoice.projectName}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-600">
                      {invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString() : 'Invalid Date'}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-600">
                      {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'Invalid Date'}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-900 text-right font-medium">
                      ${(parseFloat(invoice.total) || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <select
                        value={invoice.status || 'draft'}
                        onChange={(e) => handleStatusUpdate(invoice.id, e.target.value)}
                        className="px-3 py-1 bg-white border border-zinc-300 rounded text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="paid">Paid</option>
                        <option value="overdue">Overdue</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handlePreviewInvoice(invoice)}
                          className="p-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors"
                          title="Preview Invoice"
                        >
                          <Eye className="w-4 h-4 text-white" />
                        </button>

                        <button
                          onClick={() => downloadInvoice(invoice)}
                          className="p-2 bg-accent hover:bg-accent-dark rounded-lg transition-colors"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4 text-white" />
                        </button>

                        <button
                          onClick={() => handleDeleteInvoice(invoice.id)}
                          className="p-2 bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                          title="Delete Invoice"
                        >
                          <Trash2 className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredInvoices.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-zinc-400 mx-auto mb-4" />
              <p className="text-zinc-500">No invoices found</p>
              <button
                onClick={() => setShowNewInvoice(true)}
                className="mt-4 bg-accent hover:bg-accent-dark text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Create Your First Invoice
              </button>
            </div>
          )}
        </div>

        {/* Invoice Preview Modal */}
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
      </div>
    </div>
  );
};

export default InvoiceManagementPage; 