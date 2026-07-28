import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Plus, Search, Calendar, Image as ImageIcon, X, Edit2, Trash2 } from 'lucide-react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import CreatableSelect from 'react-select/creatable';
import { useDropzone } from 'react-dropzone';
import { uploadSiteLogImage, deleteSiteLogImages } from '../../firebase/storage';

const categoryLabels = {
  labour: 'Labour',
  trade: 'Trade',
  equipment: 'Equipment',
  service: 'Service',
  purchase: 'Materials'
};

const categoryColors = {
  labour: 'bg-orange-100 text-orange-700 border-orange-200',
  trade: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  equipment: 'bg-green-500/20 text-green-400 border-green-500/30',
  service: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  purchase: 'bg-red-500/20 text-red-400 border-red-500/30'
};

export default function SiteLogPage() {
  const { 
    siteLogs, 
    clients, 
    addSiteLogToFirebase, 
    updateSiteLogInFirebase, 
    deleteSiteLogFromFirebase,
    accessCode,
    showToast 
  } = useApp();
  
  const [showForm, setShowForm] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [serviceTypeFilter, setServiceTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState(null);
  
  const [formData, setFormData] = useState({
    company: '',
    serviceType: '',
    date: new Date(),
    comments: '',
    images: []
  });
  
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailDraft, setEmailDraft] = useState(null);
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');

  // Get unique companies for filter
  const uniqueCompanies = useMemo(() => {
    const companies = siteLogs.map(log => log.company).filter(Boolean);
    return [...new Set(companies)].sort();
  }, [siteLogs]);

  // Filter and sort logs
  const filteredLogs = useMemo(() => {
    let filtered = siteLogs.filter(log => {
      // Company filter
      if (companyFilter !== 'all' && log.company !== companyFilter) {
        return false;
      }
      
      // Service type filter
      if (serviceTypeFilter !== 'all' && log.serviceType !== serviceTypeFilter) {
        return false;
      }
      
      // Date filter
      if (dateFilter) {
        const logDate = new Date(log.date);
        const filterDate = new Date(dateFilter);
        if (logDate.toDateString() !== filterDate.toDateString()) {
          return false;
        }
      }
      
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const company = (log.company || '').toLowerCase();
        const comments = (log.comments || '').toLowerCase();
        const serviceType = (categoryLabels[log.serviceType] || '').toLowerCase();
        
        if (!company.includes(searchLower) && 
            !comments.includes(searchLower) && 
            !serviceType.includes(searchLower)) {
          return false;
        }
      }
      
      return true;
    });

    // Sort by date (newest first)
    filtered.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB - dateA;
    });

    return filtered;
  }, [siteLogs, searchTerm, companyFilter, serviceTypeFilter, dateFilter]);

  // Format date helper
  const formatDate = (date) => {
    if (!date) return 'No date';
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return 'Invalid date';
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      company: '',
      serviceType: '',
      date: new Date(),
      comments: '',
      images: []
    });
    setImageFiles([]);
    setImagePreviews([]);
    setEditingLog(null);
    setUploadProgress(0);
  };

  // Open form for new entry
  const handleAddNew = () => {
    resetForm();
    setShowForm(true);
  };

  // Open form for editing
  const handleEdit = (log) => {
    setFormData({
      company: log.company || '',
      serviceType: log.serviceType || '',
      date: log.date ? new Date(log.date) : new Date(),
      comments: log.comments || '',
      images: log.images || []
    });
    setImagePreviews(log.images || []);
    setImageFiles([]);
    setEditingLog(log);
    setShowForm(true);
  };

  // Handle image drop
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    multiple: true,
    onDrop: (acceptedFiles) => {
      const newFiles = acceptedFiles.map(file => ({
        file,
        preview: URL.createObjectURL(file)
      }));
      setImageFiles(prev => [...prev, ...acceptedFiles]);
      setImagePreviews(prev => [...prev, ...newFiles.map(nf => ({ url: nf.preview, isNew: true }))]);
    }
  });

  // Remove image
  const removeImage = (index, isNew) => {
    if (isNew) {
      setImageFiles(prev => prev.filter((_, i) => i !== index));
      setImagePreviews(prev => prev.filter((_, i) => i !== index));
    } else {
      // Remove existing image
      const updatedImages = formData.images.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, images: updatedImages }));
      setImagePreviews(prev => prev.filter((_, i) => i !== index));
    }
  };

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.company || !formData.serviceType || !formData.date) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(10);

    try {
      const logId = editingLog?.id || `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const images = [...formData.images];
      
      // Upload new images
      if (imageFiles.length > 0) {
        const uploadPromises = imageFiles.map(async (file, index) => {
          const result = await uploadSiteLogImage(accessCode, logId, file);
          if (result.success) {
            setUploadProgress(10 + (index + 1) * (80 / imageFiles.length));
            return {
              url: result.url,
              path: result.path,
              fileName: result.fileName,
              uploadedAt: result.uploadedAt
            };
          }
          return null;
        });
        
        const uploadedImages = (await Promise.all(uploadPromises)).filter(Boolean);
        images.push(...uploadedImages);
      }

      const logData = {
        company: formData.company,
        serviceType: formData.serviceType,
        date: formData.date instanceof Date ? formData.date.toISOString() : formData.date,
        comments: formData.comments,
        images: images
      };

      setUploadProgress(95);

      if (editingLog) {
        await updateSiteLogInFirebase(editingLog.id, logData);
      } else {
        await addSiteLogToFirebase({ ...logData, id: logId });
      }

      setUploadProgress(100);
      resetForm();
      setShowForm(false);
    } catch (error) {
      console.error('Error saving site log:', error);
      showToast('Error saving site log', 'error');
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  // Handle delete
  const handleDelete = async (log) => {
    if (!window.confirm('Are you sure you want to delete this site log entry?')) {
      return;
    }

    try {
      // Delete images from storage
      await deleteSiteLogImages(accessCode, log.id);
      // Delete log entry
      await deleteSiteLogFromFirebase(log.id);
      if (selectedLog?.id === log.id) {
        setSelectedLog(null);
      }
    } catch (error) {
      console.error('Error deleting site log:', error);
      showToast('Error deleting site log', 'error');
    }
  };

  // Get company options for select
  const getCompanyOptions = () => {
    const savedCompanies = clients.map(client => ({
      value: client.name || client.companyName,
      label: client.name || client.companyName
    }));
    
    // Add unique companies from existing logs
    uniqueCompanies.forEach(company => {
      if (!savedCompanies.find(c => c.value === company)) {
        savedCompanies.push({ value: company, label: company });
      }
    });
    
    return savedCompanies;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-zinc-200">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 mb-1.5 tracking-tight">Site Log</h1>
          <p className="text-zinc-500 text-sm">Track and manage site activities and events</p>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-dark text-white rounded-lg transition-all duration-200 shadow-md font-medium"
        >
          <Plus className="w-4 h-4" />
          Add New Entry
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-5 border border-zinc-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            />
          </div>

          {/* Company Filter */}
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="px-4 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="all">All Companies</option>
            {uniqueCompanies.map(company => (
              <option key={company} value={company}>{company}</option>
            ))}
          </select>

          {/* Service Type Filter */}
          <select
            value={serviceTypeFilter}
            onChange={(e) => setServiceTypeFilter(e.target.value)}
            className="px-4 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="all">All Service Types</option>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          {/* Date Filter */}
          <div className="relative">
            <DatePicker
              selected={dateFilter}
              onChange={(date) => setDateFilter(date)}
              placeholderText="Filter by date"
              dateFormat="MMM dd, yyyy"
              className="w-full px-4 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter(null)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Logs List */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white rounded-xl border border-zinc-200 p-12 text-center shadow-sm">
          <Calendar className="w-16 h-16 mx-auto mb-4 text-zinc-400" />
          <p className="text-zinc-700 text-lg font-medium">No site log entries found</p>
          <p className="text-zinc-500 text-sm mt-2">Get started by adding your first site log entry</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="bg-white rounded-xl p-5 border border-zinc-200 hover:border-zinc-300 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md group"
              onClick={() => setSelectedLog(log)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-zinc-900 mb-2 truncate group-hover:text-accent transition-colors">{log.company}</h3>
                  <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium border ${categoryColors[log.serviceType] || 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>
                    {categoryLabels[log.serviceType] || log.serviceType}
                  </span>
                </div>
                <div className="flex gap-1.5 ml-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(log);
                    }}
                    className="p-1.5 text-zinc-400 hover:text-accent hover:bg-orange-50 rounded transition-all duration-200"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(log);
                    }}
                    className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded transition-all duration-200"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-zinc-600 mb-3">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span>{formatDate(log.date)}</span>
              </div>
              
              {log.comments && (
                <p className="text-sm text-zinc-700 mb-4 line-clamp-2 leading-relaxed">{log.comments}</p>
              )}
              
              {log.images && log.images.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-zinc-600 pt-3 border-t border-zinc-200">
                  <ImageIcon className="w-4 h-4 flex-shrink-0" />
                  <span className="font-medium">{log.images.length} image{log.images.length !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-zinc-200 shadow-xl">
            <div className="sticky top-0 bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
              <h2 className="text-xl font-bold text-zinc-900">
                {editingLog ? 'Edit Site Log Entry' : 'Add New Site Log Entry'}
              </h2>
              <button
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                className="text-zinc-500 hover:text-zinc-900 transition-colors p-1 hover:bg-zinc-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Company */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2.5">
                  Company <span className="text-red-400">*</span>
                </label>
                <CreatableSelect
                  value={formData.company ? { value: formData.company, label: formData.company } : null}
                  onChange={(option) => setFormData(prev => ({ ...prev, company: option?.value || '' }))}
                  options={getCompanyOptions()}
                  placeholder="Select or enter company name"
                  className="text-gray-900"
                  styles={{
                    control: (base) => ({
                      ...base,
                      backgroundColor: '#111827',
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      color: 'white'
                    }),
                    menu: (base) => ({
                      ...base,
                      backgroundColor: '#1F2937'
                    }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isFocused ? '#374151' : '#1F2937',
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
              </div>

              {/* Service Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2.5">
                  Service Type <span className="text-red-400">*</span>
                </label>
                <select
                  value={formData.serviceType}
                  onChange={(e) => setFormData(prev => ({ ...prev, serviceType: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-white border border-zinc-300 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                  required
                >
                  <option value="">Select service type</option>
                  {Object.entries(categoryLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2.5">
                  Date <span className="text-red-400">*</span>
                </label>
                <DatePicker
                  selected={formData.date}
                  onChange={(date) => setFormData(prev => ({ ...prev, date: date || new Date() }))}
                  dateFormat="MMM dd, yyyy"
                  className="w-full px-4 py-2.5 bg-white border border-zinc-300 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                  required
                />
              </div>

              {/* Comments */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2.5">
                  Comments
                </label>
                <textarea
                  value={formData.comments}
                  onChange={(e) => setFormData(prev => ({ ...prev, comments: e.target.value }))}
                  rows={4}
                  className="w-full px-4 py-2.5 bg-white border border-zinc-300 rounded-lg text-zinc-900 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-accent transition-all resize-none"
                  placeholder="Enter comments or notes..."
                />
              </div>

              {/* Images */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2.5">
                  Images
                </label>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 ${
                    isDragActive 
                      ? 'border-accent bg-orange-50 scale-[1.02]' 
                      : 'border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50'
                  }`}
                >
                  <input {...getInputProps()} />
                  <ImageIcon className={`w-10 h-10 mx-auto mb-3 ${isDragActive ? 'text-accent' : 'text-zinc-400'}`} />
                  <p className={`text-sm font-medium ${isDragActive ? 'text-accent' : 'text-zinc-500'}`}>
                    {isDragActive ? 'Drop images here' : 'Drag & drop images or click to select'}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">Max 5MB per image • Multiple images supported</p>
                </div>

                {/* Image Previews */}
                {imagePreviews.length > 0 && (
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative group aspect-square">
                        <img
                          src={preview.url || preview}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-full object-cover rounded-lg border border-white/10"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index, preview.isNew)}
                          className="absolute top-1.5 right-1.5 p-1 bg-red-500/90 hover:bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Upload Progress */}
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="w-full bg-zinc-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}

              {/* Form Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                  className="flex-1 px-5 py-2.5 bg-accent hover:bg-accent-dark text-white rounded-lg transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 font-medium shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : editingLog ? 'Update Entry' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail View Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-zinc-200 shadow-xl">
            <div className="sticky top-0 bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
              <h2 className="text-xl font-bold text-zinc-900">Site Log Details</h2>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (!selectedLog || isGeneratingEmail) return;
                    try {
                      setIsGeneratingEmail(true);
                      setEmailDraft(null);
                      const { default: SiteLogEmailService } = await import('../../utils/SiteLogEmailService');
                      const service = new SiteLogEmailService();
                      const draft = await service.generateEmailFromSiteLog(selectedLog);
                      setEmailDraft(draft);
                    } catch (error) {
                      console.error('Error generating email draft:', error);
                      showToast('Failed to generate email draft. Please try again.', 'error');
                    } finally {
                      setIsGeneratingEmail(false);
                    }
                  }}
                  className="flex items-center gap-1 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-60"
                  disabled={isGeneratingEmail}
                  title="Generate email draft for this site log"
                >
                  {isGeneratingEmail ? 'Generating…' : 'Email Draft'}
                </button>
                <button
                  onClick={() => handleEdit(selectedLog)}
                  className="p-2 text-zinc-400 hover:text-accent hover:bg-orange-50 rounded transition-all duration-200"
                  title="Edit"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    handleDelete(selectedLog);
                    setSelectedLog(null);
                  }}
                  className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-all duration-200"
                  title="Delete"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded transition-all duration-200"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">{selectedLog.company}</h3>
                <span className={`inline-block px-3 py-1 rounded text-sm border ${categoryColors[selectedLog.serviceType] || 'bg-zinc-100 text-zinc-600'}`}>
                  {categoryLabels[selectedLog.serviceType] || selectedLog.serviceType}
                </span>
              </div>

              <div className="flex items-center gap-2 text-gray-400">
                <Calendar className="w-5 h-5" />
                <span>{formatDate(selectedLog.date)}</span>
              </div>

              {selectedLog.comments && (
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Comments</h4>
                  <p className="text-gray-300 whitespace-pre-wrap">{selectedLog.comments}</p>
                </div>
              )}

              {selectedLog.images && selectedLog.images.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    Images ({selectedLog.images.length})
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {selectedLog.images.map((image, index) => (
                      <div key={index} className="relative group aspect-square">
                        <img
                          src={image.url || image}
                          alt={`Site log ${index + 1}`}
                          className="w-full h-full object-cover rounded-lg border border-white/10 cursor-pointer hover:opacity-90 hover:scale-[1.02] transition-all duration-200"
                          onClick={() => window.open(image.url || image, '_blank')}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Email Draft */}
              {emailDraft && (
                <div className="mt-4 border border-orange-200 bg-orange-50 rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-800 mb-1">
                    Email Draft (AI)
                  </h3>
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-zinc-600">
                      To
                    </label>
                    <input
                      type="email"
                      value={emailRecipient}
                      onChange={(e) => setEmailRecipient(e.target.value)}
                      placeholder="recipient@example.com"
                      className="w-full px-3 py-2 text-sm bg-white border border-zinc-300 rounded-lg text-zinc-900 placeholder-zinc-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-zinc-600">
                      Subject
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={emailDraft.subject}
                      className="w-full px-3 py-2 text-sm bg-white border border-zinc-300 rounded-lg text-zinc-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-zinc-600">
                      Body
                    </label>
                    <textarea
                      readOnly
                      rows={6}
                      value={emailDraft.body}
                      className="w-full px-3 py-2 text-sm bg-white border border-zinc-300 rounded-lg text-zinc-900 resize-y"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end pt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(emailDraft.subject);
                          showToast('Subject copied to clipboard', 'success');
                        } catch (error) {
                          console.error('Clipboard error:', error);
                          showToast('Could not copy subject', 'error');
                        }
                      }}
                      className="px-3 py-1.5 text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg border border-zinc-200"
                    >
                      Copy subject
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const fullText = `Subject: ${emailDraft.subject}\n\n${emailDraft.body}`;
                        try {
                          await navigator.clipboard.writeText(fullText);
                          showToast('Email draft copied to clipboard', 'success');
                        } catch (error) {
                          console.error('Clipboard error:', error);
                          showToast('Could not copy email draft', 'error');
                        }
                      }}
                      className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                    >
                      Copy full email
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!emailRecipient) {
                          showToast('Please enter a recipient email first', 'error');
                          return;
                        }
                        const mailtoSubject = encodeURIComponent(emailDraft.subject);
                        const mailtoBody = encodeURIComponent(emailDraft.body);
                        window.location.href = `mailto:${encodeURIComponent(
                          emailRecipient
                        )}?subject=${mailtoSubject}&body=${mailtoBody}`;
                      }}
                      className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg"
                    >
                      Open in email app
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

