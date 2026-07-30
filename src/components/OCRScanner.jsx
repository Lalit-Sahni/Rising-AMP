import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, AlertCircle, Loader2 } from 'lucide-react';
import EnhancedOCRService from '../utils/EnhancedOCRService';

const OCRScanner = ({ onScanComplete, onClose, isOpen }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [error, setError] = useState(null);
  const [useCamera, setUseCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const ocrService = new EnhancedOCRService();

  // Cleanup camera on unmount
  useEffect(() => {
    const videoElement = videoRef.current;
    return () => {
      if (videoElement?.srcObject) {
        videoElement.srcObject.getTracks().forEach(t => t.stop());
        videoElement.srcObject = null;
      }
    };
  }, []);

  // Cleanup camera when modal closes
  useEffect(() => {
    if (!isOpen) stopCamera();
  }, [isOpen]);

  // Map generic OCR fields to category-specific ExpenseModal field names
  const buildFormData = (category, editable, originalFormData) => {
    const base = { ...originalFormData, date: editable.date, notes: editable.notes };
    switch (category) {
      case 'labour':
        return { ...base, workerName: editable.supplier || base.workerName, rate: editable.amount || base.rate };
      case 'trade':
        return { ...base, tradeName: editable.supplier || base.tradeName, amount: editable.amount || base.amount, task: editable.itemName || base.task };
      case 'service':
        return { ...base, provider: editable.supplier || base.provider, cost: editable.amount || base.cost, serviceName: editable.itemName || base.serviceName };
      case 'equipment':
        return { ...base, equipmentName: editable.itemName || base.equipmentName, totalPrice: editable.amount || base.totalPrice };
      case 'purchase':
      default:
        return { ...base, supplier: editable.supplier || base.supplier, itemName: editable.itemName || base.itemName, unitCost: editable.amount || base.unitCost, quantity: base.quantity || '1' };
    }
  };

  const processImage = async (file) => {
    setIsScanning(true);
    setError(null);
    setScanProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setScanProgress(prev => {
          if (prev >= 90) { clearInterval(progressInterval); return 90; }
          return prev + 10;
        });
      }, 200);

      const result = await ocrService.extractTextFromImage(file);
      clearInterval(progressInterval);
      setScanProgress(100);

      const data = { ...result, imageFile: file };

      const editable = {
        category: data.category,
        amount: data.formData?.amount || data.formData?.unitCost || data.formData?.cost || data.extractedData?.totalAmount || null,
        date: data.formData?.date || data.extractedData?.date || new Date(),
        supplier: data.formData?.supplier || data.formData?.workerName || data.formData?.tradeName || data.formData?.provider || data.extractedData?.vendor || null,
        itemName: data.formData?.itemName || data.formData?.equipmentName || data.formData?.serviceName || data.formData?.task || null,
        notes: data.formData?.notes || '',
      };

      if (onScanComplete) {
        onScanComplete({
          ...data,
          formData: buildFormData(data.category, editable, data.formData || {}),
        });
      }
      handleClose();

    } catch (err) {
      console.error('OCR processing failed:', err);
      setError(err.message || 'Failed to process image. Please try again.');
    } finally {
      setIsScanning(false);
      setScanProgress(0);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }
    await processImage(file);
  };

  const handleCameraCapture = () => {
    if (!videoRef.current || !canvasRef.current) {
      setError('Camera not ready. Please try again.');
      return;
    }
    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        setError('Camera stream not ready. Please wait and try again.');
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      canvas.toBlob(async (blob) => {
        if (blob) {
          await processImage(new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' }));
        } else {
          setError('Failed to capture image. Please try again.');
        }
      }, 'image/jpeg', 0.9);
    } catch (err) {
      setError('Failed to capture image. Please try again.');
    }
  };

  const startCamera = async () => {
    try {
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera not supported in this browser');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current.play().catch(() => setError('Error starting camera'));
        videoRef.current.oncanplay = () => setCameraReady(true);
      }
      setUseCamera(true);
    } catch (err) {
      if (err.name === 'NotAllowedError') setError('Camera access denied. Please allow camera permissions.');
      else if (err.name === 'NotFoundError') setError('No camera found on this device.');
      else setError('Camera error. Please use file upload instead.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setUseCamera(false);
    setCameraReady(false);
  };

  const handleClose = () => {
    stopCamera();
    setError(null);
    setScanProgress(0);
    setIsScanning(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-zinc-200">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900">Scan Invoice</h2>
              <p className="text-sm text-zinc-500">Photo or file — we'll extract the details</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-zinc-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Scanning progress */}
          {isScanning && (
            <div className="space-y-3 py-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-accent animate-spin" />
                <span className="text-zinc-700 font-medium text-sm">Scanning invoice...</span>
              </div>
              <div className="w-full bg-zinc-200 rounded-full h-2">
                <div
                  className="bg-accent h-2 rounded-full transition-all duration-300"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
              <p className="text-xs text-zinc-400">Extracting text and identifying expense details</p>
            </div>
          )}

          {/* Upload / Camera options */}
          {!isScanning && (
            <div className="space-y-3">

              {/* Camera */}
              {useCamera ? (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden bg-zinc-100">
                    <video
                      ref={videoRef}
                      autoPlay playsInline muted
                      className="w-full h-48 object-cover"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                    {!cameraReady && (
                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-100">
                        <div className="text-center">
                          <Loader2 className="w-7 h-7 text-accent animate-spin mx-auto mb-2" />
                          <p className="text-zinc-500 text-sm">Starting camera...</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="flex gap-3">
                    <button
                      onClick={handleCameraCapture}
                      disabled={!cameraReady}
                      className="flex-1 flex items-center justify-center gap-2 bg-accent hover:bg-orange-600 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-semibold transition-colors"
                    >
                      <Camera className="w-4 h-4" />
                      Capture Photo
                    </button>
                    <button
                      onClick={stopCamera}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl font-medium transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={startCamera}
                  className="w-full flex items-center justify-center gap-3 p-5 border-2 border-dashed border-zinc-300 rounded-xl hover:border-accent hover:bg-orange-50 transition-all duration-200"
                >
                  <Camera className="w-6 h-6 text-zinc-400" />
                  <span className="text-zinc-600 font-medium">Use Camera</span>
                </button>
              )}

              {/* File upload */}
              {!useCamera && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-zinc-200" />
                    <span className="text-xs text-zinc-400 font-medium">or</span>
                    <div className="flex-1 h-px bg-zinc-200" />
                  </div>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-3 p-5 border-2 border-dashed border-zinc-300 rounded-xl hover:border-accent hover:bg-orange-50 transition-all duration-200"
                  >
                    <Upload className="w-6 h-6 text-zinc-400" />
                    <span className="text-zinc-600 font-medium">Upload Image</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <p className="text-xs text-zinc-400 text-center">Supports JPG, PNG, GIF, BMP</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OCRScanner;
