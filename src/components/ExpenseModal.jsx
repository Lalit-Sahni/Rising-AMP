import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Image, Trash2, Eye, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { fetchJobFiles } from '../firebase/jobFiles';
import LinkedJobFiles from './files/LinkedJobFiles';
import CreatableSelect from 'react-select/creatable';
import DatePicker from 'react-datepicker';
import { useDropzone } from 'react-dropzone';
import ReceiptViewer from './ReceiptViewer';
import { uniqueByName } from '../firebase/partyName';
import { calendarDateToYmd, parseCalendarDate, toYmd } from '../dates';
import { dollarsFromUnknown, fromCents, labourCents, lineCents, parseQuantity } from '../money';
import { doc, collection } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getActiveOrgId } from '../firebase/tenancy';
import { useCostPlan, useTradeList } from '../hooks/useCostPlan';
import { activeTrades, canCodeExpenses, INVESTOR_TRADE_ID } from '../domain/costPlan';
import { EXPENSE_CATEGORIES, tradeIdAfterCategoryChange } from '../domain/expenseCategory';
import ExpenseTradePicker from './costPlan/ExpenseTradePicker';
import "react-datepicker/dist/react-datepicker.css";

const categoryFields = {
  labour: [
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'workerName', label: 'Worker Name', type: 'text', required: true },
    { name: 'role', label: 'Role', type: 'text', required: true },
    { name: 'hours', label: 'Hours', type: 'number', required: true, step: '0.5' },
    { name: 'rate', label: 'Rate/Hour', type: 'number', required: true, step: '0.01' },
    { name: 'notes', label: 'Notes', type: 'textarea', required: false },
  ],
  trade: [
    { name: 'tradeCategory', label: 'Trade Category', type: 'select', required: true, 
      options: ['Electrician', 'Plumber', 'Carpenter', 'Painter', 'Roofer', 'HVAC', 'Concrete', 'Tiling', 'Flooring', 'Other']
    },
    { name: 'tradeName', label: 'Trade Name', type: 'text', required: true },
    { name: 'task', label: 'Task', type: 'text', required: true },
    { name: 'amount', label: 'Amount', type: 'number', required: true, step: '0.01' },
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'notes', label: 'Notes', type: 'textarea', required: false },
  ],
  equipment: [
    { name: 'equipmentName', label: 'Equipment', type: 'text', required: true },
    { name: 'startDate', label: 'Start Date', type: 'date', required: false },
    { name: 'endDate', label: 'End Date', type: 'date', required: false },
    { name: 'totalPrice', label: 'Total Price', type: 'number', required: false, step: '0.01' },
    { name: 'notes', label: 'Notes', type: 'textarea', required: false },
  ],
  service: [
    { name: 'serviceName', label: 'Service', type: 'text', required: true },
    { name: 'provider', label: 'Provider', type: 'text', required: true },
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'cost', label: 'Cost', type: 'number', required: true, step: '0.01' },
    { name: 'notes', label: 'Notes', type: 'textarea', required: false },
  ],
  purchase: [
    { name: 'itemName', label: 'Item', type: 'text', required: true },
    { name: 'supplier', label: 'Supplier', type: 'text', required: true },
    { name: 'unitCost', label: 'Unit Cost', type: 'number', required: true, step: '0.01' },
    { name: 'quantity', label: 'Quantity', type: 'number', required: true, step: '1' },
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'notes', label: 'Notes', type: 'textarea', required: false },
  ],
  investor: [
    { name: 'itemName', label: 'What it is', type: 'text', required: true },
    { name: 'amount', label: 'Amount', type: 'number', required: true, step: '0.01' },
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'notes', label: 'Notes', type: 'textarea', required: false },
  ],
};

const categoryLabels = {
  labour: 'Labour',
  trade: 'Trade',
  equipment: 'Equipment',
  service: 'Service',
  purchase: 'Materials',
  investor: 'Investor',
  installation: 'Installation',
};

function toSafeDate(val) {
  if (!val) return null;
  const fromYmd = parseCalendarDate(val);
  if (fromYmd) return fromYmd;
  if (typeof val?.toDate === 'function') return val.toDate();
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

function seedFormForCategory(nextCategory, source) {
  const previousCategory = source.category === 'materials' ? 'purchase' : source.category;
  const initialFormData = {};
  categoryFields[nextCategory]?.forEach((field) => {
    if (field.type === 'date') {
      const converted = toSafeDate(source[field.name] || source.date || source.timestamp || source.startDate);
      initialFormData[field.name] = converted || (field.required !== false ? new Date() : null);
    } else {
      initialFormData[field.name] = source[field.name] ?? '';
    }
  });
  initialFormData.paidBy = source.paidBy ?? '';
  if (nextCategory === 'investor') {
    if (!initialFormData.itemName) {
      initialFormData.itemName = source.itemName
        || source.serviceName
        || source.workerName
        || source.tradeName
        || source.equipmentName
        || source.task
        || '';
    }
    if (!initialFormData.amount) {
      const rolled = calculateTotal(previousCategory, source);
      const stored = dollarsFromUnknown(source.total)
        || dollarsFromUnknown(source.cost)
        || dollarsFromUnknown(source.amount)
        || dollarsFromUnknown(source.totalPrice);
      initialFormData.amount = rolled > 0 ? rolled : (stored || '');
    }
  }
  return initialFormData;
}

function calculateTotal(category, data) {
  try {
    switch (category) {
      case 'labour':
        return fromCents(labourCents(data.hours, data.rate));
      case 'equipment':
        return dollarsFromUnknown(data.totalPrice);
      case 'trade':
        return dollarsFromUnknown(data.amount);
      case 'purchase':
        return fromCents(lineCents(data.quantity, data.unitCost));
      case 'service':
        return dollarsFromUnknown(data.cost);
      case 'investor':
        return dollarsFromUnknown(data.amount);
      default:
        return 0;
    }
  } catch {
    return 0;
  }
}

function creatableSelectStyles(hasError) {
  return {
    control: (base, state) => ({
      ...base,
      backgroundColor: '#FFFFFF',
      borderColor: hasError ? '#C0392B' : (state.isFocused ? '#E85D1A' : '#E7E9EC'),
      boxShadow: state.isFocused ? '0 0 0 1px #E85D1A' : 'none',
      color: '#17181C',
      minHeight: 42,
      '&:hover': {
        borderColor: state.isFocused ? '#E85D1A' : '#D6D9DD'
      }
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: '#FFFFFF',
      border: '1px solid #E7E9EC'
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? '#FCEEE4' : '#FFFFFF',
      color: '#17181C'
    }),
    singleValue: (base) => ({ ...base, color: '#17181C' }),
    input: (base) => ({ ...base, color: '#17181C' }),
    placeholder: (base) => ({ ...base, color: '#8A9099' })
  };
}

const ExpenseModal = ({ isOpen, onClose, category: categoryProp, initialData, expenseId = null, uncertainFields }) => {
  const {
    addExpenseToFirebase,
    updateExpenseInFirebase,
    showToast,
    savedLabour = [],
    savedTrades = [],
    savedCompanies = [],
    savedServiceProviders = [],
    savedPayers = [],
    saveLabourToFirebase,
    saveTradeToFirebase,
    saveCompanyToFirebase,
    saveServiceProviderToFirebase,
    savePayerToFirebase,
    jobId,
    orgId,
    expenses = [],
  } = useApp();
  const planQuery = useCostPlan(orgId, jobId);
  const tradeQuery = useTradeList(orgId);
  const showTradeCoding = canCodeExpenses(planQuery.data);
  const trades = activeTrades(tradeQuery.data || []);

  const [formData, setFormData] = useState({});
  const [category, setCategory] = useState(categoryProp);
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [receiptViewerOpen, setReceiptViewerOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [checkFields, setCheckFields] = useState({});
  const [jobFiles, setJobFiles] = useState([]);
  const [tradeId, setTradeId] = useState(null);
  const dialogRef = useRef(null);
  const initialDataRef = useRef(initialData);
  const uncertainFieldsRef = useRef(uncertainFields);
  initialDataRef.current = initialData;
  uncertainFieldsRef.current = uncertainFields;

  useEffect(() => {
    if (!isOpen || !expenseId || !jobId) {
      setJobFiles([]);
      return undefined;
    }
    let cancelled = false;
    fetchJobFiles(jobId).then((result) => {
      if (!cancelled && result.success) setJobFiles(result.files || []);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, expenseId, jobId]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const root = dialogRef.current;
    if (!root) return undefined;
    const previouslyFocused = document.activeElement;
    const focusables = () =>
      [...root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter((el) => !el.disabled && el.offsetParent !== null);
    const first = focusables()[0];
    if (first) first.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const start = items[0];
      const end = items[items.length - 1];
      if (event.shiftKey && document.activeElement === start) {
        event.preventDefault();
        end.focus();
      } else if (!event.shiftKey && document.activeElement === end) {
        event.preventDefault();
        start.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [isOpen, onClose]);

  // Initialize form data
  useEffect(() => {
    if (isOpen && categoryProp) {
      const source = initialDataRef.current || {};
      const nextCategory = categoryProp === 'materials' ? 'purchase' : categoryProp;
      setCategory(nextCategory);
      setFormData(seedFormForCategory(nextCategory, source));
      setTradeId(source.tradeId || null);
      setValidationErrors({});
      setCheckFields(uncertainFieldsRef.current || {});

      if (source.imageFile) {
        setReceiptFile(source.imageFile);
        const reader = new FileReader();
        reader.onload = (e) => setReceiptPreview(e.target.result);
        reader.readAsDataURL(source.imageFile);
      }
    }
    // Init when this expense opens, not when the parent re-renders.
    // A default uncertainFields={} (new object every render) used to wipe edits on each keystroke.
  }, [isOpen, categoryProp, expenseId]);

  // Worker management functions
  const getWorkerOptions = () => {
    return uniqueByName(savedLabour, (worker) => worker.name).map((worker) => ({
      value: worker.name,
      label: `${worker.name} (${worker.role || 'Labour'}) - $${worker.rate || 0}/hr`,
      data: worker
    }));
  };

  const getTradeOptions = () => {
    return uniqueByName(savedTrades, (trade) => trade.tradeName).map((trade) => ({
      value: trade.tradeName,
      label: `${trade.tradeName} (${trade.tradeCategory || 'Trade'})`,
      data: trade
    }));
  };

  const getCompanyOptions = () => {
    return uniqueByName(savedCompanies, (company) => company.name).map((company) => ({
      value: company.name,
      label: company.name,
      data: company
    }));
  };

  const getProviderOptions = () => {
    return uniqueByName(savedServiceProviders, (provider) => provider.name).map((provider) => ({
      value: provider.name,
      label: provider.name,
      data: provider
    }));
  };

  const handleWorkerSelect = (selectedOption) => {
    if (selectedOption) {
      setFormData(prev => ({
        ...prev,
        workerName: selectedOption.value,
        role: selectedOption?.data?.role || '',
        rate: selectedOption?.data?.rate || ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        workerName: '',
        role: '',
        rate: ''
      }));
    }
  };

  const handleTradeSelect = (selectedOption) => {
    if (selectedOption) {
      setFormData(prev => ({
        ...prev,
        tradeName: selectedOption.value,
        tradeCategory: selectedOption?.data?.tradeCategory || ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        tradeName: '',
        tradeCategory: ''
      }));
    }
  };

  const handleCompanySelect = (selectedOption) => {
    if (selectedOption) {
      setFormData(prev => ({
        ...prev,
        supplier: selectedOption.value
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        supplier: ''
      }));
    }
  };

  const getPaidByOptions = () => {
    return savedPayers.map(p => ({ value: p.name, label: p.name }));
  };

  const handlePaidBySelect = (selectedOption) => {
    setFormData(prev => ({
      ...prev,
      paidBy: selectedOption ? selectedOption.value : ''
    }));
  };

  const handleProviderSelect = (selectedOption) => {
    if (selectedOption) {
      setFormData(prev => ({
        ...prev,
        provider: selectedOption.value
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        provider: ''
      }));
    }
  };

  const saveWorkerToFirebase = async (workerData) => {
    try {
      await saveLabourToFirebase(workerData, { quiet: true });
    } catch (error) {
      console.error('Error saving labour info:', error);
    }
  };

  const validateField = (fieldName, value) => {
    const field = categoryFields[category]?.find(f => f.name === fieldName);
    if (!field) return '';

    if (field.required && (!value || value.toString().trim() === '')) {
      return `${field.label} is required`;
    }

    if (field.type === 'number' && value && Number.isNaN(Number(value))) {
      return `${field.label} must be a valid number`;
    }

    if (field.name === 'hours' && value && parseQuantity(value) <= 0) {
      return 'Hours must be greater than 0';
    }

    if (field.name === 'rate' && value && dollarsFromUnknown(value) <= 0) {
      return 'Rate must be greater than 0';
    }

    return '';
  };

  const validateForm = () => {
    const errors = {};
    categoryFields[category]?.forEach(field => {
      const error = validateField(field.name, formData[field.name]);
      if (error) {
        errors[field.name] = error;
      }
    });
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCategoryChange = (next) => {
    if (!next || next === category) return;
    const source = initialDataRef.current || {};
    setFormData((prev) => {
      const nextForm = { ...prev };
      (categoryFields[next] || []).forEach((field) => {
        if (nextForm[field.name] != null && nextForm[field.name] !== '') return;
        if (field.type === 'date') {
          const converted = toSafeDate(source[field.name] || prev.date || prev.startDate);
          nextForm[field.name] = converted || (field.required !== false ? new Date() : null);
        } else {
          nextForm[field.name] = source[field.name] ?? '';
        }
      });
      if (next === 'investor') {
        if (!nextForm.itemName) {
          nextForm.itemName = prev.itemName
            || prev.workerName
            || prev.tradeName
            || prev.equipmentName
            || prev.serviceName
            || source.itemName
            || source.serviceName
            || '';
        }
        if (!nextForm.amount) {
          const rolled = calculateTotal(category, prev);
          const stored = dollarsFromUnknown(prev.total)
            || dollarsFromUnknown(prev.cost)
            || dollarsFromUnknown(source.total)
            || dollarsFromUnknown(source.cost)
            || dollarsFromUnknown(source.amount);
          nextForm.amount = rolled > 0 ? rolled : (stored || '');
        }
      }
      return nextForm;
    });
    setTradeId((current) => tradeIdAfterCategoryChange(next, current));
    setCategory(next);
    setValidationErrors({});
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: '' }));
    }
    if (checkFields[field]) {
      setCheckFields(prev => ({ ...prev, [field]: false }));
    }
  };

  // Receipt handling functions
  const onDrop = (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setReceiptFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setReceiptPreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    multiple: false
  });

  const removeReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
  };

  const openReceiptViewer = () => {
    setReceiptViewerOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      showToast('Please fix the errors in the form', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      
      const isEditMode = !!expenseId;
      const nextId = isEditMode
        ? expenseId
        : doc(collection(db, 'organizations', getActiveOrgId(), 'projects', jobId, 'expenses')).id;

      const datedFields = {};
      (categoryFields[category] || []).forEach((field) => {
        if (field.type === 'date' && formData[field.name]) {
          datedFields[field.name] = calendarDateToYmd(formData[field.name]) || toYmd(formData[field.name]);
        }
      });

      const expenseData = {
        id: nextId,
        category: category,
        ...formData,
        ...datedFields,
        paidBy: formData.paidBy || '',
        total: calculateTotal(category, formData),
      };
      if (category === 'investor') {
        expenseData.tradeId = INVESTOR_TRADE_ID;
      } else if (showTradeCoding) {
        expenseData.tradeId = tradeId || null;
      }

      if (isEditMode && initialData?.receiptImageUrl && !receiptFile) {
        expenseData.receiptImageUrl = initialData.receiptImageUrl;
        expenseData.receiptImagePath = initialData.receiptImagePath;
        expenseData.receiptUploadedAt = initialData.receiptUploadedAt;
      }

      // Upload receipt if present
      if (receiptFile) {
        try {
          setUploadProgress(10);
          const { uploadReceiptImage } = await import('../firebase/storage');
          const uploadResult = await uploadReceiptImage(jobId, expenseData.id, receiptFile);

          if (uploadResult.success) {
            expenseData.receiptImageUrl = uploadResult.url;
            expenseData.receiptImagePath = uploadResult.path;
            expenseData.receiptUploadedAt = uploadResult.uploadedAt;
            setUploadProgress(100);
          } else {
            console.warn('Receipt upload failed:', uploadResult.error);
            showToast('Receipt upload failed, but expense will be saved', 'warning');
          }
        } catch (error) {
          console.error('Error uploading receipt:', error);
          showToast('Receipt upload failed, but expense will be saved', 'warning');
        }
      }

      const result = isEditMode
        ? await updateExpenseInFirebase(expenseId, expenseData)
        : await addExpenseToFirebase(expenseData);
      if (!result?.success) {
        return;
      }

      // Save labour information for autofill
      if (category === 'labour' && formData.workerName) {
        try {
          await saveWorkerToFirebase({
            name: formData.workerName,
            role: formData.role || '',
            rate: dollarsFromUnknown(formData.rate)
          });
        } catch (error) {
          console.error('Error saving labour info:', error);
        }
      }

      if (category === 'trade' && formData.tradeName) {
        try {
          await saveTradeToFirebase({
            tradeName: formData.tradeName,
            tradeCategory: formData.tradeCategory || '',
            task: formData.task || ''
          }, { quiet: true });
        } catch (error) {
          console.error('Error saving trade info:', error);
        }
      }

      if (category === 'purchase' && formData.supplier) {
        try {
          await saveCompanyToFirebase({
            name: formData.supplier
          }, { quiet: true });
        } catch (error) {
          console.error('Error saving company info:', error);
        }
      }

      if (category === 'service' && formData.provider) {
        try {
          await saveServiceProviderToFirebase({
            name: formData.provider,
            lastServiceName: formData.serviceName || ''
          }, { quiet: true });
        } catch (error) {
          console.error('Error saving service provider:', error);
        }
      }

      // Save payer for autofill
      if (formData.paidBy && formData.paidBy.trim()) {
        try {
          await savePayerToFirebase(formData.paidBy.trim());
        } catch (error) {
          console.error('Error saving payer info:', error);
        }
      }

      onClose();
      setFormData({});
      setValidationErrors({});
    } catch (error) {
      console.error('Error submitting expense:', error);
      showToast(expenseId ? 'Failed to update expense. Please try again.' : 'Failed to add expense. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !categoryProp) return null;

  const fields = categoryFields[category] || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="expense-modal-title"
        className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-zinc-200 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-zinc-200">
          <div>
            <h2 id="expense-modal-title" className="text-xl font-bold text-zinc-900">
              {expenseId ? 'Edit' : 'Add'} {categoryLabels[category] || category} Expense
            </h2>
            {expenseId ? (
              <label className="mt-2 block text-sm font-medium text-zinc-700">
                Category
                <select
                  value={category}
                  onChange={(event) => handleCategoryChange(event.target.value)}
                  className="mt-1 w-full max-w-xs px-3 py-2 bg-white border border-zinc-300 text-zinc-900 rounded-lg text-sm"
                >
                  {category && !EXPENSE_CATEGORIES.includes(category) ? (
                    <option value={category}>{categoryLabels[category] || category}</option>
                  ) : null}
                  {EXPENSE_CATEGORIES.map((key) => (
                    <option key={key} value={key}>{categoryLabels[key]}</option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="text-sm text-zinc-500">
                Enter expense details
              </p>
            )}
          </div>
          
          <button
            onClick={() => {
              onClose();
              setFormData({});
              setValidationErrors({});
            }}
            className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 p-4 md:p-6 overflow-y-auto">
          <div className="space-y-6">
            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {fields.map((field) => (
                <div
                  key={field.name}
                  className={`relative ${checkFields[field.name] ? 'rounded-[9px] border border-warn bg-warn-tint p-3' : ''}`}
                >
                  <label className="block text-sm font-medium text-zinc-700 mb-2">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-1">*</span>}
                    {checkFields[field.name] && (
                      <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-bold text-warn">
                        <AlertTriangle className="w-3 h-3" strokeWidth={2} />
                        Check this
                      </span>
                    )}
                  </label>
                  
                  {/* Worker Name Dropdown */}
                  {field.name === 'workerName' && category === 'labour' ? (
                    <CreatableSelect
                      value={formData[field.name] ? { value: formData[field.name], label: formData[field.name] } : null}
                      onChange={handleWorkerSelect}
                      options={getWorkerOptions()}
                      isClearable
                      placeholder="Search or add worker..."
                      className="react-select-container"
                      classNamePrefix="react-select"
                      styles={creatableSelectStyles(!!validationErrors[field.name])}
                    />
                  ) : field.name === 'tradeName' && category === 'trade' ? (
                    <CreatableSelect
                      value={formData[field.name] ? { value: formData[field.name], label: formData[field.name] } : null}
                      onChange={handleTradeSelect}
                      options={getTradeOptions()}
                      isClearable
                      placeholder="Search or add trade..."
                      className="react-select-container"
                      classNamePrefix="react-select"
                      styles={creatableSelectStyles(!!validationErrors[field.name])}
                    />
                  ) : field.name === 'supplier' && category === 'purchase' ? (
                    <CreatableSelect
                      value={formData[field.name] ? { value: formData[field.name], label: formData[field.name] } : null}
                      onChange={handleCompanySelect}
                      options={getCompanyOptions()}
                      isClearable
                      placeholder="Search or add supplier..."
                      className="react-select-container"
                      classNamePrefix="react-select"
                      styles={creatableSelectStyles(!!validationErrors[field.name])}
                    />
                  ) : field.name === 'provider' && category === 'service' ? (
                    <CreatableSelect
                      value={formData[field.name] ? { value: formData[field.name], label: formData[field.name] } : null}
                      onChange={handleProviderSelect}
                      options={getProviderOptions()}
                      isClearable
                      placeholder="Search or add service provider..."
                      className="react-select-container"
                      classNamePrefix="react-select"
                      styles={creatableSelectStyles(!!validationErrors[field.name])}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      value={formData[field.name] || ''}
                      onChange={(e) => handleInputChange(field.name, e.target.value)}
                      className={`w-full px-3 py-2 bg-white border border-zinc-300 text-zinc-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent ${
                        validationErrors[field.name] ? 'border-red-500' : 'border-zinc-300'
                      }`}
                      required={field.required}
                    >
                      <option value="">Select {field.label}</option>
                      {field.options?.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : field.type === 'date' ? (
                    <DatePicker
                      selected={formData[field.name] ? new Date(formData[field.name]) : new Date()}
                      onChange={(date) => handleInputChange(field.name, date)}
                      className={`w-full px-3 py-2 bg-white border border-zinc-300 text-zinc-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent ${
                        validationErrors[field.name] ? 'border-red-500' : 'border-zinc-300'
                      }`}
                      placeholderText="Select date"
                      dateFormat="yyyy-MM-dd"
                    />
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={formData[field.name] || ''}
                      onChange={(e) => handleInputChange(field.name, e.target.value)}
                      rows={3}
                      className={`w-full px-3 py-2 bg-white border border-zinc-300 text-zinc-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent placeholder-zinc-500 ${
                        validationErrors[field.name] ? 'border-red-500' : 'border-zinc-300'
                      }`}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                      required={field.required}
                    />
                  ) : (
                    <input
                      type={field.type}
                      value={formData[field.name] || ''}
                      onChange={(e) => handleInputChange(field.name, e.target.value)}
                      step={field.step}
                      className={`w-full px-3 py-2 bg-white border border-zinc-300 text-zinc-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent placeholder-zinc-500 ${
                        validationErrors[field.name] ? 'border-red-500' : 'border-zinc-300'
                      }`}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                      required={field.required}
                    />
                  )}
                  
                  {validationErrors[field.name] && (
                    <p className="text-red-400 text-xs mt-1">{validationErrors[field.name]}</p>
                  )}
                </div>
              ))}
            </div>

            {showTradeCoding && category !== 'investor' ? (
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">
                  Cost plan trade <span className="text-zinc-400 font-normal">(optional)</span>
                </label>
                <ExpenseTradePicker
                  expense={{ ...formData, category, tradeId }}
                  expenses={expenses}
                  trades={trades}
                  onCode={(next) => setTradeId(next)}
                />
              </div>
            ) : null}

            {/* Paid By */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Paid by <span className="text-zinc-400 font-normal">(optional)</span>
              </label>
              <CreatableSelect
                value={formData.paidBy ? { value: formData.paidBy, label: formData.paidBy } : null}
                onChange={handlePaidBySelect}
                options={getPaidByOptions()}
                isClearable
                placeholder="Who paid? Type a name or select..."
                className="react-select-container"
                classNamePrefix="react-select"
                styles={creatableSelectStyles(false)}
              />
            </div>

            {/* Receipt Upload Section */}
            <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-200">
              <h3 className="text-sm font-medium text-zinc-700 mb-3 flex items-center gap-2">
                <Image className="w-4 h-4 text-accent" />
                Receipt Attachment
              </h3>
              
              {receiptFile ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-zinc-200">
                    <div className="w-12 h-12 bg-zinc-100 rounded-lg flex items-center justify-center overflow-hidden">
                      {receiptPreview ? (
                        <img 
                          src={receiptPreview} 
                          alt="Receipt preview" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Image className="w-6 h-6 text-zinc-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{receiptFile.name}</p>
                      <p className="text-xs text-zinc-500">
                        {(receiptFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={openReceiptViewer}
                        className="p-2 hover:bg-zinc-200 rounded-lg text-zinc-600 hover:text-zinc-900 transition-colors"
                        title="View Receipt"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={removeReceipt}
                        className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 hover:text-red-300 transition-colors"
                        title="Remove Receipt"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-zinc-500">
                        <span>Uploading receipt...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-zinc-200 rounded-full h-2">
                        <div 
                          className="bg-accent h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    isDragActive 
                      ? 'border-accent bg-accent-tint' 
                      : 'border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50'
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className="w-8 h-8 text-zinc-400 mx-auto mb-3" />
                  <p className="text-sm text-zinc-600 mb-1">
                    {isDragActive ? 'Drop receipt here' : 'Upload receipt image'}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Drag & drop or click to select (JPG, PNG, GIF, WebP - Max 5MB)
                  </p>
                </div>
              )}
            </div>

            {expenseId ? (
              <LinkedJobFiles
                files={jobFiles}
                kind="expense"
                recordId={expenseId}
                jobId={jobId}
              />
            ) : null}

            {/* Total Calculation */}
            <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-200">
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium text-zinc-700">Total:</span>
                <span className="text-2xl font-bold text-green-400">
                  ${calculateTotal(category, formData).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-accent hover:bg-accent-600 disabled:bg-slate-400 text-white font-medium rounded-ot-sm transition-colors"
              >
                {isSubmitting
                  ? (expenseId ? 'Saving...' : 'Adding...')
                  : (expenseId ? 'Save changes' : 'Add Expense')}
              </button>
            </div>
          </div>
        </form>
      </div>
      
      {/* Receipt Viewer Modal */}
      <ReceiptViewer
        isOpen={receiptViewerOpen}
        onClose={() => setReceiptViewerOpen(false)}
        receiptUrl={receiptPreview}
        receiptMetadata={{
          fileName: receiptFile?.name,
          size: receiptFile?.size,
          contentType: receiptFile?.type,
          uploadedAt: new Date().toISOString()
        }}
        onDelete={removeReceipt}
      />
    </div>
  );
};

export default ExpenseModal; 