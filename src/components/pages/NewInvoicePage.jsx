import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, 
  User, 
  Plus, 
  Trash2, 
  Eye, 
  Download, 
  Save,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  ChevronDown
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import InvoicePreview from '../ui/InvoicePreview';
import ClientManager from '../ui/ClientManager';
import { getClients } from '../../data';
import { uniqueByName } from '../../firebase/partyName';
import { allocateInvoiceNumber } from '../../firebase/invoiceNumbers';
import { defaultDueYmd, toYmd, ymdToLocalDate } from '../../dates';
import { addCents, dollarsFromUnknown, formatCents, fromCents, lineCents, parseQuantity, percentOf, safeParseToCents } from '../../money';

const NewInvoicePage = ({ onComplete }) => {
  const { addInvoiceToFirebase, showToast, addProgressPaymentToFirebase, jobId, projectName: jobName, saveClientToFirebase, membership } = useApp();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showClientManager, setShowClientManager] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [numberError, setNumberError] = useState('');
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  
  const [formData, setFormData] = useState({
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    clientAddress: '',
    clientCompany: '',
    clientABN: '',
    projectName: jobName || '',
    projectReference: '',
    invoiceDate: new Date(),
    dueDate: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 30),
    includeGST: true,
    notes: '',
    paymentInstructions: '',
    bsb: '',
    accountName: '',
    accountNumber: '',
    lineItems: [
      {
        id: 1,
        description: '',
        quantity: 1,
        unitCost: 0,
        total: 0
      }
    ]
  });

  const pdfRef = useRef();

  const takeInvoiceNumber = async () => {
    setNumberError('');
    try {
      const number = await allocateInvoiceNumber(membership && membership.orgId);
      setInvoiceNumber(number);
      return number;
    } catch (error) {
      setInvoiceNumber('');
      setNumberError(error.message || 'Could not allocate an invoice number.');
      throw error;
    }
  };

  useEffect(() => {
    let cancelled = false;
    takeInvoiceNumber().catch(() => {});
    return () => {
      cancelled = true;
    };
    // Allocate once when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membership && membership.orgId]);

  // Load clients from Firebase on mount
  useEffect(() => {
    const loadClients = async () => {
      if (!jobId) return;
      
      try {
        const result = await getClients(jobId);
        if (result.success) {
          setClients(uniqueByName(result.clients || [], (row) => row.name));
        } else {
          console.error('Error loading clients:', result.error);
          showToast('Failed to load clients', 'error');
          setClients([]); // Ensure it's an array
        }
      } catch (error) {
        console.error('Error loading clients:', error);
        showToast('Failed to load clients', 'error');
        setClients([]); // Ensure it's an array
      }
    };

    loadClients();
  }, [jobId, showToast]);

  const handleClientSelect = (client) => {
    setSelectedClient(client);
    setFormData(prev => ({
      ...prev,
      clientName: client.name || '',
      clientEmail: client.email || '',
      clientPhone: client.phone || '',
      clientAddress: client.address || '',
      clientCompany: client.company || '',
      clientABN: client.abn || ''
    }));
  };

  const clearClientSelection = () => {
    setSelectedClient(null);
    setFormData(prev => ({
      ...prev,
      clientName: '',
      clientEmail: '',
      clientPhone: '',
      clientAddress: '',
      clientCompany: '',
      clientABN: ''
    }));
  };

  const calculateSubtotal = () => {
    try {
      return fromCents(
        addCents(...formData.lineItems.map((item) => lineCents(item.quantity, item.unitCost)))
      );
    } catch (error) {
      console.error('Error calculating subtotal:', error);
      return 0;
    }
  };

  const calculateGST = () => {
    try {
      return formData.includeGST ? fromCents(percentOf(safeParseToCents(calculateSubtotal()), 10)) : 0;
    } catch (error) {
      console.error('Error calculating GST:', error);
      return 0;
    }
  };

  const calculateTotal = () => {
    try {
      return calculateSubtotal() + calculateGST();
    } catch (error) {
      console.error('Error calculating total:', error);
      return 0;
    }
  };

  const updateLineItemTotal = (id, field, value) => {
    setFormData(prev => ({
      ...prev,
      lineItems: prev.lineItems.map(item => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };
          if (field === 'quantity' || field === 'unitCost') {
            const quantity = field === 'quantity' ? value : item.quantity;
            const unitCost = field === 'unitCost' ? value : item.unitCost;
            updatedItem.total = fromCents(lineCents(quantity, unitCost));
          }
          return updatedItem;
        }
        return item;
      })
    }));
  };

  const addLineItem = () => {
    const newId = Math.max(...formData.lineItems.map(item => item.id)) + 1;
    setFormData(prev => ({
      ...prev,
      lineItems: [...prev.lineItems, {
        id: newId,
        description: '',
        quantity: 1,
        unitCost: 0,
        total: 0
      }]
    }));
  };

  const removeLineItem = (id) => {
    if (formData.lineItems.length > 1) {
      setFormData(prev => ({
        ...prev,
        lineItems: prev.lineItems.filter(item => item.id !== id)
      }));
    }
  };

  const validateStep = (step) => {
    switch (step) {
      case 1:
        if (!formData.clientName.trim()) {
          showToast('Please enter client name', 'error');
          return false;
        }
        if (!formData.projectName.trim()) {
          showToast('Please enter project name', 'error');
          return false;
        }
        return true;
      case 2:
        const hasValidItems = formData.lineItems.some(item => 
          item.description.trim() && item.quantity > 0 && item.unitCost > 0
        );
        if (!hasValidItems) {
          showToast('Please add at least one valid line item', 'error');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 3));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const generatePDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = await import('html2canvas');
      
      const canvas = await html2canvas.default(pdfRef.current);
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
      
      return pdf;
    } catch (error) {
      console.error('Error generating PDF:', error);
      showToast('Error generating PDF', 'error');
      return null;
    }
  };

  const downloadPDF = async () => {
    const pdf = await generatePDF();
    if (pdf) {
      pdf.save(`Invoice-${invoiceNumber}.pdf`);
      showToast('Invoice downloaded successfully', 'success');
    }
  };

  const saveInvoice = async () => {
    if (!invoiceNumber) {
      showToast(numberError || 'Wait for an invoice number from the server.', 'error');
      return;
    }
    try {
      setIsSubmitting(true);
      
      const invoiceData = {
        invoiceNumber,
        ...formData,
        invoiceDate: toYmd(formData.invoiceDate instanceof Date ? formData.invoiceDate : new Date()),
        dueDate: toYmd(formData.dueDate instanceof Date ? formData.dueDate : new Date()),
        subtotal: calculateSubtotal(),
        gst: calculateGST(),
        total: calculateTotal(),
        status: 'draft',
      };

      const savedInvoice = await addInvoiceToFirebase(invoiceData);
      try {
        if (formData.clientName && formData.clientName.trim() && saveClientToFirebase) {
          await saveClientToFirebase({
            name: formData.clientName.trim(),
            email: formData.clientEmail || '',
            phone: formData.clientPhone || '',
            address: formData.clientAddress || '',
            company: formData.clientCompany || '',
            abn: formData.clientABN || '',
          }, { quiet: true });
        }
      } catch (error) {
        console.error('Error saving invoice client:', error);
      }
      showToast('Invoice saved successfully', 'success');
      
      const progressPaymentData = {
        date: formData.invoiceDate,
        amount: calculateTotal(),
        description: `Invoice ${invoiceNumber} - ${formData.projectName}`,
        type: 'invoice',
        invoiceId: savedInvoice.invoiceId
      };
      
      try {
        await addProgressPaymentToFirebase(progressPaymentData);
        showToast('Invoice added to budget tracking', 'success');
      } catch (error) {
        console.error('Error adding to budget:', error);
        showToast('Invoice saved but budget update failed', 'warning');
      }
      
      setFormData({
        clientName: '',
        clientEmail: '',
        clientPhone: '',
        projectName: jobName || '',
        projectReference: '',
        invoiceDate: new Date(),
        dueDate: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 30),
        includeGST: true,
        notes: '',
        paymentInstructions: '',
        bsb: '',
        accountName: '',
        accountNumber: '',
        lineItems: [{ id: 1, description: '', quantity: 1, unitCost: 0, total: 0 }]
      });
      setInvoiceNumber('');
      takeInvoiceNumber().catch(() => {});
      setCurrentStep(1);
      
      if (onComplete) {
        onComplete();
      }
      
    } catch (error) {
      console.error('Error saving invoice:', error);
      showToast('Failed to save invoice', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewInvoice = async () => {
    if (validateStep(currentStep)) {
      setShowPreview(true);
    }
  };

  if (!formData || !formData.lineItems) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="text-neg text-lg mb-4">Something went wrong</div>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-accent hover:bg-accent-600 text-white px-3.5 py-2 rounded-ot-sm"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-ink px-4 py-6 md:px-[26px]">
      <div className="max-w-5xl mx-auto space-y-4">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow">Billing</div>
            <h1 className="text-[26px] font-semibold tracking-tight mt-1">New invoice</h1>
            <p className="text-[13.5px] text-slate-600 mt-0.5">Create an invoice for this job.</p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={previewInvoice}
              className="inline-flex items-center gap-2 border border-hairline hover:border-[#D6D9DD] text-ink px-3.5 py-2 rounded-ot-sm text-[12.5px] font-medium"
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
            <button
              onClick={saveInvoice}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent-600 disabled:opacity-50 text-white px-3.5 py-2 rounded-ot-sm text-[12.5px] font-medium"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center space-x-4 mb-8">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep >= step 
                  ? 'bg-accent text-white' 
                  : 'bg-canvas text-slate-400 border border-hairline'
              }`}>
                {currentStep > step ? <CheckCircle className="w-4 h-4" /> : step}
              </div>
              {step < 3 && (
                <div className={`w-16 h-1 mx-2 ${
                  currentStep > step ? 'bg-accent' : 'bg-hairline'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Labels */}
        <div className="flex justify-center space-x-8 mb-8">
          <span className={`text-sm ${currentStep === 1 ? 'text-accent font-medium' : 'text-slate-400'}`}>
            Client & Project Details
          </span>
          <span className={`text-sm ${currentStep === 2 ? 'text-accent font-medium' : 'text-slate-400'}`}>
            Line Items
          </span>
          <span className={`text-sm ${currentStep === 3 ? 'text-accent font-medium' : 'text-slate-400'}`}>
            Review & Generate
          </span>
        </div>

        {/* Form Content */}
        <div className="bg-surface rounded-ot p-6 shadow-whisper border border-hairline">
          
          {/* Step 1: Client & Project Details */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-ink mb-6">Client & Project Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Client Information */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-ink flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Client Information
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowClientManager(true)}
                        className="px-3 py-1.5 bg-accent hover:bg-accent-600 text-white text-[12px] font-bold rounded-ot-sm transition-colors flex items-center gap-1"
                      >
                        <User className="w-3 h-3" />
                        Manage Clients
                      </button>
                    </div>
                  </div>

                  {/* Client Selection */}
                  <div>
                    <label className="block text-sm font-medium text-ink mb-2">
                      Select Client
                    </label>
                    <div className="relative">
                      <select
                        value={selectedClient ? selectedClient.id : ''}
                        onChange={(e) => {
                          if (e.target.value === '') {
                            clearClientSelection();
                          } else {
                            const client = clients.find(c => c.id === e.target.value);
                            if (client) handleClientSelect(client);
                          }
                        }}
                        className="w-full px-4 py-3 bg-canvas border border-hairline rounded-ot-sm text-ink focus:outline-none focus:border-accent appearance-none"
                      >
                        <option value="">Select a client or enter manually</option>
                        {(clients || []).map(client => (
                          <option key={client.id} value={client.id}>
                            {client.name} {client.company ? `(${client.company})` : ''}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  {selectedClient && (
                    <div className="p-3 bg-accent-tint border border-hairline rounded-ot-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-ink text-sm font-medium">
                          ✓ Using saved client: {selectedClient.name}
                        </span>
                        <button
                          type="button"
                          onClick={clearClientSelection}
                          className="text-slate-600 hover:text-ink text-sm"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Client Name *
                    </label>
                    <input
                      type="text"
                      value={formData.clientName}
                      onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
                      className="w-full px-4 py-3 bg-canvas border border-hairline rounded-ot-sm text-ink placeholder-slate-400 focus:outline-none focus:border-accent"
                      placeholder="Enter client name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={formData.clientCompany}
                      onChange={(e) => setFormData(prev => ({ ...prev, clientCompany: e.target.value }))}
                      className="w-full px-4 py-3 bg-canvas border border-hairline rounded-ot-sm text-ink placeholder-slate-400 focus:outline-none focus:border-accent"
                      placeholder="Enter company name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={formData.clientEmail}
                      onChange={(e) => setFormData(prev => ({ ...prev, clientEmail: e.target.value }))}
                      className="w-full px-4 py-3 bg-canvas border border-hairline rounded-ot-sm text-ink placeholder-slate-400 focus:outline-none focus:border-accent"
                      placeholder="client@example.com"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={formData.clientPhone}
                      onChange={(e) => setFormData(prev => ({ ...prev, clientPhone: e.target.value }))}
                      className="w-full px-4 py-3 bg-canvas border border-hairline rounded-ot-sm text-ink placeholder-slate-400 focus:outline-none focus:border-accent"
                      placeholder="+61 400 000 000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Address
                    </label>
                    <textarea
                      value={formData.clientAddress}
                      onChange={(e) => setFormData(prev => ({ ...prev, clientAddress: e.target.value }))}
                      rows="2"
                      className="w-full px-4 py-3 bg-canvas border border-hairline rounded-ot-sm text-ink placeholder-slate-400 focus:outline-none focus:border-accent"
                      placeholder="Enter client address"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      ABN
                    </label>
                    <input
                      type="text"
                      value={formData.clientABN}
                      onChange={(e) => setFormData(prev => ({ ...prev, clientABN: e.target.value }))}
                      className="w-full px-4 py-3 bg-canvas border border-hairline rounded-ot-sm text-ink placeholder-slate-400 focus:outline-none focus:border-accent"
                      placeholder="Enter ABN"
                    />
                  </div>
                </div>
                
                {/* Project Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-ink flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Project Information
                  </h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Project Name *
                    </label>
                    <input
                      type="text"
                      value={formData.projectName}
                      onChange={(e) => setFormData(prev => ({ ...prev, projectName: e.target.value }))}
                      className="w-full px-4 py-3 bg-canvas border border-hairline rounded-ot-sm text-ink placeholder-slate-400 focus:outline-none focus:border-accent"
                      placeholder="Enter project name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Project Reference
                    </label>
                    <input
                      type="text"
                      value={formData.projectReference}
                      onChange={(e) => setFormData(prev => ({ ...prev, projectReference: e.target.value }))}
                      className="w-full px-4 py-3 bg-canvas border border-hairline rounded-ot-sm text-ink placeholder-slate-400 focus:outline-none focus:border-accent"
                      placeholder="Optional reference number"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Invoice Date
                      </label>
                      <DatePicker
                        selected={formData.invoiceDate}
                        onChange={(date) => {
                          const due = date ? ymdToLocalDate(defaultDueYmd(toYmd(date))) : null;
                          setFormData((prev) => ({
                            ...prev,
                            invoiceDate: date,
                            dueDate: due || prev.dueDate,
                          }));
                        }}
                        className="w-full px-4 py-3 bg-canvas border border-hairline rounded-ot-sm text-ink focus:outline-none focus:border-accent"
                        dateFormat="dd/MM/yyyy"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Due Date
                      </label>
                      <DatePicker
                        selected={formData.dueDate}
                        onChange={(date) => setFormData(prev => ({ ...prev, dueDate: date }))}
                        className="w-full px-4 py-3 bg-canvas border border-hairline rounded-ot-sm text-ink focus:outline-none focus:border-accent"
                        dateFormat="dd/MM/yyyy"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Line Items */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-ink">Invoice Line Items</h2>
                <button
                  onClick={addLineItem}
                  className="inline-flex items-center gap-2 bg-accent hover:bg-accent-600 text-white px-3.5 py-2 rounded-ot-sm text-[13px] font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
              </div>
              
              <div className="space-y-4">
                {formData.lineItems.map((item, index) => (
                  <div key={item.id} className="bg-canvas rounded-ot p-4 border border-hairline">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Description
                        </label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateLineItemTotal(item.id, 'description', e.target.value)}
                          className="w-full px-3 py-2 bg-canvas border border-hairline rounded-ot-sm text-ink placeholder-slate-400 focus:outline-none focus:border-accent"
                          placeholder="Item description"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Quantity
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => updateLineItemTotal(item.id, 'quantity', parseQuantity(e.target.value))}
                          className="w-full px-3 py-2 bg-canvas border border-hairline rounded-ot-sm text-ink focus:outline-none focus:border-accent"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Unit Cost ($)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitCost}
                          onChange={(e) => updateLineItemTotal(item.id, 'unitCost', dollarsFromUnknown(e.target.value))}
                          className="w-full px-3 py-2 bg-canvas border border-hairline rounded-ot-sm text-ink focus:outline-none focus:border-accent"
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-lg font-semibold text-ink">
                        Total: {formatCents(safeParseToCents(item.total))}
                      </div>
                      
                      {formData.lineItems.length > 1 && (
                        <button
                          onClick={() => removeLineItem(item.id)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* GST Option */}
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="includeGST"
                  checked={formData.includeGST}
                  onChange={(e) => setFormData(prev => ({ ...prev, includeGST: e.target.checked }))}
                  className="w-4 h-4 text-accent bg-canvas border-hairline rounded focus:ring-accent"
                />
                <label htmlFor="includeGST" className="text-sm font-medium text-slate-300">
                  Include 10% GST
                </label>
              </div>
            </div>
          )}

          {/* Step 3: Review & Generate */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-ink">Review & Generate Invoice</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Invoice Summary */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-ink">Invoice Summary</h3>
                  
                  <div className="bg-canvas rounded-ot p-4 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-300">Invoice Number:</span>
                      <span className="font-medium text-ink">{invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-300">Client:</span>
                      <span className="font-medium text-ink">{formData.clientName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-300">Project:</span>
                      <span className="font-medium text-ink">{formData.projectName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-300">Invoice Date:</span>
                      <span className="font-medium text-ink">
                        {formData.invoiceDate.toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-300">Due Date:</span>
                      <span className="font-medium text-ink">
                        {formData.dueDate.toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  
                  {/* Totals */}
                  <div className="bg-canvas rounded-ot p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-300">Subtotal:</span>
                      <span className="font-medium text-ink">${calculateSubtotal().toFixed(2)}</span>
                    </div>
                    {formData.includeGST && (
                      <div className="flex justify-between">
                        <span className="text-slate-300">GST (10%):</span>
                        <span className="font-medium text-ink">${calculateGST().toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-semibold border-t border-slate-600 pt-2">
                      <span className="text-ink">Total:</span>
                      <span className="tabular text-ink font-semibold">${calculateTotal().toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                
                {/* Additional Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-ink">Additional Information</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      rows="3"
                      className="w-full px-4 py-3 bg-canvas border border-hairline rounded-ot-sm text-ink placeholder-slate-400 focus:outline-none focus:border-accent"
                      placeholder="Additional notes or terms..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Payment Instructions
                    </label>
                    <textarea
                      value={formData.paymentInstructions}
                      onChange={(e) => setFormData(prev => ({ ...prev, paymentInstructions: e.target.value }))}
                      rows="3"
                      className="w-full px-4 py-3 bg-canvas border border-hairline rounded-ot-sm text-ink placeholder-slate-400 focus:outline-none focus:border-accent"
                      placeholder="Bank details, payment terms, etc..."
                    />
                  </div>
                </div>
              </div>
              
              {/* Bank Account Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-ink">Bank Account Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      BSB
                    </label>
                    <input
                      type="text"
                      value={formData.bsb}
                      onChange={(e) => setFormData(prev => ({ ...prev, bsb: e.target.value }))}
                      className="w-full px-4 py-3 bg-canvas border border-hairline rounded-ot-sm text-ink placeholder-slate-400 focus:outline-none focus:border-accent"
                      placeholder="000-000"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Account Name
                    </label>
                    <input
                      type="text"
                      value={formData.accountName}
                      onChange={(e) => setFormData(prev => ({ ...prev, accountName: e.target.value }))}
                      className="w-full px-4 py-3 bg-canvas border border-hairline rounded-ot-sm text-ink placeholder-slate-400 focus:outline-none focus:border-accent"
                      placeholder="Account holder name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Account Number
                    </label>
                    <input
                      type="text"
                      value={formData.accountNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
                      className="w-full px-4 py-3 bg-canvas border border-hairline rounded-ot-sm text-ink placeholder-slate-400 focus:outline-none focus:border-accent"
                      placeholder="Account number"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-hairline">
            <button
              onClick={prevStep}
              disabled={currentStep === 1}
              className="inline-flex items-center gap-2 border border-hairline hover:border-[#D6D9DD] disabled:opacity-50 text-ink px-3.5 py-2 rounded-ot-sm text-[13px] font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Previous
            </button>
            
            <div className="flex items-center space-x-3">
              {currentStep === 3 && (
                <button
                  onClick={downloadPDF}
                  className="inline-flex items-center gap-2 bg-accent hover:bg-accent-600 text-white px-3.5 py-2 rounded-ot-sm text-[13px] font-medium"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </button>
              )}
              
              {currentStep < 3 ? (
                <button
                  onClick={nextStep}
                  className="inline-flex items-center gap-2 bg-accent hover:bg-accent-600 text-white px-3.5 py-2 rounded-ot-sm text-[13px] font-medium"
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={saveInvoice}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 bg-accent hover:bg-accent-600 disabled:opacity-50 text-white px-3.5 py-2 rounded-ot-sm text-[13px] font-medium"
                >
                  <Save className="w-4 h-4" />
                  {isSubmitting ? 'Saving...' : 'Save Invoice'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* PDF Preview Modal */}
        {showPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Invoice Preview</h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={downloadPDF}
                    className="inline-flex items-center gap-2 bg-accent hover:bg-accent-600 text-white px-3.5 py-2 rounded-ot-sm text-[13px] font-medium"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="inline-flex items-center gap-2 border border-hairline hover:border-[#D6D9DD] text-ink px-3.5 py-2 rounded-ot-sm text-[13px] font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
              
              <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
                <div ref={pdfRef} className="bg-white text-black p-8 max-w-4xl mx-auto">
                  {/* Invoice Header */}
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h1 className="text-3xl font-bold text-gray-900 mb-2">INVOICE</h1>
                      <p className="text-gray-600">Invoice #: {invoiceNumber}</p>
                      <p className="text-gray-600">Date: {formData.invoiceDate.toLocaleDateString()}</p>
                      <p className="text-gray-600">Due: {formData.dueDate.toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-extrabold text-ink">RisingAMP</p>
                    </div>
                  </div>
                  
                  {/* Client & Project Info */}
                  <div className="grid grid-cols-2 gap-8 mb-8">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Bill To:</h3>
                      <p className="font-medium">{formData.clientName}</p>
                      {formData.clientEmail && <p className="text-gray-600">{formData.clientEmail}</p>}
                      {formData.clientPhone && <p className="text-gray-600">{formData.clientPhone}</p>}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Project:</h3>
                      <p className="font-medium">{formData.projectName}</p>
                      {formData.projectReference && <p className="text-gray-600">Ref: {formData.projectReference}</p>}
                    </div>
                  </div>
                  
                  {/* Line Items Table */}
                  <div className="mb-8">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Description</th>
                          <th className="border border-gray-300 px-4 py-2 text-right font-semibold">Quantity</th>
                          <th className="border border-gray-300 px-4 py-2 text-right font-semibold">Unit Cost</th>
                          <th className="border border-gray-300 px-4 py-2 text-right font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.lineItems.map((item, index) => (
                          <tr key={item.id}>
                            <td className="border border-gray-300 px-4 py-2">{item.description}</td>
                            <td className="border border-gray-300 px-4 py-2 text-right">{item.quantity}</td>
                            <td className="border border-gray-300 px-4 py-2 text-right">{formatCents(safeParseToCents(item.unitCost))}</td>
                            <td className="border border-gray-300 px-4 py-2 text-right">{formatCents(safeParseToCents(item.total))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Totals */}
                  <div className="flex justify-end mb-8">
                    <div className="w-64">
                      <div className="flex justify-between py-2">
                        <span>Subtotal:</span>
                        <span>${calculateSubtotal().toFixed(2)}</span>
                      </div>
                      {formData.includeGST && (
                        <div className="flex justify-between py-2">
                          <span>GST (10%):</span>
                          <span>${calculateGST().toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-2 border-t border-gray-300 font-semibold text-lg">
                        <span>Total:</span>
                        <span>${calculateTotal().toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Notes & Payment Instructions */}
                  {(formData.notes || formData.paymentInstructions) && (
                    <div className="grid grid-cols-2 gap-8 mb-8">
                      {formData.notes && (
                        <div>
                          <h3 className="font-semibold text-gray-900 mb-2">Notes:</h3>
                          <p className="text-gray-600">{formData.notes}</p>
                        </div>
                      )}
                      {formData.paymentInstructions && (
                        <div>
                          <h3 className="font-semibold text-gray-900 mb-2">Payment Instructions:</h3>
                          <p className="text-gray-600">{formData.paymentInstructions}</p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Footer */}
                  <div className="text-center text-gray-600 text-sm border-t border-gray-300 pt-4">
                    <p>Thank you for your business.</p>
                    <p>RisingAMP</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Invoice Preview Modal */}
        <InvoicePreview
          invoice={formData}
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          onSave={saveInvoice}
          isNewInvoice={true}
          showSaveButton={true}
        />

                          {/* Client Manager Modal */}
                  <ClientManager
                    isOpen={showClientManager}
                    onClose={() => {
                      setShowClientManager(false);
                      // Refresh clients from Firebase
                      const loadClients = async () => {
                        if (!jobId) return;
                        try {
                          const result = await getClients(jobId);
                          if (result.success) {
                            setClients(uniqueByName(result.clients || [], (row) => row.name));
                          } else {
                            setClients([]);
                          }
                        } catch (error) {
                          console.error('Error loading clients:', error);
                          setClients([]);
                        }
                      };
                      loadClients();
                    }}
                    onClientSelect={handleClientSelect}
                  />
      </div>
    </div>
  );
};

export default NewInvoicePage; 