import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, AlertCircle, Loader2, Plus } from 'lucide-react';
import EnhancedOCRService from '../utils/EnhancedOCRService';

const OCRScanner = ({ onScanComplete, onClose, isOpen }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [extractedData, setExtractedData] = useState(null);
  const [error, setError] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [useCamera, setUseCamera] = useState(false);
  const [editableData, setEditableData] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const ocrService = new EnhancedOCRService();

  // Cleanup camera when component unmounts or modal closes
  useEffect(() => {
    const videoElement = videoRef.current;

    return () => {
      if (videoElement && videoElement.srcObject) {
        const stream = videoElement.srcObject;
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
        videoElement.srcObject = null;
      }
    };
  }, []);

  // Cleanup camera when modal closes
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
  }, [isOpen]);

  // Handle file selection
  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    await processImage(file);
  };

  // Handle camera capture
  const handleCameraCapture = () => {
    if (!videoRef.current || !canvasRef.current) {
      setError('Camera not ready. Please try again.');
      return;
    }

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      // Check if video is playing and has valid dimensions
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        setError('Camera stream not ready. Please wait a moment and try again.');
        return;
      }

      const context = canvas.getContext('2d');
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw the current video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert canvas to blob
      canvas.toBlob(async (blob) => {
        if (blob) {
          const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
          await processImage(file);
        } else {
          setError('Failed to capture image. Please try again.');
        }
      }, 'image/jpeg', 0.9); // 90% quality
      
    } catch (err) {
      console.error('Camera capture error:', err);
      setError('Failed to capture image. Please try again.');
    }
  };

  // Process image with OCR
  const processImage = async (file) => {
    setIsScanning(true);
    setError(null);
    setScanProgress(0);

    try {
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => setPreviewImage(e.target.result);
      reader.readAsDataURL(file);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setScanProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Extract text using OCR
      const result = await ocrService.extractTextFromImage(file);
      
      clearInterval(progressInterval);
      setScanProgress(100);

             // The result already contains formData from the OCRService
       const data = {
         ...result,
         imageFile: file
       };
       
       setExtractedData(data);
       setEditableData({
         category: data.category,
         amount: data.formData?.amount || data.extractedData?.totalAmount || null,
         date: data.formData?.date || data.extractedData?.date || new Date(),
         supplier: data.formData?.supplier || data.formData?.workerName || data.formData?.tradeName || data.formData?.provider || data.extractedData?.vendor || null,
         itemName: data.formData?.itemName || data.formData?.equipmentName || data.formData?.serviceName || data.formData?.task || null,
         invoiceNumber: data.formData?.invoiceNumber || null,
         notes: data.formData?.notes || ''
       });

    } catch (err) {
      console.error('OCR processing failed:', err);
      setError(err.message || 'Failed to process image. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  // Start camera
  const startCamera = async () => {
    try {
      setError(null);
      
      // Check if camera is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported in this browser');
      }

      // Request camera permissions with better constraints
      const constraints = {
        video: {
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 },
          aspectRatio: { ideal: 4/3 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(err => {
            console.error('Error playing video:', err);
            setError('Error starting camera stream');
          });
        };
        
        videoRef.current.oncanplay = () => {
          setCameraReady(true);
        };
        
        videoRef.current.onerror = () => {
          setError('Error loading camera stream');
        };
      }
      
      setUseCamera(true);
    } catch (err) {
      console.error('Camera error:', err);
      
      // Provide specific error messages
      if (err.name === 'NotAllowedError') {
        setError('Camera access denied. Please allow camera permissions and try again.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found on this device.');
      } else if (err.name === 'NotSupportedError') {
        setError('Camera not supported in this browser. Please use file upload instead.');
      } else {
        setError(`Camera error: ${err.message}. Please use file upload instead.`);
      }
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      const tracks = stream.getTracks();
      tracks.forEach(track => {
        track.stop();
      });
      videoRef.current.srcObject = null;
    }
    setUseCamera(false);
    setCameraReady(false);
  };

  // Handle editable data changes
  const handleDataChange = (field, value) => {
    setEditableData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Add as expense
  const addAsExpense = () => {
    if (onScanComplete && extractedData && editableData) {
      // Update the extracted data with editable values
      const updatedData = {
        ...extractedData,
        category: editableData.category,
        amount: editableData.amount,
        date: editableData.date,
        supplier: editableData.supplier,
        itemName: editableData.itemName,
        invoiceNumber: editableData.invoiceNumber,
        formData: {
          ...extractedData.formData,
          notes: editableData.notes
        },
        // Include the original image file for storage
        imageFile: extractedData.imageFile
      };
      
      onScanComplete(updatedData);
      handleClose();
    }
  };

  // Scan again
  const scanAgain = () => {
    setExtractedData(null);
    setEditableData(null);
    setPreviewImage(null);
    setError(null);
    setScanProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Close scanner
  const handleClose = () => {
    stopCamera();
    setExtractedData(null);
    setEditableData(null);
    setPreviewImage(null);
    setError(null);
    setScanProgress(0);
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 md:p-4">
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-white/10 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[95vh] md:max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Camera className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">Scan Invoice</h2>
              <p className="text-slate-400 font-medium text-sm md:text-base">Extract and edit expense data</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 md:w-6 md:h-6 text-slate-400" />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto max-h-[calc(95vh-120px)] md:max-h-[calc(90vh-120px)]">
          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-3 p-3 md:p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Scanning Progress */}
          {isScanning && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 md:w-6 md:h-6 text-blue-400 animate-spin" />
                <span className="text-white font-medium text-sm md:text-base">Processing image...</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
              <p className="text-sm text-slate-400">Extracting text and analyzing content...</p>
            </div>
          )}

          {/* Image Preview and Results */}
          {extractedData && !isScanning && editableData && (
            <div className="space-y-4 md:space-y-6">
              {/* Preview */}
              {previewImage && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-white">Scanned Image</h3>
                  <div className="relative">
                    <img 
                      src={previewImage} 
                      alt="Scanned receipt" 
                      className="w-full max-h-40 md:max-h-48 object-contain rounded-xl border border-white/10"
                    />
                  </div>
                </div>
              )}

              {/* Editable Data Form */}
              <div className="space-y-4 md:space-y-6">
                <h3 className="text-lg font-semibold text-white">Edit Extracted Data</h3>
                
                <div className="grid grid-cols-1 gap-4">
                  {/* Category */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Category</label>
                    <select 
                      value={editableData.category} 
                      onChange={(e) => handleDataChange('category', e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    >
                      <option value="labour">Labour</option>
                      <option value="equipment">Equipment</option>
                      <option value="trade">Trade</option>
                      <option value="service">Service</option>
                      <option value="purchase">Materials</option>
                    </select>
                  </div>

                  {/* Amount */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Amount ($)</label>
                    <input
                      type="number"
                      value={editableData.amount || ''}
                      onChange={(e) => handleDataChange('amount', parseFloat(e.target.value) || null)}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none transition-all"
                      placeholder="0.00"
                    />
                  </div>

                  {/* Date */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Date</label>
                    <input
                      type="date"
                      value={editableData.date ? new Date(editableData.date).toISOString().split('T')[0] : ''}
                      onChange={(e) => handleDataChange('date', new Date(e.target.value))}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                    />
                  </div>

                  {/* Supplier */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Supplier</label>
                    <input
                      type="text"
                      value={editableData.supplier || ''}
                      onChange={(e) => handleDataChange('supplier', e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                      placeholder="Supplier name"
                    />
                  </div>

                  {/* Item/Service Name */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Item/Service</label>
                    <input
                      type="text"
                      value={editableData.itemName || ''}
                      onChange={(e) => handleDataChange('itemName', e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                      placeholder="Item or service description"
                    />
                  </div>

                  {/* Invoice Number */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Invoice Number</label>
                    <input
                      type="text"
                      value={editableData.invoiceNumber || ''}
                      onChange={(e) => handleDataChange('invoiceNumber', e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                      placeholder="Invoice #"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Notes</label>
                  <textarea
                    value={editableData.notes || ''}
                    onChange={(e) => handleDataChange('notes', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"
                    placeholder="Additional notes..."
                  />
                </div>

                {/* AI Service and Confidence Score */}
                <div className="flex items-center justify-between p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-slate-600 flex items-center justify-center">
                      <span className="text-xs text-slate-300 font-bold">%</span>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400 font-medium">Confidence Score</p>
                      <p className="text-white font-medium">{extractedData.confidence.toFixed(0)}%</p>
                    </div>
                  </div>
                  {extractedData.aiService && (
                    <div className="text-right">
                      <p className="text-xs text-slate-500">AI Service</p>
                      <p className="text-sm font-medium text-blue-400">{extractedData.aiService}</p>
                    </div>
                  )}
                </div>

                {/* Extracted Items */}
                {extractedData.extractedData?.items?.length > 0 && (
                  <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-slate-400 font-medium">Items Detected</p>
                      <span className="text-xs text-slate-500 bg-slate-700 px-2 py-1 rounded-full">
                        {extractedData.extractedData.items.length} items
                      </span>
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-2">
                      {extractedData.extractedData.items.map((item, index) => (
                        <div key={index} className="flex justify-between items-center p-2 bg-slate-700/50 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">{item.description}</p>
                            {item.quantity > 1 && (
                              <p className="text-xs text-slate-400">
                                Qty: {item.quantity} × ${item.unitPrice?.toFixed(2) || '0.00'}
                              </p>
                            )}
                          </div>
                          <div className="text-right ml-3">
                            <p className="text-sm font-medium text-green-400">
                              ${item.totalPrice?.toFixed(2) || '0.00'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col md:flex-row gap-3 md:gap-4 pt-4">
                  <button
                    onClick={addAsExpense}
                    className="flex-1 flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-6 py-3 rounded-xl font-semibold shadow-xl shadow-blue-500/25 hover:shadow-2xl hover:shadow-blue-500/40 hover:scale-105 transition-all duration-300"
                  >
                    <Plus className="w-5 h-5" />
                    Add as Expense
                  </button>
                  <button
                    onClick={scanAgain}
                    className="flex items-center justify-center gap-3 bg-slate-800 hover:bg-slate-700 text-slate-300 px-6 py-3 rounded-xl font-semibold border border-slate-700 hover:border-slate-600 transition-all duration-300"
                  >
                    <Camera className="w-5 h-5" />
                    Scan Again
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Input Methods */}
          {!isScanning && !extractedData && (
            <div className="space-y-4 md:space-y-6">
              {/* Camera Option */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Capture with Camera</h3>
                <div className="relative">
                  {useCamera ? (
                    <div className="space-y-4">
                      <div className="relative">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          controls={false}
                          className="w-full h-40 md:h-48 object-cover rounded-xl border border-white/10"
                          style={{ transform: 'scaleX(-1)' }} // Mirror the video for better UX
                        />
                        {/* Camera loading indicator */}
                        {!cameraReady && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
                            <div className="text-center">
                              <Loader2 className="w-8 h-8 text-white animate-spin mx-auto mb-2" />
                              <p className="text-white text-sm">Starting camera...</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <canvas ref={canvasRef} className="hidden" />
                      <div className="flex flex-col md:flex-row gap-3">
                        <button
                          onClick={handleCameraCapture}
                          className="flex-1 flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-6 py-3 rounded-xl font-semibold shadow-xl shadow-blue-500/25 hover:shadow-2xl hover:shadow-blue-500/40 hover:scale-105 transition-all duration-300"
                        >
                          <Camera className="w-5 h-5" />
                          Capture Photo
                        </button>
                        <button
                          onClick={stopCamera}
                          className="flex items-center justify-center gap-3 bg-slate-800 hover:bg-slate-700 text-slate-300 px-6 py-3 rounded-xl font-semibold border border-slate-700 hover:border-slate-600 transition-all duration-300"
                        >
                          <X className="w-5 h-5" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={startCamera}
                      className="w-full flex items-center justify-center gap-3 p-6 md:p-8 border-2 border-dashed border-slate-600 rounded-xl hover:border-blue-400 hover:bg-blue-400/10 transition-all duration-300"
                    >
                      <Camera className="w-6 h-6 md:w-8 md:h-8 text-slate-400" />
                      <span className="text-slate-300 font-medium text-base md:text-lg">Use Camera</span>
                    </button>
                  )}
                </div>
              </div>

              {/* File Upload Option */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Upload Image</h3>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-3 p-6 md:p-8 border-2 border-dashed border-slate-600 rounded-xl hover:border-blue-400 hover:bg-blue-400/10 transition-all duration-300"
                >
                  <Upload className="w-6 h-6 md:w-8 md:h-8 text-slate-400" />
                  <span className="text-slate-300 font-medium text-base md:text-lg">Choose File</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <p className="text-xs text-slate-500 text-center">
                  Supported formats: JPG, PNG, GIF, BMP
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OCRScanner; 