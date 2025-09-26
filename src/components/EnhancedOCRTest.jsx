import React, { useState, useRef } from 'react';
import { Upload, X, AlertCircle, Loader2, FileText, DollarSign, Calendar, Building, Hash, CheckCircle, Info } from 'lucide-react';
import EnhancedOCRService from '../utils/EnhancedOCRService';

const EnhancedOCRTest = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [processingSteps, setProcessingSteps] = useState([]);
  const [confidenceScore, setConfidenceScore] = useState(0);
  
  const fileInputRef = useRef(null);
  const ocrService = new EnhancedOCRService();

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    await processImage(file);
  };

  const processImage = async (file) => {
    setIsProcessing(true);
    setError(null);
    setResults(null);
    setProcessingSteps([]);
    setConfidenceScore(0);

    try {
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => setPreviewImage(e.target.result);
      reader.readAsDataURL(file);

      // Update processing steps
      setProcessingSteps(['Initializing OCR service...']);

      // Extract text using enhanced OCR
      setProcessingSteps(prev => [...prev, 'Extracting text from image...']);
      const result = await ocrService.extractTextFromImage(file);
      
      setProcessingSteps(prev => [...prev, 'Parsing receipt data...']);
      setProcessingSteps(prev => [...prev, 'Categorizing expense...']);
      setProcessingSteps(prev => [...prev, 'Mapping to form fields...']);
      setProcessingSteps(prev => [...prev, 'Processing complete!']);

      setResults(result);
      setConfidenceScore(result.confidence);

    } catch (err) {
      console.error('Enhanced OCR processing failed:', err);
      setError(err.message || 'Failed to process image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetTest = () => {
    setResults(null);
    setError(null);
    setPreviewImage(null);
    setProcessingSteps([]);
    setConfidenceScore(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getConfidenceColor = (score) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getConfidenceBg = (score) => {
    if (score >= 80) return 'bg-green-500/20 border-green-500/30';
    if (score >= 60) return 'bg-yellow-500/20 border-yellow-500/30';
    return 'bg-red-500/20 border-red-500/30';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              Enhanced OCR Test
            </h1>
          </div>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Test the advanced receipt scanning and parsing system with intelligent data extraction, 
            category detection, and form field mapping.
          </p>
        </div>

        {/* Upload Section */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
          <div className="text-center space-y-6">
            <h2 className="text-2xl font-bold text-white">Upload Receipt Image</h2>
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full max-w-md mx-auto flex items-center justify-center gap-4 p-8 border-2 border-dashed border-slate-600 rounded-2xl hover:border-blue-400 hover:bg-blue-400/10 transition-all duration-300"
            >
              <Upload className="w-8 h-8 text-slate-400" />
              <span className="text-slate-300 font-medium text-lg">Choose Image File</span>
            </button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <p className="text-sm text-slate-500">
              Supported formats: JPG, PNG, GIF, BMP • Max size: 10MB
            </p>
          </div>
        </div>

        {/* Processing Status */}
        {isProcessing && (
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                <h3 className="text-xl font-semibold text-white">Processing Image...</h3>
              </div>
              
              <div className="space-y-3">
                {processingSteps.map((step, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                    <span className="text-slate-300">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-gradient-to-br from-red-900/20 via-red-800/20 to-red-900/20 border border-red-500/30 rounded-3xl p-6 md:p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-400" />
              <h3 className="text-xl font-semibold text-red-300">Processing Error</h3>
            </div>
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {/* Results Display */}
        {results && !isProcessing && (
          <div className="space-y-6">
            {/* Confidence Score */}
            <div className={`${getConfidenceBg(confidenceScore)} border rounded-3xl p-6 md:p-8 shadow-2xl`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                  <h3 className="text-xl font-semibold text-white">Processing Complete</h3>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-400">Confidence Score</p>
                  <p className={`text-2xl font-bold ${getConfidenceColor(confidenceScore)}`}>
                    {confidenceScore.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Image Preview */}
            {previewImage && (
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
                <h3 className="text-xl font-semibold text-white mb-4">Scanned Image</h3>
                <div className="flex justify-center">
                  <img 
                    src={previewImage} 
                    alt="Scanned receipt" 
                    className="max-w-full max-h-64 object-contain rounded-xl border border-white/10"
                  />
                </div>
              </div>
            )}

            {/* Extracted Data */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
                <h3 className="text-xl font-semibold text-white mb-6">Basic Information</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Building className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="text-sm text-slate-400">Vendor</p>
                      <p className="text-white font-medium">{results.extractedData.vendor || 'Not detected'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-green-400" />
                    <div>
                      <p className="text-sm text-slate-400">Date</p>
                      <p className="text-white font-medium">
                        {results.extractedData.date ? new Date(results.extractedData.date).toLocaleDateString() : 'Not detected'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-5 h-5 text-yellow-400" />
                    <div>
                      <p className="text-sm text-slate-400">Total Amount</p>
                      <p className="text-white font-medium">
                        {results.extractedData.totalAmount ? `$${results.extractedData.totalAmount.toFixed(2)}` : 'Not detected'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Hash className="w-5 h-5 text-purple-400" />
                    <div>
                      <p className="text-sm text-slate-400">Category</p>
                      <p className="text-white font-medium capitalize">{results.category}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Data Mapping */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
                <h3 className="text-xl font-semibold text-white mb-6">Form Field Mapping</h3>
                <div className="space-y-4">
                  {Object.entries(results.formData).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
                      <div className="flex-1">
                        <p className="text-sm text-slate-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                        <p className="text-white font-medium">
                          {value !== null && value !== undefined ? value.toString() : 'Not mapped'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Items Detected */}
            {results.extractedData.items && results.extractedData.items.length > 0 && (
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-white">Items Detected</h3>
                  <span className="text-sm text-slate-400 bg-slate-800 px-3 py-1 rounded-full">
                    {results.extractedData.items.length} items
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {results.extractedData.items.map((item, index) => (
                    <div key={index} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                      <p className="text-white font-medium mb-2">{item.description}</p>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-400">
                          Qty: {item.quantity} × ${item.unitPrice?.toFixed(2) || '0.00'}
                        </span>
                        <span className="text-green-400 font-medium">
                          ${item.totalPrice?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Raw Text */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
              <h3 className="text-xl font-semibold text-white mb-6">Raw Extracted Text</h3>
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 max-h-64 overflow-y-auto">
                <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono">
                  {results.rawText}
                </pre>
              </div>
            </div>

            {/* Warnings */}
            {results.warnings && results.warnings.length > 0 && (
              <div className="bg-gradient-to-br from-yellow-900/20 via-yellow-800/20 to-yellow-900/20 border border-yellow-500/30 rounded-3xl p-6 md:p-8 shadow-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Info className="w-6 h-6 text-yellow-400" />
                  <h3 className="text-xl font-semibold text-yellow-300">Processing Warnings</h3>
                </div>
                <div className="space-y-2">
                  {results.warnings.map((warning, index) => (
                    <p key={index} className="text-yellow-200">• {warning}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col md:flex-row gap-4 justify-center">
              <button
                onClick={resetTest}
                className="flex items-center justify-center gap-3 bg-slate-800 hover:bg-slate-700 text-slate-300 px-8 py-3 rounded-xl font-semibold border border-slate-700 hover:border-slate-600 transition-all duration-300"
              >
                <X className="w-5 h-5" />
                Test Another Image
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedOCRTest; 