import React, { useState, useEffect } from 'react';
import { X, Download, Trash2, ZoomIn, ZoomOut, RotateCw, Maximize2 } from 'lucide-react';

const ReceiptViewer = ({ isOpen, onClose, receiptUrl, receiptMetadata, onDelete }) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setIsFullscreen(false);
      setImageLoaded(false);
      setImageError(false);
    }
  }, [isOpen]);

  // Handle keyboard shortcuts
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
          setZoom(prev => Math.min(prev + 0.25, 3));
          break;
        case '-':
          e.preventDefault();
          setZoom(prev => Math.max(prev - 0.25, 0.25));
          break;
        case '0':
          e.preventDefault();
          setZoom(1);
          setRotation(0);
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          setRotation(prev => (prev + 90) % 360);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          setIsFullscreen(prev => !prev);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.25));
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
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
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden ${
        isFullscreen ? 'w-full h-full max-w-none max-h-none' : 'w-full max-w-6xl max-h-[90vh]'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Maximize2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Receipt Viewer</h2>
              <p className="text-sm text-slate-400">
                {receiptMetadata?.fileName || 'Receipt Image'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-slate-700 rounded-lg p-1">
              <button
                onClick={handleZoomOut}
                className="p-1.5 hover:bg-slate-600 rounded text-slate-300 hover:text-white transition-colors"
                title="Zoom Out (-)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-300 px-2">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-1.5 hover:bg-slate-600 rounded text-slate-300 hover:text-white transition-colors"
                title="Zoom In (+)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* Action Buttons */}
            <button
              onClick={handleRotate}
              className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
              title="Rotate (R)"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            
            <button
              onClick={handleReset}
              className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
              title="Reset (0)"
            >
              <span className="text-sm font-medium">Reset</span>
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
              title="Toggle Fullscreen (F)"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            <button
              onClick={handleDownload}
              className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>

            {onDelete && (
              <button
                onClick={handleDelete}
                className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 hover:text-red-300 transition-colors"
                title="Delete Receipt"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Image Container */}
        <div className="flex-1 overflow-hidden bg-slate-950">
          <div className="h-full flex items-center justify-center p-4">
            {imageError ? (
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
                  <X className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Failed to Load Image</h3>
                <p className="text-slate-400">The receipt image could not be loaded. It may have been deleted or the URL is invalid.</p>
              </div>
            ) : (
              <div className="relative">
                <img
                  src={receiptUrl}
                  alt="Receipt"
                  className="max-w-full max-h-full object-contain transition-transform duration-200"
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    transformOrigin: 'center'
                  }}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                />
                
                {!imageLoaded && !imageError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-800/50">
                    <div className="text-center">
                      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      <p className="text-slate-400">Loading receipt...</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer with Metadata */}
        {receiptMetadata && (
          <div className="border-t border-slate-700 bg-slate-800 p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-slate-400 font-medium">File Size</p>
                <p className="text-white">{formatFileSize(receiptMetadata.size)}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Uploaded</p>
                <p className="text-white">{formatDate(receiptMetadata.uploadedAt)}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Format</p>
                <p className="text-white">{receiptMetadata.contentType?.split('/')[1]?.toUpperCase() || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Zoom</p>
                <p className="text-white">{Math.round(zoom * 100)}%</p>
              </div>
            </div>
          </div>
        )}

        {/* Keyboard Shortcuts Help */}
        <div className="border-t border-slate-700 bg-slate-800 p-3">
          <div className="flex flex-wrap gap-4 text-xs text-slate-400">
            <span><kbd className="px-1 py-0.5 bg-slate-700 rounded">+</kbd> / <kbd className="px-1 py-0.5 bg-slate-700 rounded">-</kbd> Zoom</span>
            <span><kbd className="px-1 py-0.5 bg-slate-700 rounded">R</kbd> Rotate</span>
            <span><kbd className="px-1 py-0.5 bg-slate-700 rounded">0</kbd> Reset</span>
            <span><kbd className="px-1 py-0.5 bg-slate-700 rounded">F</kbd> Fullscreen</span>
            <span><kbd className="px-1 py-0.5 bg-slate-700 rounded">Esc</kbd> Close</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiptViewer;
