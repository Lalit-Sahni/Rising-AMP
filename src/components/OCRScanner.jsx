import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, AlertCircle, Loader2, User, Wrench, HardHat, FileText, DollarSign, Sparkles, Landmark } from 'lucide-react';
import EnhancedOCRService from '../utils/EnhancedOCRService';
import { categoryIconWell, getCategoryStyle } from '../utils/categoryStyle';
import { detectUncertainFields } from '../utils/ocrUncertainty';

const CATEGORIES = [
  { key: 'labour',   label: 'Labour',    icon: User,      description: 'Worker wages & hours' },
  { key: 'trade',    label: 'Trade',     icon: Wrench,    description: 'Contractor & specialist work' },
  { key: 'equipment',label: 'Equipment', icon: HardHat,   description: 'Tools & machinery rental' },
  { key: 'service',  label: 'Service',   icon: FileText,  description: 'Professional services' },
  { key: 'purchase', label: 'Materials', icon: DollarSign,description: 'Supplies & raw materials' },
  { key: 'investor', label: 'Investor',  icon: Landmark,  description: 'Land, legal and finance' },
];

const OCRScanner = ({ onScanComplete, onClose, isOpen }) => {
  const [isScanning, setIsScanning]     = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [error, setError]               = useState(null);
  const [useCamera, setUseCamera]       = useState(false);
  const [cameraReady, setCameraReady]   = useState(false);
  // After OCR completes, hold the result here until user confirms category
  const [pendingData, setPendingData]   = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const videoRef     = useRef(null);
  const canvasRef    = useRef(null);
  const pendingStreamRef = useRef(null);
  const ocrServiceRef = useRef(null);
  if (!ocrServiceRef.current) ocrServiceRef.current = new EnhancedOCRService();
  const ocrService = ocrServiceRef.current;

  useEffect(() => {
    if (!isOpen) resetAll();
  }, [isOpen]);

  useEffect(() => {
    if (!useCamera) return undefined;
    const video = videoRef.current;
    const stream = pendingStreamRef.current;
    if (!video || !stream) {
      setError('Camera not ready. Please try Take photo instead.');
      setUseCamera(false);
      return undefined;
    }
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      video.play().catch(() => setError('Error starting camera'));
    };
    video.oncanplay = () => setCameraReady(true);
    video.play().catch(() => {});
    return () => {
      setCameraReady(false);
      if (video.srcObject && typeof video.srcObject.getTracks === 'function') {
        video.srcObject.getTracks().forEach((track) => track.stop());
      }
      video.srcObject = null;
      pendingStreamRef.current = null;
    };
  }, [useCamera]);

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
      case 'investor':
        return { ...base, supplier: editable.supplier || base.supplier, itemName: editable.itemName || base.itemName, amount: editable.amount || base.amount, unitCost: editable.amount || base.unitCost, quantity: base.quantity || '1' };
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
        amount:   data.formData?.amount || data.formData?.unitCost || data.formData?.cost || data.extractedData?.totalAmount || null,
        date:     data.formData?.date   || data.extractedData?.date || null,
        supplier: data.formData?.supplier || data.formData?.workerName || data.formData?.tradeName || data.formData?.provider || data.extractedData?.vendor || null,
        itemName: data.formData?.itemName || data.formData?.equipmentName || data.formData?.serviceName || data.formData?.task || null,
        notes:    data.formData?.notes || '',
      };
      const uncertainFields = detectUncertainFields(data);

      setPendingData({ data, editable, uncertainFields });
      setSelectedCategory(data.category || 'purchase');

    } catch (err) {
      console.error('OCR processing failed:', err);
      setError(err.message || 'Could not read that receipt with AI. Try another photo, or enter the details yourself.');
    } finally {
      setIsScanning(false);
      setScanProgress(0);
    }
  };

  const confirmCategory = () => {
    if (!pendingData || !selectedCategory) return;
    const { data, editable, uncertainFields } = pendingData;
    if (onScanComplete) {
      onScanComplete({
        ...data,
        category: selectedCategory,
        formData: buildFormData(selectedCategory, editable, data.formData || {}),
        uncertainFields: uncertainFields || {},
      });
    }
    handleClose();
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please select a valid image file'); return; }
    await processImage(file);
  };

  const handleCameraCapture = () => {
    if (!videoRef.current || !canvasRef.current) { setError('Camera not ready. Please try again.'); return; }
    try {
      const canvas = canvasRef.current;
      const video  = videoRef.current;
      if (video.videoWidth === 0 || video.videoHeight === 0) { setError('Camera not ready. Please wait and try again.'); return; }
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      canvas.toBlob(async (blob) => {
        if (blob) await processImage(new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' }));
        else setError('Failed to capture image. Please try again.');
      }, 'image/jpeg', 0.9);
    } catch { setError('Failed to capture image. Please try again.'); }
  };

  const startCamera = async () => {
    setError(null);
    setCameraReady(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera not supported');
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      pendingStreamRef.current = stream;
      setUseCamera(true);
    } catch (err) {
      pendingStreamRef.current = null;
      if (err.name === 'NotAllowedError') setError('Camera access denied. Please allow camera permissions.');
      else if (err.name === 'NotFoundError') setError('No camera found on this device.');
      else setError('Camera error. Please use Take photo or Upload instead.');
    }
  };

  const stopCamera = () => {
    setUseCamera(false);
    setCameraReady(false);
  };

  const resetAll = () => {
    stopCamera();
    setError(null);
    setScanProgress(0);
    setIsScanning(false);
    setPendingData(null);
    setSelectedCategory(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleClose = () => {
    resetAll();
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  // ── Category confirmation screen ──────────────────────────────────────────
  if (pendingData) {
    const aiCategory = pendingData.data.category;
    const uncertain = pendingData.uncertainFields || {};
    const amountValue = pendingData.editable.amount;
    const dateValue = pendingData.editable.date;
    const dateLabel = dateValue ? new Date(dateValue).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    const amountLabel = amountValue != null && amountValue !== ''
      ? `$${Number(amountValue).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '—';

    return (
      <div className="fixed inset-0 bg-steel-900/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
        <div className="bg-surface rounded-t-ot md:rounded-ot shadow-[0_24px_64px_rgba(23,24,28,0.28)] w-full max-w-md border border-hairline max-h-[100dvh] md:max-h-[90vh] flex flex-col">

          <div className="flex items-center justify-between p-4 md:p-5 border-b border-hairline">
            <div className="min-w-0">
              <h2 className="text-[17px] font-extrabold tracking-tight text-ink">Receipt read</h2>
              <p className="text-[12.5px] text-slate-400 mt-0.5 truncate">
                {pendingData.editable.supplier || 'Confirm the details before saving'}
              </p>
            </div>
            <button onClick={handleClose} className="w-9 h-9 grid place-items-center border border-hairline hover:bg-canvas rounded-ot-sm transition-colors" aria-label="Close">
              <X className="w-4 h-4 text-slate-600" />
            </button>
          </div>

          <div className="p-4 md:p-5 space-y-3 overflow-y-auto" style={{ paddingBottom: 'calc(16px + var(--safe-bottom))' }}>
            <div className={`flex items-center justify-between rounded-[9px] border px-3.5 py-2.5 ${uncertain.amount ? 'border-warn bg-warn-tint' : 'border-hairline bg-surface'}`}>
              <span>
                <span className="block text-[11px] text-slate-400 font-semibold">Amount</span>
                <span className="tabular text-sm font-bold">{amountLabel}</span>
              </span>
              {uncertain.amount && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-warn">
                  <AlertCircle className="w-[13px] h-[13px]" strokeWidth={2} />
                  Check this
                </span>
              )}
            </div>
            <div className={`flex items-center justify-between rounded-[9px] border px-3.5 py-2.5 ${uncertain.date ? 'border-warn bg-warn-tint' : 'border-hairline bg-surface'}`}>
              <span>
                <span className="block text-[11px] text-slate-400 font-semibold">Date</span>
                <span className="tabular text-sm font-bold">{Number.isNaN(new Date(dateValue).getTime()) ? '—' : dateLabel}</span>
              </span>
              {uncertain.date && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-warn">
                  <AlertCircle className="w-[13px] h-[13px]" strokeWidth={2} />
                  Check this
                </span>
              )}
            </div>

            {aiCategory && (
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                <span>Looks like <span className="font-semibold text-accent">{CATEGORIES.find(c => c.key === aiCategory)?.label || aiCategory}</span>. Change it if that is wrong.</span>
              </div>
            )}

            {/* Category buttons */}
            <div className="space-y-2">
              {CATEGORIES.map(({ key, label, icon: Icon, description }) => {
                const isSelected = selectedCategory === key;
                const isAiPick   = aiCategory === key;
                const style = getCategoryStyle(key);
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedCategory(key)}
                    className={`pressable w-full flex items-center gap-3.5 p-3 rounded-ot border text-left bg-surface
                      ${isSelected
                        ? 'border-accent'
                        : 'border-hairline'
                      }`}
                  >
                    <div
                      className="w-10 h-10 rounded-[9px] flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: categoryIconWell(style.hex), color: style.hex }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm ${isSelected ? 'text-accent' : 'text-ink'}`}>{label}</span>
                        {isAiPick && (
                          <span className="text-xs bg-accent-tint text-accent px-1.5 py-0.5 rounded-full font-medium">AI pick</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate">{description}</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors ${isSelected ? 'border-accent bg-accent' : 'border-hairline'}`} />
                  </button>
                );
              })}
            </div>

            <button
              onClick={confirmCategory}
              className="w-full mt-2 bg-accent hover:bg-accent-600 text-white font-bold py-3 rounded-ot-sm transition-colors"
            >
              Continue to the form
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Scanner screen ────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-steel-900/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-surface rounded-t-ot md:rounded-ot shadow-[0_24px_64px_rgba(23,24,28,0.28)] w-full max-w-lg border border-hairline">

        <div className="flex items-center justify-between p-4 md:p-5 border-b border-hairline">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-[10px] bg-accent flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[17px] font-extrabold tracking-tight text-ink">Scan a receipt</h2>
              <p className="text-[12.5px] text-slate-400">Take a photo or pick one. We read it, you check it.</p>
            </div>
          </div>
          <button onClick={handleClose} className="w-9 h-9 grid place-items-center border border-hairline hover:bg-canvas rounded-ot-sm transition-colors" aria-label="Close">
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        <div className="p-4 md:p-5 space-y-4" style={{ paddingBottom: 'calc(16px + var(--safe-bottom))' }}>

          {error && (
            <div className="flex items-start gap-3 p-3 bg-[#F9E9E7] border border-hairline rounded-ot-sm">
              <AlertCircle className="w-5 h-5 text-neg flex-shrink-0 mt-0.5" />
              <p className="text-neg text-sm">{error}</p>
            </div>
          )}

          {isScanning && (
            <div className="space-y-3 py-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-accent animate-spin" />
                <span className="text-ink font-semibold text-sm">Reading the receipt…</span>
              </div>
              <div className="w-full bg-hairline rounded-full h-2">
                <div className="bg-accent h-2 rounded-full transition-all duration-300" style={{ width: `${scanProgress}%` }} />
              </div>
              <p className="text-xs text-slate-400">Finding the supplier, the amount and the date.</p>
            </div>
          )}

          {!isScanning && (
            <div className="space-y-3">
              {useCamera ? (
                <div className="space-y-3">
                  <div className="relative rounded-ot overflow-hidden bg-canvas">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-48 object-cover" />
                    {!cameraReady && (
                      <div className="absolute inset-0 flex items-center justify-center bg-canvas">
                        <div className="text-center">
                          <Loader2 className="w-7 h-7 text-accent animate-spin mx-auto mb-2" />
                          <p className="text-slate-400 text-sm">Starting camera…</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="flex gap-3">
                    <button
                      onClick={handleCameraCapture}
                      disabled={!cameraReady}
                      className="flex-1 flex items-center justify-center gap-2 bg-accent hover:bg-accent-600 disabled:opacity-50 text-white px-4 py-3 rounded-ot-sm font-bold transition-colors"
                    >
                      <Camera className="w-4 h-4" />
                      Capture
                    </button>
                    <button onClick={stopCamera} className="flex items-center justify-center gap-2 px-4 py-3 bg-surface border border-hairline hover:bg-canvas text-ink rounded-ot-sm font-semibold transition-colors">
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-3 p-5 border-2 border-dashed border-hairline rounded-ot hover:border-accent hover:bg-accent-tint transition-all duration-200"
                  >
                    <Camera className="w-6 h-6 text-slate-400" />
                    <span className="text-ink font-bold">Take a photo</span>
                  </button>
                  <button
                    onClick={startCamera}
                    className="w-full flex items-center justify-center gap-3 p-3.5 border border-hairline rounded-ot hover:border-accent hover:bg-accent-tint transition-all duration-200"
                  >
                    <span className="text-slate-600 font-semibold text-sm">Use the live camera instead</span>
                  </button>
                </>
              )}

              {!useCamera && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-hairline" />
                    <span className="text-xs text-slate-400 font-medium">or</span>
                    <div className="flex-1 h-px bg-hairline" />
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-3 p-5 border-2 border-dashed border-hairline rounded-ot hover:border-accent hover:bg-accent-tint transition-all duration-200"
                  >
                    <Upload className="w-6 h-6 text-slate-400" />
                    <span className="text-ink font-bold">Choose a photo</span>
                  </button>
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                  <p className="text-xs text-slate-400 text-center">JPG, PNG, GIF or BMP.</p>
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
