// OCR Configuration and Settings
// Centralized configuration for OCR services and image processing

export const OCR_CONFIG = {
  // OCR Provider Priority (order of fallback)
  PROVIDER_PRIORITY: ['OpenAI', 'GoogleVision', 'Tesseract'],
  
  // Image Processing Settings
  IMAGE: {
    // Maximum file size for upload (5MB)
    MAX_SIZE: 5 * 1024 * 1024,
    
    // Supported image formats
    SUPPORTED_FORMATS: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    
    // Image compression settings
    COMPRESSION: {
      MAX_WIDTH: 1920,
      QUALITY: 0.8,
      MAX_SIZE_AFTER_COMPRESSION: 2 * 1024 * 1024 // 2MB
    }
  },
  
  // API Settings
  API: {
    // OpenAI API settings
    OPENAI: {
      MODEL: 'gpt-4-vision-preview',
      MAX_TOKENS: 2000,
      TEMPERATURE: 0.1,
      TIMEOUT: 30000 // 30 seconds
    },
    
    // Google Cloud Vision API settings
    GOOGLE_VISION: {
      FEATURE_TYPE: 'DOCUMENT_TEXT_DETECTION',
      MAX_RESULTS: 1,
      TIMEOUT: 20000 // 20 seconds
    },
    
    // Tesseract.js settings
    TESSERACT: {
      LANGUAGE: 'eng',
      TIMEOUT: 30000 // 30 seconds
    }
  },
  
  // Storage Settings
  STORAGE: {
    // Firebase Storage paths
    PATHS: {
      RECEIPTS: 'receipts'
    },
    
    // File naming convention
    FILE_NAMING: {
      PREFIX: 'receipt_',
      TIMESTAMP_FORMAT: 'timestamp'
    }
  },
  
  // UI Settings
  UI: {
    // Loading states
    LOADING: {
      OCR_PROCESSING: 'Processing with AI...',
      IMAGE_UPLOAD: 'Uploading receipt...',
      IMAGE_DOWNLOAD: 'Loading receipt...'
    },
    
    // Confidence score thresholds
    CONFIDENCE: {
      HIGH: 80,
      MEDIUM: 60,
      LOW: 40
    },
    
    // Error messages
    ERRORS: {
      NO_API_KEY: 'API key not configured',
      INVALID_FILE_TYPE: 'Invalid file type. Please upload JPG, PNG, GIF, or WebP images.',
      FILE_TOO_LARGE: 'File size too large. Please upload images smaller than 5MB.',
      OCR_FAILED: 'Failed to process image. Please try again.',
      UPLOAD_FAILED: 'Failed to upload receipt. Please try again.',
      DOWNLOAD_FAILED: 'Failed to load receipt. Please try again.'
    }
  },
  
  // Construction-specific settings
  CONSTRUCTION: {
    // Category mapping for common vendors
    VENDOR_CATEGORIES: {
      'home depot': 'purchase',
      'lowes': 'purchase',
      'menards': 'purchase',
      'ace hardware': 'purchase',
      'grainger': 'equipment',
      'fastenal': 'purchase',
      'equipment rental': 'equipment',
      'tool rental': 'equipment'
    },
    
    // Trade categories
    TRADE_CATEGORIES: [
      'Electrician',
      'Plumber', 
      'Carpenter',
      'Painter',
      'Roofer',
      'HVAC',
      'Concrete',
      'Tiling',
      'Flooring',
      'Other'
    ],
    
    // Common construction keywords
    KEYWORDS: {
      LABOUR: ['labor', 'labour', 'worker', 'employee', 'contractor', 'hourly', 'rate', 'wage', 'salary'],
      EQUIPMENT: ['equipment', 'tool', 'machine', 'rental', 'lease', 'excavator', 'crane', 'bulldozer'],
      TRADE: ['electrician', 'plumber', 'carpenter', 'painter', 'roofer', 'hvac', 'concrete', 'tiling'],
      SERVICE: ['service', 'maintenance', 'repair', 'installation', 'consulting', 'inspection'],
      PURCHASE: ['material', 'supply', 'lumber', 'hardware', 'purchase', 'buy']
    }
  }
};

// Helper functions for configuration
export const getOCRProvider = (index = 0) => {
  return OCR_CONFIG.PROVIDER_PRIORITY[index] || 'Tesseract';
};

export const isImageFormatSupported = (fileType) => {
  return OCR_CONFIG.IMAGE.SUPPORTED_FORMATS.includes(fileType);
};

export const isFileSizeValid = (fileSize) => {
  return fileSize <= OCR_CONFIG.IMAGE.MAX_SIZE;
};

export const getConfidenceLevel = (score) => {
  if (score >= OCR_CONFIG.UI.CONFIDENCE.HIGH) return 'high';
  if (score >= OCR_CONFIG.UI.CONFIDENCE.MEDIUM) return 'medium';
  return 'low';
};

export const getConfidenceColor = (score) => {
  const level = getConfidenceLevel(score);
  switch (level) {
    case 'high': return 'text-green-400';
    case 'medium': return 'text-yellow-400';
    case 'low': return 'text-red-400';
    default: return 'text-gray-400';
  }
};

export const getVendorCategory = (vendorName) => {
  if (!vendorName) return 'purchase';
  
  const lowerVendor = vendorName.toLowerCase();
  for (const [vendor, category] of Object.entries(OCR_CONFIG.CONSTRUCTION.VENDOR_CATEGORIES)) {
    if (lowerVendor.includes(vendor)) {
      return category;
    }
  }
  return 'purchase';
};

export default OCR_CONFIG;

