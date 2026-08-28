import React, { useState, useEffect } from 'react';
import { X, Download, Trash2, ZoomIn, ZoomOut, RotateCw, Maximize2 } from 'lucide-react';

const iconBtn =
  'p-2 rounded-ot-sm border border-hairline text-slate-600 hover:text-ink hover:bg-canvas transition-colors';

const ReceiptViewer = ({ isOpen, onClose, receiptUrl, receiptMetadata, onDelete }) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setIsFullscreen(false);
      setImageLoaded(false);
      setImageError(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case '+':
        case '=':
          e.preventDefault();
          setZoom((prev) => Math.min(prev + 0.25, 3));
          break;
        case '-':
          e.preventDefault();
          setZoom((prev) => Math.max(prev - 0.25, 0.25));
          break;
        case '0':
          e.preventDefault();
          setZoom(1);
          setRotation(0);
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          setRotation((prev) => (prev + 90) % 360);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          setIsFullscreen((prev) => !prev);
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.25));
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(receiptUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt_${new Date().toISOString().split('T')[0]}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading receipt:', error);
    }
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this receipt? This action cannot be undone.')) {
      onDelete();
      onClose();
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div
        className={`bg-surface border border-hairline rounded-ot shadow-whisper overflow-hidden flex flex-col ${
          isFullscreen ? 'w-full h-full max-w-none max-h-none' : 'w-full max-w-6xl max-h-[90vh]'
        }`}
      >
        <div className="flex items-center justify-between gap-3 p-4 md:px-5 border-b border-hairline">
          <div className="min-w-0">
            <h2 className="text-[16px] font-extrabold text-ink truncate">Receipt</h2>
            <p className="text-[12px] text-slate-400 truncate">
              {receiptMetadata?.fileName || 'Receipt image'}
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="flex items-center gap-0.5 border border-hairline rounded-ot-sm p-0.5">
              <button type="button" onClick={handleZoomOut} className={iconBtn} title="Zoom out (-)">
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-[11px] tabular text-slate-600 px-1.5 min-w-[3rem] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button type="button" onClick={handleZoomIn} className={iconBtn} title="Zoom in (+)">
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            <button type="button" onClick={handleRotate} className={iconBtn} title="Rotate (R)">
              <RotateCw className="w-4 h-4" />
            </button>

            <button type="button" onClick={handleReset} className={`${iconBtn} text-[12px] font-semibold`} title="Reset (0)">
              Reset
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={iconBtn}
              title="Toggle fullscreen (F)"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            <button type="button" onClick={handleDownload} className={iconBtn} title="Download">
              <Download className="w-4 h-4" />
            </button>

            {onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-2 rounded-ot-sm border border-hairline text-neg hover:bg-canvas transition-colors"
                title="Delete receipt"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button type="button" onClick={onClose} className={iconBtn} title="Close (Esc)">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-canvas min-h-[280px]">
          <div className="h-full flex items-center justify-center p-4">
            {imageError ? (
              <div className="text-center max-w-md">
                <h3 className="text-[16px] font-bold text-ink mb-1">Could not load that photo</h3>
                <p className="text-[13px] text-slate-600">
                  The receipt image could not be loaded. It may have been deleted, or the link is no longer valid.
                </p>
              </div>
            ) : (
              <div className="relative">
                <img
                  src={receiptUrl}
                  alt="Receipt"
                  className="max-w-full max-h-[60vh] object-contain transition-transform duration-200"
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    transformOrigin: 'center',
                  }}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                />

                {!imageLoaded && !imageError && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-[13px] text-slate-400">Loading receipt…</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {receiptMetadata && (
          <div className="border-t border-hairline bg-surface px-4 py-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
              <div>
                <p className="eyebrow">File size</p>
                <p className="text-ink mt-0.5">{formatFileSize(receiptMetadata.size)}</p>
              </div>
              <div>
                <p className="eyebrow">Uploaded</p>
                <p className="text-ink mt-0.5">{formatDate(receiptMetadata.uploadedAt)}</p>
              </div>
              <div>
                <p className="eyebrow">Format</p>
                <p className="text-ink mt-0.5">
                  {receiptMetadata.contentType?.split('/')[1]?.toUpperCase() || 'Unknown'}
                </p>
              </div>
              <div>
                <p className="eyebrow">Zoom</p>
                <p className="text-ink mt-0.5 tabular">{Math.round(zoom * 100)}%</p>
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-hairline bg-canvas px-4 py-2.5">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
            <span>
              <kbd className="px-1 py-0.5 bg-surface border border-hairline rounded-ot-sm text-ink">+</kbd>
              {' / '}
              <kbd className="px-1 py-0.5 bg-surface border border-hairline rounded-ot-sm text-ink">−</kbd> Zoom
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-surface border border-hairline rounded-ot-sm text-ink">R</kbd> Rotate
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-surface border border-hairline rounded-ot-sm text-ink">0</kbd> Reset
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-surface border border-hairline rounded-ot-sm text-ink">F</kbd> Fullscreen
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-surface border border-hairline rounded-ot-sm text-ink">Esc</kbd> Close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiptViewer;
