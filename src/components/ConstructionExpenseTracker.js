import React, { useState, useEffect, useRef } from 'react';
import { Upload, Download, Camera, FileText, DollarSign, PieChart, TrendingUp, Calendar, User, Wrench, FileSpreadsheet, Plus, X, Check, AlertCircle, HardHat, Info, Tag, MapPin, Clock } from 'lucide-react';
import * as XLSX from 'xlsx';
import Tesseract from 'tesseract.js';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import DatePicker from 'react-datepicker';
import { useDropzone } from 'react-dropzone';
import ReactQuill from 'react-quill';
import EnhancedOCRService from '../utils/EnhancedOCRService';
import "react-datepicker/dist/react-datepicker.css";
import "react-quill/dist/quill.snow.css";

const ConstructionExpenseTracker = () => {
  const [expenses, setExpenses] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState(() => {
    const saved = localStorage.getItem('purchaseOrders');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeTab, setActiveTab] = useState('input');
  const [activeCategory, setActiveCategory] = useState('labour');
  const [showForm, setShowForm] = useState(false);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrMethod, setOcrMethod] = useState('tesseract'); // 'tesseract' or 'google'
  const fileInputRef = useRef(null);
  const ocrService = new EnhancedOCRService();
  const [showPOForm, setShowPOForm] = useState(false);
  
  // Enhanced modal state
  const [modalStep, setModalStep] = useState(1); // 1: Details, 2: Tags, 3: Review
  const [includeGST, setIncludeGST] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [workerHistory, setWorkerHistory] = useState(() => {
    const saved = localStorage.getItem('workerHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const [siteNames, setSiteNames] = useState(() => {
    const saved = localStorage.getItem('siteNames');
    return saved ? JSON.parse(saved) : ['Main Site', 'North Building', 'South Wing', 'Parking Structure'];
  });
  const [projectPhases, setProjectPhases] = useState(() => {
    const saved = localStorage.getItem('projectPhases');
    return saved ? JSON.parse(saved) : ['Foundation', 'Framing', 'Electrical Rough-in', 'Plumbing Rough-in', 'Insulation', 'Drywall', 'Flooring', 'Finishing'];
  });
  
  const [poForm, setPOForm] = useState({
    tradeCategory: '',
    supplier: '',
    jobDescription: '',
    quotedAmount: '',
    date: '',
    poNumber: '',
    quotation: '',
    locked: false
  });

  // Load data from localStorage on mount
  useEffect(() => {
    const savedExpenses = localStorage.getItem('constructionExpenses');
    if (savedExpenses) {
      setExpenses(JSON.parse(savedExpenses));
    }
  }, []);

  // Save to localStorage whenever expenses change
  useEffect(() => {
    localStorage.setItem('constructionExpenses', JSON.stringify(expenses));
    localStorage.setItem('workerHistory', JSON.stringify(workerHistory));
    localStorage.setItem('siteNames', JSON.stringify(siteNames));
    localStorage.setItem('projectPhases', JSON.stringify(projectPhases));
  }, [expenses, workerHistory, siteNames, projectPhases]);

  // Trade categories
  const tradeCategories = [
    'Plumbing',
    'Electrical',
    'HVAC',
    'Concrete',
    'Masonry',
    'Carpentry',
    'Roofing',
    'Painting',
    'Flooring',
    'Landscaping',
    'Demolition',
    'Excavation',
    'Foundation',
    'Framing',
    'Drywall',
    'Insulation',
    'Windows & Doors',
    'Stairs & Railings',
    'Kitchen & Bath',
    'Fire Protection',
    'Security Systems',
    'Audio/Visual',
    'Elevator',
    'Paving',
    'Fencing',
    'Decking',
    'Siding',
    'Gutters',
    'Solar Installation',
    'Other'
  ];

  // Form states
  const [formData, setFormData] = useState({
    labour: { 
      date: new Date(), 
      workerName: '', 
      role: '', 
      hours: '', 
      rate: '', 
      notes: '', 
      attachments: [],
      siteName: [],
      projectPhase: []
    },
    equipment: { 
      equipmentName: '', 
      startDate: new Date(), 
      endDate: new Date(), 
      dailyCost: '', 
      notes: '', 
      attachments: [],
      siteName: [],
      projectPhase: []
    },
    trade: { 
      tradeCategory: '', 
      tradeName: '', 
      task: '', 
      amount: '', 
      date: new Date(), 
      notes: '', 
      attachments: [],
      siteName: [],
      projectPhase: []
    },
    purchase: { 
      itemName: '', 
      supplier: '', 
      unitCost: '', 
      quantity: '', 
      date: new Date(), 
      notes: '', 
      attachments: [],
      siteName: [],
      projectPhase: []
    },
    installation: { 
      item: '', 
      technician: '', 
      hours: '', 
      rate: '', 
      date: new Date(), 
      notes: '', 
      attachments: [],
      siteName: [],
      projectPhase: []
    },
    service: { 
      serviceName: '', 
      provider: '', 
      date: new Date(), 
      cost: '', 
      notes: '', 
      attachments: [],
      siteName: [],
      projectPhase: []
    }
  });

  const categoryConfig = {
    labour: {
      icon: User,
      color: 'bg-blue-500',
      fields: ['date', 'workerName', 'role', 'hours', 'rate'],
      labels: { date: 'Date', workerName: 'Worker Name', role: 'Role', hours: 'Hours', rate: 'Rate/Hour' }
    },
    equipment: {
      icon: HardHat,
      color: 'bg-green-500',
      fields: ['equipmentName', 'startDate', 'endDate', 'dailyCost'],
      labels: { equipmentName: 'Equipment', startDate: 'Start Date', endDate: 'End Date', dailyCost: 'Daily Cost' }
    },
    trade: {
      icon: Wrench,
      color: 'bg-purple-500',
      fields: ['tradeCategory', 'tradeName', 'task', 'amount', 'date'],
      labels: { tradeCategory: 'Trade Category', tradeName: 'Trade Name', task: 'Task', amount: 'Amount', date: 'Date' }
    },
    purchase: {
      icon: DollarSign,
      color: 'bg-orange-500',
      fields: ['itemName', 'supplier', 'unitCost', 'quantity', 'date'],
      labels: { itemName: 'Item', supplier: 'Supplier', unitCost: 'Unit Cost', quantity: 'Quantity', date: 'Date' }
    },
    installation: {
      icon: Wrench,
      color: 'bg-red-500',
      fields: ['item', 'technician', 'hours', 'rate', 'date'],
      labels: { item: 'Item', technician: 'Technician', hours: 'Hours', rate: 'Rate/Hour', date: 'Date' }
    },
    service: {
      icon: FileText,
      color: 'bg-indigo-500',
      fields: ['serviceName', 'provider', 'date', 'cost'],
      labels: { serviceName: 'Service', provider: 'Provider', date: 'Date', cost: 'Cost' }
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [activeCategory]: {
        ...prev[activeCategory],
        [field]: value
      }
    }));
  };

  // Worker management functions
  const getWorkerOptions = () => {
    const uniqueWorkers = [...new Set(workerHistory.map(w => w.name))];
    return uniqueWorkers.map(name => ({
      value: name,
      label: name,
      data: workerHistory.find(w => w.name === name)
    }));
  };

  const handleWorkerSelect = (selectedOption) => {
    if (selectedOption?.data) {
      const worker = selectedOption.data;
      setFormData(prev => ({
        ...prev,
        [activeCategory]: {
          ...prev[activeCategory],
          workerName: worker.name,
          role: worker.role || '',
          rate: worker.rate || ''
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [activeCategory]: {
          ...prev[activeCategory],
          workerName: selectedOption?.value || ''
        }
      }));
    }
  };

  // Live calculation with GST
  const calculateLiveTotal = () => {
    const data = formData[activeCategory];
    let baseTotal = 0;
    
    switch (activeCategory) {
      case 'labour':
      case 'installation':
        baseTotal = (parseFloat(data.hours) || 0) * (parseFloat(data.rate) || 0);
        break;
      case 'equipment':
        const days = data.startDate && data.endDate ? 
          Math.ceil((new Date(data.endDate) - new Date(data.startDate)) / (1000 * 60 * 60 * 24)) + 1 : 0;
        baseTotal = days * (parseFloat(data.dailyCost) || 0);
        break;
      case 'trade':
        baseTotal = parseFloat(data.amount) || 0;
        break;
      case 'purchase':
        baseTotal = (parseFloat(data.unitCost) || 0) * (parseFloat(data.quantity) || 0);
        break;
      case 'service':
        baseTotal = parseFloat(data.cost) || 0;
        break;
      default:
        baseTotal = 0;
    }
    
    const gstAmount = includeGST ? baseTotal * 0.1 : 0;
    return { baseTotal, gstAmount, finalTotal: baseTotal + gstAmount };
  };

  // Get highlighted dates for worker
  const getWorkerDates = (workerName) => {
    return workerHistory
      .filter(w => w.name === workerName)
      .map(w => new Date(w.date))
      .filter(date => !isNaN(date.getTime()));
  };

  // Save worker to history
  const saveWorkerToHistory = (workerData) => {
    const existingIndex = workerHistory.findIndex(w => w.name === workerData.name);
    let updatedHistory;
    
    if (existingIndex >= 0) {
      updatedHistory = [...workerHistory];
      updatedHistory[existingIndex] = { ...updatedHistory[existingIndex], ...workerData };
    } else {
      updatedHistory = [...workerHistory, workerData];
    }
    
    setWorkerHistory(updatedHistory);
    localStorage.setItem('workerHistory', JSON.stringify(updatedHistory));
  };

  // File dropzone component
  const FileDropzone = ({ onDrop, files }) => {
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
      onDrop,
      accept: {
        'image/*': ['.jpeg', '.jpg', '.png', '.gif'],
        'application/pdf': ['.pdf'],
        'text/*': ['.txt'],
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
        'application/vnd.ms-excel': ['.xls']
      },
      maxFiles: 5
    });

    return (
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDragActive 
            ? 'border-orange-500 bg-orange-50' 
            : 'border-gray-300 hover:border-orange-400 hover:bg-gray-50'
          }`}
      >
        <input {...getInputProps()} />
        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        {isDragActive ? (
          <p className="text-orange-600">Drop files here...</p>
        ) : (
          <div>
            <p className="text-gray-600">Drag & drop files here, or click to select</p>
            <p className="text-sm text-gray-400 mt-1">Images, PDFs, Excel files supported</p>
          </div>
        )}
        
        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            {files.map((file, idx) => (
              <div key={idx} className="flex items-center justify-between bg-gray-100 rounded p-2">
                <span className="text-sm text-gray-700 flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  {file.name}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const newFiles = files.filter((_, i) => i !== idx);
                    handleInputChange('attachments', newFiles);
                  }}
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const calculateTotal = (category, data) => {
    switch (category) {
      case 'labour':
        return (parseFloat(data.hours) || 0) * (parseFloat(data.rate) || 0);
      case 'equipment':
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        return days * (parseFloat(data.dailyCost) || 0);
      case 'trade':
        return parseFloat(data.amount) || 0;
      case 'purchase':
        return (parseFloat(data.unitCost) || 0) * (parseFloat(data.quantity) || 0);
      case 'installation':
        return (parseFloat(data.hours) || 0) * (parseFloat(data.rate) || 0);
      case 'service':
        return parseFloat(data.cost) || 0;
      default:
        return 0;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = formData[activeCategory];
    const { finalTotal } = calculateLiveTotal();
    
    const newExpense = {
      id: Date.now(),
      category: activeCategory,
      date: data.date instanceof Date ? data.date.toISOString().split('T')[0] : data.date,
      total: finalTotal,
      includeGST: includeGST,
      ...data,
      attachments: data.attachments?.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type,
        url: file instanceof File ? URL.createObjectURL(file) : file
      })) || [],
      timestamp: new Date().toISOString()
    };

    setExpenses(prev => [...prev, newExpense]);
    
    // Save worker to history if it's labour or installation category
    if ((activeCategory === 'labour' || activeCategory === 'installation') && data.workerName) {
      saveWorkerToHistory({
        name: data.workerName,
        role: data.role,
        rate: data.rate,
        date: newExpense.date
      });
    }
    
    // Save new site names and project phases
    if (data.siteName && data.siteName.length > 0) {
      const newSites = data.siteName.filter(site => !siteNames.includes(site.value));
      if (newSites.length > 0) {
        const updatedSites = [...siteNames, ...newSites.map(s => s.value)];
        setSiteNames(updatedSites);
        localStorage.setItem('siteNames', JSON.stringify(updatedSites));
      }
    }
    
    if (data.projectPhase && data.projectPhase.length > 0) {
      const newPhases = data.projectPhase.filter(phase => !projectPhases.includes(phase.value));
      if (newPhases.length > 0) {
        const updatedPhases = [...projectPhases, ...newPhases.map(p => p.value)];
        setProjectPhases(updatedPhases);
        localStorage.setItem('projectPhases', JSON.stringify(updatedPhases));
      }
    }
    
    // Reset form
    setFormData(prev => ({
      ...prev,
      [activeCategory]: Object.keys(prev[activeCategory]).reduce((acc, key) => {
        if (key.includes('date') || key.includes('Date')) {
          acc[key] = new Date();
        } else if (key === 'attachments' || key === 'siteName' || key === 'projectPhase') {
          acc[key] = [];
        } else {
          acc[key] = '';
        }
        return acc;
      }, {})
    }));
    
    setModalStep(1);
    setIncludeGST(false);
    setShowForm(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      setOcrProcessing(true);
      setOcrProgress(0);

      try {
        let extractedData = {};
        let methodUsed = 'Tesseract.js';

        // Try Google Cloud Vision API first, fallback to Tesseract
        try {
          console.log('Attempting Google Cloud Vision API...');
          const result = await ocrService.extractTextFromImage(file);
          extractedData = result.formData;
          methodUsed = 'Google Cloud Vision API';
        } catch (googleError) {
          console.log('Google Cloud Vision failed, falling back to Tesseract...', googleError);
          
          // Fallback to Tesseract.js
          const result = await Tesseract.recognize(
            file,
            'eng',
            {
              logger: (m) => {
                if (m.status === 'recognizing text') {
                  setOcrProgress(Math.round(m.progress * 100));
                }
              }
            }
          );

          // Extract text and try to parse it
          const text = result.data.text;
          extractedData = parseOCRText(text);
        }

        // Pre-fill form with extracted data
        setFormData(prev => ({
          ...prev,
          [activeCategory]: {
            ...prev[activeCategory],
            ...extractedData,
            attachments: [...prev[activeCategory].attachments, file.name]
          }
        }));

        setOcrProcessing(false);
        setShowForm(true);
        
        // Show success message with method used
        alert(`OCR processing completed using ${methodUsed}! Form has been auto-filled with extracted data.`);
      } catch (error) {
        console.error('OCR Error:', error);
        setOcrProcessing(false);
        alert('Failed to process image. Please enter data manually.');
      }
    } else {
      // Just attach the file
      setFormData(prev => ({
        ...prev,
        [activeCategory]: {
          ...prev[activeCategory],
          attachments: [...prev[activeCategory].attachments, file.name]
        }
      }));
    }
  };

  const parseOCRText = (text) => {
    const extracted = {};
    
    // Try to extract date
    const dateMatch = text.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/);
    if (dateMatch) {
      extracted.date = dateMatch[0];
    }
    
    // Try to extract amounts
    const amountMatch = text.match(/\$?\d+\.?\d*/g);
    if (amountMatch && amountMatch.length > 0) {
      // Use the largest number as the main amount
      const amounts = amountMatch.map(a => parseFloat(a.replace('$', '')));
      const maxAmount = Math.max(...amounts);
      
      if (activeCategory === 'labour' || activeCategory === 'installation') {
        extracted.rate = maxAmount.toString();
      } else if (activeCategory === 'equipment') {
        extracted.dailyCost = maxAmount.toString();
      } else if (activeCategory === 'purchase') {
        extracted.unitCost = maxAmount.toString();
      } else {
        extracted.amount = maxAmount.toString();
        extracted.cost = maxAmount.toString();
      }
    }
    
    // Extract potential supplier/provider names (capitalize words)
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length > 0) {
      const potentialName = lines[0].trim();
      if (activeCategory === 'purchase') {
        extracted.supplier = potentialName;
      } else if (activeCategory === 'service') {
        extracted.provider = potentialName;
      }
    }
    
    return extracted;
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    
    // Group expenses by category
    const categories = ['labour', 'equipment', 'trade', 'purchase', 'installation', 'service'];
    
    categories.forEach(cat => {
      const categoryExpenses = expenses.filter(e => e.category === cat);
      if (categoryExpenses.length > 0) {
        const ws = XLSX.utils.json_to_sheet(categoryExpenses.map(e => {
          const { id, category, timestamp, attachments, ...rest } = e;
          return rest;
        }));
        XLSX.utils.book_append_sheet(wb, ws, cat.charAt(0).toUpperCase() + cat.slice(1));
      }
    });
    
    // Add summary sheet
    const summary = categories.map(cat => ({
      Category: cat.charAt(0).toUpperCase() + cat.slice(1),
      'Total Expenses': expenses.filter(e => e.category === cat).length,
      'Total Amount': expenses.filter(e => e.category === cat).reduce((sum, e) => sum + (e.total || 0), 0).toFixed(2)
    }));

    // Add trade category summary if there are trade expenses
    const tradeExpenses = expenses.filter(e => e.category === 'trade');
    if (tradeExpenses.length > 0) {
      const tradeSummary = tradeCategories.map(cat => {
        const categoryExpenses = tradeExpenses.filter(e => e.tradeCategory === cat);
        return {
          'Trade Category': cat,
          'Total Expenses': categoryExpenses.length,
          'Total Amount': categoryExpenses.reduce((sum, e) => sum + (e.total || 0), 0).toFixed(2)
        };
      }).filter(c => c['Total Expenses'] > 0);
      
      const tradeSummaryWs = XLSX.utils.json_to_sheet(tradeSummary);
      XLSX.utils.book_append_sheet(wb, tradeSummaryWs, 'Trade Summary');
    }
    
    const summaryWs = XLSX.utils.json_to_sheet(summary);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
    
    // Save file
    XLSX.writeFile(wb, `construction_expenses_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getDashboardData = () => {
    const totalExpense = expenses.reduce((sum, e) => sum + (e.total || 0), 0);
    
    const byCategory = Object.keys(categoryConfig).map(cat => ({
      name: cat.charAt(0).toUpperCase() + cat.slice(1),
      value: expenses.filter(e => e.category === cat).reduce((sum, e) => sum + (e.total || 0), 0)
    })).filter(c => c.value > 0);
    
    // Trade category breakdown
    const tradeExpenses = expenses.filter(e => e.category === 'trade');
    const byTradeCategory = tradeCategories.map(cat => {
      const categoryExpenses = tradeExpenses.filter(e => e.tradeCategory === cat);
      return {
        name: cat,
        value: categoryExpenses.reduce((sum, e) => sum + (e.total || 0), 0),
        count: categoryExpenses.length
      };
    }).filter(c => c.value > 0);
    
    const topExpenses = [...expenses]
      .sort((a, b) => (b.total || 0) - (a.total || 0))
      .slice(0, 5);
    
    return { totalExpense, byCategory, byTradeCategory, topExpenses };
  };

  const { totalExpense, byCategory, byTradeCategory, topExpenses } = getDashboardData();

  // Helper to get next PO number
  const getNextPONumber = () => {
    if (!purchaseOrders.length) return 'PO-0001';
    const nums = purchaseOrders.map(po => parseInt((po.poNumber || '').replace(/[^0-9]/g, '')) || 0);
    const max = Math.max(...nums, 0) + 1;
    return `PO-${String(max).padStart(4, '0')}`;
  };

  const sigPadRef = useRef();

  // Update PO number default when opening form
  useEffect(() => {
    if (activeTab === 'purchaseOrders' && !poForm.locked) {
      setPOForm(f => ({ ...f, poNumber: f.poNumber || getNextPONumber() }));
    }
    // eslint-disable-next-line
  }, [activeTab, purchaseOrders]);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('purchaseOrders', JSON.stringify(purchaseOrders));
  }, [purchaseOrders]);

  const handlePOInput = (field, value) => {
    setPOForm(prev => ({ ...prev, [field]: value }));
  };

  const handlePOClear = () => {
    setPOForm({
      tradeCategory: '',
      supplier: '',
      jobDescription: '',
      quotedAmount: '',
      date: '',
      poNumber: getNextPONumber(),
      quotation: '',
      locked: false
    });
  };

  const handlePOQuoteUpload = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setPOForm(prev => ({ ...prev, quotation: ev.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handlePOSign = () => {
    setPOForm(prev => ({ ...prev, locked: true }));
    setPurchaseOrders(prev => [...prev, { ...poForm, locked: true }]);
  };

  const handlePOPDF = async () => {
    const node = document.getElementById('po-preview');
    if (!node) return;
    const canvas = await html2canvas(node, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, width, height);
    pdf.save(`${poForm.poNumber || 'PO'}.pdf`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* TEST BLUE DOT - REMOVE AFTER TESTING */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-blue-500 rounded-full z-50 shadow-lg"></div>
      
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <HardHat className="w-8 h-8 text-orange-500" />
              Construction Expense Tracker
            </h1>
            <button
              onClick={exportToExcel}
              className="relative flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 shadow-lg hover:shadow-xl hover:shadow-green-500/25 group overflow-hidden"
              style={{
                boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.2), 0 2px 4px -1px rgba(22, 163, 74, 0.1)'
              }}
            >
              {/* 3D Bubble Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              
              <FileSpreadsheet className="w-5 h-5 relative z-10 transform group-hover:scale-110 transition-transform duration-300" />
              <span className="font-medium relative z-10">Export Excel</span>
              
              {/* Subtle glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('input')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'input'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Add Expense
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'dashboard'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'history'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              History
            </button>
            <button
              onClick={() => setActiveTab('purchaseOrders')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'purchaseOrders'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Purchase Orders
            </button>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Input Tab */}
        {activeTab === 'input' && (
          <div className="space-y-6">
            {/* Category Selection */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Select Expense Category</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(categoryConfig).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setActiveCategory(key);
                        setShowForm(true);
                      }}
                      className={`relative p-6 rounded-2xl border-2 transition-all duration-300 ease-out transform hover:scale-105 hover:-translate-y-1 ${
                        activeCategory === key
                          ? 'border-orange-500 bg-gradient-to-br from-orange-50 to-orange-100 shadow-lg shadow-orange-200/50'
                          : 'border-gray-200 bg-gradient-to-br from-white to-gray-50 hover:border-gray-300 hover:shadow-xl hover:shadow-gray-300/30'
                      } group overflow-hidden`}
                      style={{
                        boxShadow: activeCategory === key 
                          ? '0 10px 25px -5px rgba(251, 146, 60, 0.3), 0 4px 6px -2px rgba(251, 146, 60, 0.1)' 
                          : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                      }}
                    >
                      {/* 3D Bubble Effect */}
                      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
                      
                      {/* Icon with enhanced styling */}
                      <div className="relative z-10">
                        <div className={`w-12 h-12 mx-auto mb-3 ${config.color} text-white p-2.5 rounded-xl shadow-lg transform group-hover:scale-110 transition-transform duration-300`}>
                          <Icon className="w-full h-full" />
                        </div>
                        <span className="text-sm font-semibold text-gray-800 group-hover:text-gray-900 transition-colors duration-300">
                          {key.charAt(0).toUpperCase() + key.slice(1)}
                        </span>
                      </div>
                      
                      {/* Subtle glow effect */}
                      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br from-transparent to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="relative flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 shadow-lg hover:shadow-xl hover:shadow-blue-500/25 group overflow-hidden"
                  style={{
                    boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2), 0 2px 4px -1px rgba(37, 99, 235, 0.1)'
                  }}
                >
                  {/* 3D Bubble Effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  
                  <Camera className="w-5 h-5 relative z-10 transform group-hover:scale-110 transition-transform duration-300" />
                  <span className="font-medium relative z-10">Scan Invoice</span>
                  
                  {/* Subtle glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* OCR Processing */}
            {ocrProcessing && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                  <span className="text-lg font-medium">Processing image...</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${ocrProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Enhanced Input Form Modal */}
            {showForm && !ocrProcessing && (
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl shadow-2xl border border-gray-700 overflow-hidden">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-700">
                  <h2 className="text-xl font-bold text-white flex items-center gap-3">
                    <div className="p-2 bg-orange-500 rounded-lg">
                      {React.createElement(categoryConfig[activeCategory].icon, { className: "w-5 h-5 text-white" })}
                    </div>
                    Add {activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)} Expense
                  </h2>
                  <button
                    onClick={() => {
                      setShowForm(false);
                      setModalStep(1);
                      setIncludeGST(false);
                    }}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Progress Indicator */}
                <div className="px-6 py-4 border-b border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-300">Step {modalStep} of 3</span>
                    <span className="text-sm text-gray-400">
                      {modalStep === 1 ? 'Details' : modalStep === 2 ? 'Tags' : 'Review'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-orange-500 to-orange-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(modalStep / 3) * 100}%` }}
                    />
                  </div>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6">
                  {/* Step 1: Details */}
                  {modalStep === 1 && (
                    <div className="space-y-6">
                      {categoryConfig[activeCategory].fields.map(field => (
                        <div key={field} className="relative">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                            {categoryConfig[activeCategory].labels[field]}
                            <div className="group relative">
                              <Info className="w-4 h-4 text-gray-500 hover:text-orange-400 cursor-help" />
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-gray-600">
                                {field === 'workerName' ? 'Search existing workers or add new' :
                                 field === 'hours' ? 'Number of hours worked' :
                                 field === 'rate' ? 'Hourly rate in dollars' :
                                 field === 'date' ? 'Date of expense' :
                                 `Enter ${categoryConfig[activeCategory].labels[field].toLowerCase()}`}
                              </div>
                            </div>
                          </label>
                          
                          {/* Worker Name Dropdown */}
                          {field === 'workerName' && (activeCategory === 'labour' || activeCategory === 'installation') ? (
                            <CreatableSelect
                              value={formData[activeCategory][field] ? { value: formData[activeCategory][field], label: formData[activeCategory][field] } : null}
                              onChange={handleWorkerSelect}
                              options={getWorkerOptions()}
                              isClearable
                              placeholder="Search or add worker..."
                              className="react-select-container"
                              classNamePrefix="react-select"
                              styles={{
                                control: (base) => ({
                                  ...base,
                                  backgroundColor: '#374151',
                                  borderColor: '#6B7280',
                                  color: 'white',
                                  '&:hover': { borderColor: '#F97316' }
                                }),
                                menu: (base) => ({
                                  ...base,
                                  backgroundColor: '#374151',
                                  border: '1px solid #6B7280'
                                }),
                                option: (base, state) => ({
                                  ...base,
                                  backgroundColor: state.isFocused ? '#F97316' : '#374151',
                                  color: 'white'
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
                          ) : field.includes('date') || field.includes('Date') ? (
                            /* Smart Date Picker */
                            <DatePicker
                              selected={formData[activeCategory][field] instanceof Date ? formData[activeCategory][field] : new Date()}
                              onChange={(date) => handleInputChange(field, date)}
                              highlightDates={field === 'date' && formData[activeCategory].workerName ? 
                                getWorkerDates(formData[activeCategory].workerName) : []}
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                              placeholderText="Select date"
                              dateFormat="yyyy-MM-dd"
                            />
                          ) : field === 'tradeCategory' ? (
                            <select
                              value={formData[activeCategory][field]}
                              onChange={(e) => handleInputChange(field, e.target.value)}
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                              required
                            >
                              <option value="">Select Trade Category</option>
                              {tradeCategories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={field.includes('Cost') || field.includes('rate') || field.includes('amount') || field.includes('hours') || field.includes('quantity') ? 'number' : 'text'}
                              value={formData[activeCategory][field] instanceof Date ? 
                                formData[activeCategory][field].toISOString().split('T')[0] : 
                                formData[activeCategory][field]}
                              onChange={(e) => handleInputChange(field, e.target.value)}
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-gray-400"
                              required
                              step={field.includes('Cost') || field.includes('rate') || field.includes('amount') ? '0.01' : '1'}
                              placeholder={`Enter ${categoryConfig[activeCategory].labels[field].toLowerCase()}`}
                            />
                          )}
                        </div>
                      ))}

                      {/* Live Calculation Display */}
                      {(activeCategory === 'labour' || activeCategory === 'installation') && (
                        <div className="bg-gray-800 rounded-lg p-4 border border-gray-600">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                              <DollarSign className="w-4 h-4" />
                              Live Calculation
                            </h4>
                            <label className="flex items-center gap-2 text-sm text-gray-300">
                              <input
                                type="checkbox"
                                checked={includeGST}
                                onChange={(e) => setIncludeGST(e.target.checked)}
                                className="w-4 h-4 text-orange-600 bg-gray-700 border-gray-600 rounded focus:ring-orange-500"
                              />
                              Include GST (10%)
                            </label>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between text-gray-400">
                              <span>Base Total:</span>
                              <span>${calculateLiveTotal().baseTotal.toFixed(2)}</span>
                            </div>
                            {includeGST && (
                              <div className="flex justify-between text-gray-400">
                                <span>GST (10%):</span>
                                <span>${calculateLiveTotal().gstAmount.toFixed(2)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-white font-medium border-t border-gray-600 pt-2">
                              <span>Final Total:</span>
                              <span className="text-orange-400">${calculateLiveTotal().finalTotal.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 2: Tags */}
                  {modalStep === 2 && (
                    <div className="space-y-6">
                      <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                          <MapPin className="w-4 h-4" />
                          Site Name
                          <div className="group relative">
                            <Info className="w-4 h-4 text-gray-500 hover:text-orange-400 cursor-help" />
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-gray-600">
                              Select or create site location tags
                            </div>
                          </div>
                        </label>
                        <CreatableSelect
                          isMulti
                          value={formData[activeCategory].siteName}
                          onChange={(selected) => handleInputChange('siteName', selected || [])}
                          options={siteNames.map(site => ({ value: site, label: site }))}
                          placeholder="Select or add sites..."
                          className="react-select-container"
                          classNamePrefix="react-select"
                          styles={{
                            control: (base) => ({
                              ...base,
                              backgroundColor: '#374151',
                              borderColor: '#6B7280',
                              color: 'white',
                              '&:hover': { borderColor: '#F97316' }
                            }),
                            menu: (base) => ({
                              ...base,
                              backgroundColor: '#374151',
                              border: '1px solid #6B7280'
                            }),
                            option: (base, state) => ({
                              ...base,
                              backgroundColor: state.isFocused ? '#F97316' : '#374151',
                              color: 'white'
                            }),
                            multiValue: (base) => ({
                              ...base,
                              backgroundColor: '#F97316'
                            }),
                            multiValueLabel: (base) => ({
                              ...base,
                              color: 'white'
                            }),
                            input: (base) => ({
                              ...base,
                              color: 'white'
                            })
                          }}
                        />
                      </div>

                      <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                          <Tag className="w-4 h-4" />
                          Project Phase
                          <div className="group relative">
                            <Info className="w-4 h-4 text-gray-500 hover:text-orange-400 cursor-help" />
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-gray-600">
                              Tag the construction phase
                            </div>
                          </div>
                        </label>
                        <CreatableSelect
                          isMulti
                          value={formData[activeCategory].projectPhase}
                          onChange={(selected) => handleInputChange('projectPhase', selected || [])}
                          options={projectPhases.map(phase => ({ value: phase, label: phase }))}
                          placeholder="Select or add phases..."
                          className="react-select-container"
                          classNamePrefix="react-select"
                          styles={{
                            control: (base) => ({
                              ...base,
                              backgroundColor: '#374151',
                              borderColor: '#6B7280',
                              color: 'white',
                              '&:hover': { borderColor: '#F97316' }
                            }),
                            menu: (base) => ({
                              ...base,
                              backgroundColor: '#374151',
                              border: '1px solid #6B7280'
                            }),
                            option: (base, state) => ({
                              ...base,
                              backgroundColor: state.isFocused ? '#F97316' : '#374151',
                              color: 'white'
                            }),
                            multiValue: (base) => ({
                              ...base,
                              backgroundColor: '#F97316'
                            }),
                            multiValueLabel: (base) => ({
                              ...base,
                              color: 'white'
                            }),
                            input: (base) => ({
                              ...base,
                              color: 'white'
                            })
                          }}
                        />
                      </div>

                      {/* File Attachment */}
                      <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                          <Upload className="w-4 h-4" />
                          Attachments
                          <div className="group relative">
                            <Info className="w-4 h-4 text-gray-500 hover:text-orange-400 cursor-help" />
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-gray-600">
                              Upload invoices, receipts, or photos
                            </div>
                          </div>
                        </label>
                        <FileDropzone
                          onDrop={(acceptedFiles) => {
                            handleInputChange('attachments', [...formData[activeCategory].attachments, ...acceptedFiles]);
                          }}
                          files={formData[activeCategory].attachments}
                        />
                      </div>
                    </div>
                  )}

                  {/* Step 3: Review & Notes */}
                  {modalStep === 3 && (
                    <div className="space-y-6">
                      <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                          <FileText className="w-4 h-4" />
                          Notes
                          <div className="group relative">
                            <Info className="w-4 h-4 text-gray-500 hover:text-orange-400 cursor-help" />
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-gray-600">
                              Add detailed notes about this expense
                            </div>
                          </div>
                        </label>
                        <ReactQuill
                          value={formData[activeCategory].notes}
                          onChange={(value) => handleInputChange('notes', value)}
                          placeholder="Add detailed notes about this expense..."
                          theme="snow"
                          style={{
                            backgroundColor: '#374151',
                            color: 'white',
                            borderRadius: '0.5rem'
                          }}
                          modules={{
                            toolbar: [
                              ['bold', 'italic', 'underline'],
                              ['link'],
                              [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                              ['clean']
                            ]
                          }}
                        />
                      </div>

                      {/* Expense Summary */}
                      <div className="bg-gray-800 rounded-lg p-4 border border-gray-600">
                        <h4 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                          <Check className="w-5 h-5 text-green-400" />
                          Expense Summary
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="space-y-2">
                            <div><span className="text-gray-400">Category:</span> <span className="text-white capitalize">{activeCategory}</span></div>
                            {formData[activeCategory].workerName && (
                              <div><span className="text-gray-400">Worker:</span> <span className="text-white">{formData[activeCategory].workerName}</span></div>
                            )}
                            {formData[activeCategory].date && (
                              <div><span className="text-gray-400">Date:</span> <span className="text-white">
                                {formData[activeCategory].date instanceof Date ? 
                                  formData[activeCategory].date.toLocaleDateString() : 
                                  formData[activeCategory].date}
                              </span></div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <div><span className="text-gray-400">Total:</span> <span className="text-orange-400 font-medium">${calculateLiveTotal().finalTotal.toFixed(2)}</span></div>
                            {formData[activeCategory].siteName?.length > 0 && (
                              <div><span className="text-gray-400">Sites:</span> 
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {formData[activeCategory].siteName.map((site, idx) => (
                                    <span key={idx} className="px-2 py-1 bg-orange-500 text-white text-xs rounded-full">{site.label}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {formData[activeCategory].attachments?.length > 0 && (
                              <div><span className="text-gray-400">Files:</span> <span className="text-white">{formData[activeCategory].attachments.length} attached</span></div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Navigation Buttons */}
                  <div className="flex gap-4 pt-6 border-t border-gray-700">
                    {modalStep > 1 && (
                      <button
                        type="button"
                        onClick={() => setModalStep(modalStep - 1)}
                        className="px-6 py-3 bg-gray-700 text-white rounded-xl hover:bg-gray-600 transition-colors flex items-center gap-2"
                      >
                        <span>Previous</span>
                      </button>
                    )}
                    {modalStep < 3 ? (
                      <button
                        type="button"
                        onClick={() => setModalStep(modalStep + 1)}
                        className="flex-1 bg-gradient-to-r from-orange-600 to-orange-700 text-white py-3 rounded-xl hover:from-orange-700 hover:to-orange-800 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 shadow-lg hover:shadow-xl hover:shadow-orange-500/25 flex items-center justify-center gap-2"
                      >
                        <span>Next</span>
                        <Clock className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white py-3 rounded-xl hover:from-green-700 hover:to-green-800 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 shadow-lg hover:shadow-xl hover:shadow-green-500/25 flex items-center justify-center gap-2"
                      >
                        <Check className="w-5 h-5" />
                        <span>Save Expense</span>
                      </button>
                    )}
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Expenses</p>
                    <p className="text-2xl font-bold text-gray-900">${totalExpense.toFixed(2)}</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-green-500" />
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Entries</p>
                    <p className="text-2xl font-bold text-gray-900">{expenses.length}</p>
                  </div>
                  <FileText className="w-8 h-8 text-blue-500" />
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Avg. Expense</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ${expenses.length > 0 ? (totalExpense / expenses.length).toFixed(2) : '0.00'}
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-purple-500" />
                </div>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Expenses by Category</h3>
              {byCategory.length > 0 ? (
                <div className="space-y-4">
                  {byCategory.map((cat, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">{cat.name}</span>
                        <span className="text-sm text-gray-600">${cat.value.toFixed(2)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${categoryConfig[cat.name.toLowerCase()]?.color || 'bg-gray-500'}`}
                          style={{ width: `${(cat.value / totalExpense) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No expenses recorded yet</p>
              )}
            </div>

            {/* Trade Category Breakdown */}
            {byTradeCategory.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Trade Expenses by Category</h3>
                <div className="space-y-4">
                  {byTradeCategory.map((cat, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{cat.name}</span>
                          <span className="text-xs text-gray-500">({cat.count} entries)</span>
                        </div>
                        <span className="text-sm text-gray-600">${cat.value.toFixed(2)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-purple-500"
                          style={{ width: `${(cat.value / byTradeCategory.reduce((sum, c) => sum + c.value, 0)) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Expenses */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Top 5 Expenses</h3>
              {topExpenses.length > 0 ? (
                <div className="space-y-3">
                  {topExpenses.map((expense, idx) => (
                    <div key={expense.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-gray-500">#{idx + 1}</span>
                        <div>
                          <p className="font-medium">
                            {expense[Object.keys(expense).find(k => k.includes('Name') || k === 'item' || k === 'tradeName')] || 'Unnamed'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {expense.category.charAt(0).toUpperCase() + expense.category.slice(1)}
                          </p>
                        </div>
                      </div>
                      <span className="font-semibold text-lg">${expense.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No expenses recorded yet</p>
              )}
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">Expense History</h2>
            </div>
            <div className="overflow-x-auto">
              {expenses.length > 0 ? (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {expenses.map((expense) => (
                      <tr key={expense.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {expense.date || new Date(expense.timestamp).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${categoryConfig[expense.category]?.color} text-white`}>
                            {expense.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div>
                            <div className="font-medium">
                              {expense[Object.keys(expense).find(k => k.includes('Name') || k === 'item' || k === 'tradeName')] || 'N/A'}
                            </div>
                            {expense.category === 'trade' && expense.tradeCategory && (
                              <div className="text-xs text-gray-500">
                                {expense.tradeCategory}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          ${expense.total.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => {
                              setExpenses(prev => prev.filter(e => e.id !== expense.id));
                            }}
                            className="text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-gray-500 text-center py-12">No expenses recorded yet</p>
              )}
            </div>
          </div>
        )}

        {/* Purchase Orders Tab */}
        {activeTab === 'purchaseOrders' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6 max-w-3xl mx-auto">
              <h2 className="text-lg font-semibold mb-4">Create Purchase Order</h2>
              <form className="space-y-4" onSubmit={e => { e.preventDefault(); }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Trade Category</label>
                    <select
                      value={poForm.tradeCategory}
                      onChange={e => handlePOInput('tradeCategory', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      required
                    >
                      <option value="">Select Trade</option>
                      {tradeCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Supplier/Trade Name</label>
                    <input
                      type="text"
                      value={poForm.supplier}
                      onChange={e => handlePOInput('supplier', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Job Description</label>
                    <input
                      type="text"
                      value={poForm.jobDescription}
                      onChange={e => handlePOInput('jobDescription', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Quoted Amount</label>
                    <input
                      type="number"
                      value={poForm.quotedAmount}
                      onChange={e => handlePOInput('quotedAmount', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      required
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Date of Agreement</label>
                    <input
                      type="date"
                      value={poForm.date}
                      onChange={e => handlePOInput('date', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">PO Number</label>
                    <input
                      type="text"
                      value={poForm.poNumber}
                      onChange={e => handlePOInput('poNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Quotation (Upload or Paste)</label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handlePOQuoteUpload}
                    className="mb-2"
                    disabled={poForm.locked}
                  />
                  <textarea
                    value={poForm.quotation && !poForm.quotation.startsWith('data:') ? poForm.quotation : ''}
                    onChange={e => handlePOInput('quotation', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows="3"
                    placeholder="Paste quotation text here..."
                    disabled={poForm.locked}
                  />
                  {poForm.quotation && poForm.quotation.startsWith('data:') && (
                    <div className="mt-2">
                      <span className="text-xs text-gray-500">Uploaded Quotation Preview:</span>
                      <img src={poForm.quotation} alt="Quotation" className="max-h-40 mt-1 border rounded" />
                    </div>
                  )}
                </div>
                <div className="flex gap-4 pt-4">
                  {!poForm.locked ? (
                    <>
                      <button
                        type="button"
                        onClick={handlePOSign}
                        className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition-colors"
                        disabled={poForm.locked}
                      >
                        Sign & Lock
                      </button>
                      <button
                        type="button"
                        onClick={handlePOClear}
                        className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                        disabled={poForm.locked}
                      >
                        Clear
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handlePOPDF}
                        className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Download PDF
                      </button>
                      <button
                        type="button"
                        onClick={handlePOClear}
                        className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        New PO
                      </button>
                    </>
                  )}
                </div>
              </form>
            </div>
            {/* PO Preview */}
            <div className="bg-white rounded-lg shadow p-6 max-w-3xl mx-auto mt-6 print:border print:shadow-none" id="po-preview">
              <h2 className="text-xl font-bold mb-2 text-center">Purchase Order</h2>
              <div className="grid grid-cols-2 gap-4 mb-2">
                <div>
                  <div className="text-xs text-gray-500">PO Number</div>
                  <div className="font-semibold">{poForm.poNumber}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Date</div>
                  <div className="font-semibold">{poForm.date}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Trade</div>
                  <div className="font-semibold">{poForm.tradeCategory}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Supplier/Trade Name</div>
                  <div className="font-semibold">{poForm.supplier}</div>
                </div>
              </div>
              <div className="mb-2">
                <div className="text-xs text-gray-500">Job Description</div>
                <div className="font-semibold">{poForm.jobDescription}</div>
              </div>
              <div className="mb-2">
                <div className="text-xs text-gray-500">Quoted Amount</div>
                <div className="font-semibold">${poForm.quotedAmount}</div>
              </div>
              {poForm.quotation && (
                <div className="mb-2">
                  <div className="text-xs text-gray-500">Quotation</div>
                  {poForm.quotation.startsWith('data:') ? (
                    <img src={poForm.quotation} alt="Quotation" className="max-h-40 border rounded" />
                  ) : (
                    <div className="font-mono text-xs whitespace-pre-wrap bg-gray-50 p-2 rounded border">{poForm.quotation}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConstructionExpenseTracker; 