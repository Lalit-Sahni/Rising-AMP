import React, { useState, useEffect } from 'react';
import { X, Database, Upload, Image, Trash2, Eye } from 'lucide-react';
import { useApp } from '../context/AppContext';
import SavedDataSelector from './SavedDataSelector';
import CreatableSelect from 'react-select/creatable';
import DatePicker from 'react-datepicker';
import { useDropzone } from 'react-dropzone';
import ReceiptViewer from './ReceiptViewer';
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
};

const categoryLabels = {
  labour: 'Labour',
  trade: 'Trade',
  equipment: 'Equipment',
  service: 'Service',
  purchase: 'Materials'
};

function calculateTotal(category, data) {
  switch (category) {
    case 'labour':
      return (parseFloat(data.hours) || 0) * (parseFloat(data.rate) || 0);
    case 'equipment': {
      return parseFloat(data.totalPrice) || 0;
    }
    case 'trade':
      return parseFloat(data.amount) || 0;
    case 'purchase':
      return (parseFloat(data.unitCost) || 0) * (parseFloat(data.quantity) || 0);
    case 'service':
      return parseFloat(data.cost) || 0;
    default:
      return 0;
  }
}

const ExpenseModal = ({ isOpen, onClose, category, initialData = {} }) => {
  const { 
    addExpenseToFirebase, 
    showToast, 
    savedLabour = [],
    savedTrades = [],
    savedCompanies = [],
    savedProjects = [],
    saveLabourToFirebase,
    saveTradeToFirebase,
    saveCompanyToFirebase,
    saveProjectToFirebase,
    accessCode
  } = useApp();

  const [formData, setFormData] = useState({});
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [receiptViewerOpen, setReceiptViewerOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Initialize form data
  useEffect(() => {
    if (isOpen && category) {
      const initialFormData = {};
      categoryFields[category]?.forEach(field => {
        if (field.name === 'date') {
          initialFormData[field.name] = initialData[field.name] || new Date();
        } else {
          initialFormData[field.name] = initialData[field.name] || '';
        }
      });
      setFormData(initialFormData);
      setValidationErrors({});
      
      // Handle receipt from OCR scanner
      if (initialData.imageFile) {
        setReceiptFile(initialData.imageFile);
        const reader = new FileReader();
        reader.onload = (e) => setReceiptPreview(e.target.result);
        reader.readAsDataURL(initialData.imageFile);
      }
    }
  }, [isOpen, category, initialData]);

  // Worker management functions
  const getWorkerOptions = () => {
    return savedLabour.map(worker => ({
      value: worker.name,
      label: `${worker.name} (${worker.role}) - $${worker.rate}/hr`,
      data: worker
    }));
  };

  const getTradeOptions = () => {
    return savedTrades.map(trade => ({
      value: trade.tradeName,
      label: `${trade.tradeName} (${trade.tradeCategory})`,
      data: trade
    }));
  };

  const getCompanyOptions = () => {
    return savedCompanies.map(company => ({
      value: company.name,
      label: company.name,
      data: company
    }));
  };

  const getProjectOptions = () => {
    return savedProjects.map(project => ({
      value: project.name,
      label: project.name,
      data: project
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

  const handleProjectSelect = (selectedOption) => {
    if (selectedOption) {
      setFormData(prev => ({
        ...prev,
        projectName: selectedOption.value
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        projectName: ''
      }));
    }
  };

  const saveWorkerToFirebase = async (workerData) => {
    try {
      await saveLabourToFirebase(workerData);
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

    if (field.type === 'number' && value && isNaN(parseFloat(value))) {
      return `${field.label} must be a valid number`;
    }

    if (field.name === 'hours' && value && parseFloat(value) <= 0) {
      return 'Hours must be greater than 0';
    }

    if (field.name === 'rate' && value && parseFloat(value) <= 0) {
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

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: '' }));
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
      
      const expenseData = {
        id: `expense_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        category: category,
        ...formData,
        total: calculateTotal(category, formData),
        timestamp: new Date().toISOString()
      };

      // Upload receipt if present
      if (receiptFile) {
        try {
          setUploadProgress(10);
          const { uploadReceiptImage } = await import('../firebase/storage');
          const uploadResult = await uploadReceiptImage(accessCode, expenseData.id, receiptFile);
          
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

      await addExpenseToFirebase(expenseData);

      // Save labour information for autofill
      if (category === 'labour' && formData.workerName) {
        try {
          await saveWorkerToFirebase({
            name: formData.workerName,
            role: formData.role || '',
            rate: parseFloat(formData.rate) || 0
          });
        } catch (error) {
          console.error('Error saving labour info:', error);
        }
      }

      // Save trade information for autofill
      if (category === 'trade' && formData.tradeName) {
        try {
          await saveTradeToFirebase({
            tradeName: formData.tradeName,
            tradeCategory: formData.tradeCategory || '',
            task: formData.task || ''
          });
        } catch (error) {
          console.error('Error saving trade info:', error);
        }
      }

      // Save company information for autofill
      if (formData.supplier) {
        try {
          await saveCompanyToFirebase({
            name: formData.supplier
          });
        } catch (error) {
          console.error('Error saving company info:', error);
        }
      }

      // Save project information for autofill
      if (formData.projectName) {
        try {
          await saveProjectToFirebase({
            name: formData.projectName
          });
        } catch (error) {
          console.error('Error saving project info:', error);
        }
      }

      onClose();
      setFormData({});
      setValidationErrors({});
      showToast('Expense added successfully!', 'success');
    } catch (error) {
      console.error('Error submitting expense:', error);
      showToast('Failed to add expense. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !category) return null;

  const fields = categoryFields[category] || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-zinc-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-200">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">
              Add {categoryLabels[category]} Expense
            </h2>
            <p className="text-sm text-zinc-500">
              Enter expense details
            </p>
          </div>
          
          <button
            onClick={() => {
              onClose();
              setFormData({});
              setValidationErrors({});
            }}
            className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 p-6 overflow-y-auto">
          <div className="space-y-6">
            {/* Saved Data Access */}
            <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-200">
              <h3 className="text-sm font-medium text-zinc-700 mb-3 flex items-center gap-2">
                <Database className="w-4 h-4 text-accent" />
                Quick Access to Saved Data
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {category === 'labour' && (
                  <SavedDataSelector
                    type="labour"
                    onSelect={(item) => {
                      setFormData(prev => ({
                        ...prev,
                        workerName: item.name,
                        role: item.role || '',
                        rate: item.rate || ''
                      }));
                    }}
                    placeholder="Select saved worker..."
                    showDelete={true}
                  />
                )}
                {category === 'trade' && (
                  <SavedDataSelector
                    type="trade"
                    onSelect={(item) => {
                      setFormData(prev => ({
                        ...prev,
                        tradeName: item.tradeName,
                        tradeCategory: item.tradeCategory || ''
                      }));
                    }}
                    placeholder="Select saved trade..."
                    showDelete={true}
                  />
                )}
                {category === 'purchase' && (
                  <SavedDataSelector
                    type="company"
                    onSelect={(item) => {
                      setFormData(prev => ({
                        ...prev,
                        supplier: item.name
                      }));
                    }}
                    placeholder="Select saved company..."
                    showDelete={true}
                  />
                )}
                <SavedDataSelector
                  type="project"
                  onSelect={(item) => {
                    setFormData(prev => ({
                      ...prev,
                      projectName: item.name
                    }));
                  }}
                  placeholder="Select saved project..."
                  showDelete={true}
                />
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {fields.map((field) => (
                <div key={field.name} className="relative">
                  <label className="block text-sm font-medium text-zinc-700 mb-2">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-1">*</span>}
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
                      styles={{
                        control: (base) => ({
                          ...base,
                          backgroundColor: '#334155',
                          borderColor: validationErrors[field.name] ? '#EF4444' : '#475569',
                          color: 'white',
                          '&:hover': {
                            borderColor: '#64748B'
                          }
                        }),
                        menu: (base) => ({
                          ...base,
                          backgroundColor: '#334155',
                          border: '1px solid #475569'
                        }),
                        option: (base, state) => ({
                          ...base,
                          backgroundColor: state.isFocused ? '#475569' : 'transparent',
                          color: 'white',
                          '&:hover': {
                            backgroundColor: '#475569'
                          }
                        }),
                        singleValue: (base) => ({
                          ...base,
                          color: 'white'
                        }),
                        input: (base) => ({
                          ...base,
                          color: 'white'
                        })
                      }}
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
                      styles={{
                        control: (base) => ({
                          ...base,
                          backgroundColor: '#334155',
                          borderColor: validationErrors[field.name] ? '#EF4444' : '#475569',
                          color: 'white',
                          '&:hover': {
                            borderColor: '#64748B'
                          }
                        }),
                        menu: (base) => ({
                          ...base,
                          backgroundColor: '#334155',
                          border: '1px solid #475569'
                        }),
                        option: (base, state) => ({
                          ...base,
                          backgroundColor: state.isFocused ? '#475569' : 'transparent',
                          color: 'white',
                          '&:hover': {
                            backgroundColor: '#475569'
                          }
                        }),
                        singleValue: (base) => ({
                          ...base,
                          color: 'white'
                        }),
                        input: (base) => ({
                          ...base,
                          color: 'white'
                        })
                      }}
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
                      styles={{
                        control: (base) => ({
                          ...base,
                          backgroundColor: '#334155',
                          borderColor: validationErrors[field.name] ? '#EF4444' : '#475569',
                          color: 'white',
                          '&:hover': {
                            borderColor: '#64748B'
                          }
                        }),
                        menu: (base) => ({
                          ...base,
                          backgroundColor: '#334155',
                          border: '1px solid #475569'
                        }),
                        option: (base, state) => ({
                          ...base,
                          backgroundColor: state.isFocused ? '#475569' : 'transparent',
                          color: 'white',
                          '&:hover': {
                            backgroundColor: '#475569'
                          }
                        }),
                        singleValue: (base) => ({
                          ...base,
                          color: 'white'
                        }),
                        input: (base) => ({
                          ...base,
                          color: 'white'
                        })
                      }}
                    />
                  ) : field.name === 'projectName' ? (
                    <CreatableSelect
                      value={formData[field.name] ? { value: formData[field.name], label: formData[field.name] } : null}
                      onChange={handleProjectSelect}
                      options={getProjectOptions()}
                      isClearable
                      placeholder="Search or add project..."
                      className="react-select-container"
                      classNamePrefix="react-select"
                      styles={{
                        control: (base) => ({
                          ...base,
                          backgroundColor: '#334155',
                          borderColor: validationErrors[field.name] ? '#EF4444' : '#475569',
                          color: 'white',
                          '&:hover': {
                            borderColor: '#64748B'
                          }
                        }),
                        menu: (base) => ({
                          ...base,
                          backgroundColor: '#334155',
                          border: '1px solid #475569'
                        }),
                        option: (base, state) => ({
                          ...base,
                          backgroundColor: state.isFocused ? '#475569' : 'transparent',
                          color: 'white',
                          '&:hover': {
                            backgroundColor: '#475569'
                          }
                        }),
                        singleValue: (base) => ({
                          ...base,
                          color: 'white'
                        }),
                        input: (base) => ({
                          ...base,
                          color: 'white'
                        })
                      }}
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
                      ? 'border-accent bg-orange-50' 
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
                className="px-6 py-2 bg-accent hover:bg-accent-dark disabled:bg-zinc-400 text-white font-medium rounded-lg transition-colors"
              >
                {isSubmitting ? 'Adding...' : 'Add Expense'}
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