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
import {
  useJobLabour,
  useJobPayers,
  useJobServiceProviders,
  useJobSuppliers,
  useJobTrades,
} from '../hooks/useJobDirectories';
import { activeTrades, canCodeExpenses, INVESTOR_TRADE_ID } from '../domain/costPlan';
import { EXPENSE_CATEGORIES, tradeIdAfterCategoryChange } from '../domain/expenseCategory';
import ExpenseTradePicker from './costPlan/ExpenseTradePicker';
import { expenseHasReceipt, formatMoney } from '../utils/jobMetrics';
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

function nextExpenseCategory(value) {
  return value === 'materials' ? 'purchase' : value;
}

function storedReceiptPreviewUrl(source) {
  const url = typeof source?.receiptImageUrl === 'string' ? source.receiptImageUrl.trim() : '';
  return url || null;
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
  const labourQuery = useJobLabour(orgId, jobId, isOpen);
  const tradesQuery = useJobTrades(orgId, jobId, isOpen);
  const suppliersQuery = useJobSuppliers(orgId, jobId, isOpen);
  const providersQuery = useJobServiceProviders(orgId, jobId, isOpen);
  const payersQuery = useJobPayers(orgId, jobId, isOpen);
  const savedLabour = labourQuery.data || [];
  const savedTrades = tradesQuery.data || [];
  const savedCompanies = suppliersQuery.data || [];
  const savedServiceProviders = providersQuery.data || [];
  const savedPayers = payersQuery.data || [];
  const showTradeCoding = canCodeExpenses(planQuery.data);
  const trades = activeTrades(tradeQuery.data || []);

  const [formData, setFormData] = useState(() => {
    if (!categoryProp) return {};
    return seedFormForCategory(nextExpenseCategory(categoryProp), initialData || {});
  });
  const [category, setCategory] = useState(() => nextExpenseCategory(categoryProp));
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(() => storedReceiptPreviewUrl(initialData));
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
    if (!isOpen || !categoryProp) return undefined;
    const source = initialDataRef.current || {};
    const nextCategory = nextExpenseCategory(categoryProp);
    setCategory(nextCategory);
    setFormData(seedFormForCategory(nextCategory, source));
    setTradeId(source.tradeId || null);
    setValidationErrors({});
    setCheckFields(uncertainFieldsRef.current || {});
    setReceiptFile(null);
    setReceiptPreview(storedReceiptPreviewUrl(source));
    setReceiptViewerOpen(false);

    let cancelled = false;
    if (source.imageFile) {
      setReceiptFile(source.imageFile);
      const reader = new FileReader();
      reader.onload = (e) => {
        if (!cancelled) setReceiptPreview(e.target.result);
      };
      reader.readAsDataURL(source.imageFile);
    } else if (expenseHasReceipt(source)) {
      import('../firebase/resolveReceiptUrl').then(({ resolveExpenseReceiptUrl }) => (
        resolveExpenseReceiptUrl(source, { jobId, expenseId: expenseId || source.id }).then((url) => {
          if (!cancelled && url) setReceiptPreview(url);
        })
      ));
    }
    return () => {
      cancelled = true;
    };
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

  const openReceiptViewer = async () => {
    let url = receiptPreview;
    if (!url) {
      const { resolveExpenseReceiptUrl } = await import('../firebase/resolveReceiptUrl');
      url = await resolveExpenseReceiptUrl(initialDataRef.current || {}, {
        jobId,
        expenseId,
      });
      if (url) setReceiptPreview(url);
    }
    if (!url) {
      showToast('Could not open that receipt', 'error');
      return;
    }
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

      if (isEditMode && expenseHasReceipt(initialData) && !receiptFile) {
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
  const receiptOnFile = Boolean(
    receiptFile
    || receiptPreview
    || (expenseId && expenseHasReceipt(initialData))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-steel-900/50">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="expense-modal-title"
        className="bg-surface w-full max-w-4xl h-[100dvh] max-h-[100dvh] md:h-auto md:max-h-[90vh] overflow-hidden border border-hairline rounded-none md:rounded-ot shadow-[0_24px_64px_rgba(23,24,28,0.28)] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 md:px-6 py-3.5 md:py-5 border-b border-hairline" style={{ paddingTop: 'max(14px, var(--safe-top))' }}>
          <div className="min-w-0">
            <h2 id="expense-modal-title" className="text-[17px] md:text-[19px] font-extrabold tracking-tight text-ink truncate">
              {expenseId ? 'Edit' : 'Add'} {(categoryLabels[category] || category || '').toLowerCase()} expense
            </h2>
            {expenseId ? (
              <label className="mt-1.5 block text-[12.5px] font-medium text-slate-600">
                Category
                <select
                  value={category}
                  onChange={(event) => handleCategoryChange(event.target.value)}
                  className="mt-1 w-full max-w-xs px-3 py-2 bg-surface border border-hairline text-ink rounded-ot-sm text-sm focus:outline-none focus:border-accent"
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
              <p className="text-[12.5px] text-slate-400">
                Fields marked * are required.
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {receiptOnFile ? (
              <button
                type="button"
                onClick={openReceiptViewer}
                className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-ot-sm border border-hairline text-sm font-semibold text-ink hover:bg-canvas"
              >
                <Eye className="w-4 h-4" />
                View receipt
              </button>
            ) : null}
            <button
              onClick={() => {
                onClose();
                setFormData({});
                setValidationErrors({});
              }}
              className="w-9 h-9 grid place-items-center hover:bg-canvas rounded-ot-sm transition-colors border border-hairline"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 px-4 md:px-6 pt-4 md:pt-6 overflow-y-auto">
          <div className="space-y-6">
            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {fields.map((field) => (
                <div
                  key={field.name}
                  className={`relative ${checkFields[field.name] ? 'rounded-[9px] border border-warn bg-warn-tint p-3' : ''}`}
                >
                  <label className="block text-[13px] font-semibold text-ink mb-1.5">
                    {field.label}
                    {field.required && <span className="text-neg ml-1">*</span>}
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
                      className={`w-full px-3 py-2.5 bg-surface border text-ink rounded-ot-sm focus:outline-none focus:border-accent ${
                        validationErrors[field.name] ? 'border-neg' : 'border-hairline'
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
                      selected={formData[field.name] ? new Date(formData[field.name]) : null}
                      onChange={(date) => handleInputChange(field.name, date)}
                      className={`w-full px-3 py-2.5 bg-surface border text-ink rounded-ot-sm focus:outline-none focus:border-accent ${
                        validationErrors[field.name] ? 'border-neg' : 'border-hairline'
                      }`}
                      placeholderText="Pick a date"
                      dateFormat="dd/MM/yyyy"
                    />
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={formData[field.name] || ''}
                      onChange={(e) => handleInputChange(field.name, e.target.value)}
                      rows={3}
                      className={`w-full px-3 py-2.5 bg-surface border text-ink rounded-ot-sm focus:outline-none focus:border-accent placeholder:text-slate-400 ${
                        validationErrors[field.name] ? 'border-neg' : 'border-hairline'
                      }`}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                      required={field.required}
                    />
                  ) : (
                    <input
                      type={field.type}
                      inputMode={field.type === 'number' ? 'decimal' : undefined}
                      value={formData[field.name] || ''}
                      onChange={(e) => handleInputChange(field.name, e.target.value)}
                      step={field.step}
                      className={`w-full px-3 py-2.5 bg-surface border text-ink rounded-ot-sm focus:outline-none focus:border-accent placeholder:text-slate-400 ${
                        validationErrors[field.name] ? 'border-neg' : 'border-hairline'
                      }`}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                      required={field.required}
                    />
                  )}
                  
                  {validationErrors[field.name] && (
                    <p className="text-neg text-xs mt-1">{validationErrors[field.name]}</p>
                  )}
                </div>
              ))}
            </div>

            {showTradeCoding && category !== 'investor' ? (
              <div>
                <label className="block text-[13px] font-semibold text-ink mb-1.5">
                  Cost plan trade <span className="text-slate-400 font-normal">(optional)</span>
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
              <label className="block text-[13px] font-semibold text-ink mb-1.5">
                Paid by <span className="text-slate-400 font-normal">(optional)</span>
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
            <div className="bg-canvas rounded-ot p-4 border border-hairline">
              <h3 className="text-[13px] font-semibold text-ink mb-3 flex items-center gap-2">
                <Image className="w-4 h-4 text-accent" />
                Receipt
              </h3>
              
              {receiptOnFile ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-surface rounded-ot-sm border border-hairline">
                    <button
                      type="button"
                      onClick={openReceiptViewer}
                      className="w-12 h-12 bg-canvas rounded-ot-sm flex items-center justify-center overflow-hidden shrink-0 border border-hairline"
                      title="View receipt"
                    >
                      {receiptPreview ? (
                        <img
                          src={receiptPreview}
                          alt="Receipt preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Image className="w-6 h-6 text-slate-400" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">
                        {receiptFile?.name || 'Receipt on file'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {receiptFile
                          ? `${(receiptFile.size / 1024 / 1024).toFixed(2)} MB`
                          : 'Tap to view'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={openReceiptViewer}
                        className="p-2 hover:bg-canvas rounded-ot-sm text-slate-600 hover:text-ink transition-colors border border-hairline"
                        title="View receipt"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {receiptFile ? (
                        <button
                          type="button"
                          onClick={removeReceipt}
                          className="p-2 hover:bg-canvas rounded-ot-sm text-neg transition-colors border border-hairline"
                          title="Remove receipt"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {!receiptFile ? (
                    <div
                      {...getRootProps()}
                      className={`border-2 border-dashed rounded-ot-sm p-4 text-center cursor-pointer transition-colors ${
                        isDragActive
                          ? 'border-accent bg-accent-tint'
                          : 'border-hairline hover:border-[#D6D9DD] hover:bg-surface'
                      }`}
                    >
                      <input {...getInputProps()} />
                      <p className="text-xs text-slate-600">
                        {isDragActive ? 'Drop to replace this receipt' : 'Replace with another photo'}
                      </p>
                    </div>
                  ) : null}
                  
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Uploading receipt…</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-hairline rounded-full h-2">
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
                  className={`border-2 border-dashed rounded-ot-sm p-6 text-center cursor-pointer transition-colors ${
                    isDragActive
                      ? 'border-accent bg-accent-tint'
                      : 'border-hairline hover:border-[#D6D9DD] hover:bg-surface'
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-ink mb-1">
                    {isDragActive ? 'Drop the photo here' : 'Add a photo of the receipt'}
                  </p>
                  <p className="text-xs text-slate-400">
                    Tap to choose, or drag one in. JPG, PNG, GIF or WebP, up to 5 MB.
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

          </div>

          <div
            className="sticky bottom-0 -mx-4 md:-mx-6 mt-6 border-t border-hairline bg-surface px-4 md:px-6 pt-3 flex items-center justify-between gap-3"
            style={{ paddingBottom: 'calc(12px + var(--safe-bottom))' }}
          >
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-slate-400">Total</div>
              <div className="tabular text-[20px] font-extrabold text-ink leading-tight">
                {formatMoney(calculateTotal(category, formData), { cents: true })}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  setFormData({});
                  setValidationErrors({});
                }}
                className="px-3.5 py-2.5 rounded-ot-sm border border-hairline text-[13px] font-semibold text-slate-600 hover:text-ink hover:bg-canvas"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2.5 bg-accent hover:bg-accent-600 disabled:opacity-50 text-white text-[13px] font-bold rounded-ot-sm transition-colors"
              >
                {isSubmitting
                  ? (expenseId ? 'Saving…' : 'Adding…')
                  : (expenseId ? 'Save changes' : 'Add expense')}
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
          fileName: receiptFile?.name || 'Receipt on file',
          size: receiptFile?.size,
          contentType: receiptFile?.type,
          uploadedAt: initialData?.receiptUploadedAt || null
        }}
        onDelete={receiptFile ? removeReceipt : undefined}
      />
    </div>
  );
};

export default ExpenseModal; 