import React, { useState } from 'react';
import { Upload, Check, AlertCircle, Loader2 } from 'lucide-react';
import OCRService from '../utils/OCRService';

const OCRTest = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [method, setMethod] = useState('');

  const ocrService = new OCRService();

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      console.log('Processing image with Google Cloud Vision API...');
      const extractedData = await ocrService.extractTextFromImage(file);
      
      setResult(extractedData);
      setMethod('Google Cloud Vision API');
      
      console.log('OCR Result:', extractedData);
    } catch (err) {
      console.error('OCR failed:', err);
      setError(err.message || 'Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            OCR Test Page
          </h1>
          <p className="text-slate-400 text-lg">
            Test the OCR functionality with Google Cloud Vision API
          </p>
        </div>

        {/* Upload Section */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Upload Image</h2>
              <p className="text-slate-400">Select an image file to test OCR extraction</p>
            </div>

            <div className="flex justify-center">
              <label className="cursor-pointer">
                <div className="flex items-center justify-center gap-3 p-8 border-2 border-dashed border-slate-600 rounded-xl hover:border-blue-400 hover:bg-blue-400/10 transition-colors">
                  <Upload className="w-8 h-8 text-slate-400" />
                  <span className="text-slate-300 font-medium">Choose Image File</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </div>

            {/* Processing State */}
            {isProcessing && (
              <div className="text-center space-y-4">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
                <p className="text-slate-300">Processing image with OCR...</p>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-red-300">{error}</p>
              </div>
            )}

            {/* Results Display */}
            {result && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-green-300 font-medium">
                      OCR completed using {method}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Raw Text */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-white">Raw Extracted Text</h3>
                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 max-h-64 overflow-y-auto">
                      <pre className="text-sm text-slate-300 whitespace-pre-wrap">
                        {result.rawText}
                      </pre>
                    </div>
                  </div>

                  {/* Processed Data */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-white">Processed Data</h3>
                    <div className="space-y-3">
                      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Category:</span>
                            <span className="text-white font-medium capitalize">{result.category}</span>
                          </div>
                          {result.amount && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Amount:</span>
                              <span className="text-green-400 font-medium">${result.amount.toFixed(2)}</span>
                            </div>
                          )}
                          {result.date && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Date:</span>
                              <span className="text-white font-medium">
                                {new Date(result.date).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          {result.supplier && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Supplier:</span>
                              <span className="text-white font-medium">{result.supplier}</span>
                            </div>
                          )}
                          {result.invoiceNumber && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Invoice #:</span>
                              <span className="text-white font-medium">{result.invoiceNumber}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-slate-400">Confidence:</span>
                            <span className="text-blue-400 font-medium">{result.confidence.toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Form Data Preview */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-white">Form Data Mapping</h3>
                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                    <pre className="text-sm text-slate-300 whitespace-pre-wrap">
                      {JSON.stringify(result.formData, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OCRTest; 