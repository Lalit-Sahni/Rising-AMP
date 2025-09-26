// Mobile optimization utilities

// Check if device is mobile
export const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         window.innerWidth <= 768;
};

// Check if device has reduced motion preference
export const prefersReducedMotion = () => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// Check if device has low memory
export const isLowMemoryDevice = () => {
  if ('deviceMemory' in navigator) {
    return navigator.deviceMemory < 4; // Less than 4GB
  }
  return false;
};

// Check if device has slow connection
export const isSlowConnection = () => {
  if ('connection' in navigator) {
    const connection = navigator.connection;
    return connection.effectiveType === 'slow-2g' || 
           connection.effectiveType === '2g' || 
           connection.effectiveType === '3g';
  }
  return false;
};

// Get optimal animation duration based on device capabilities
export const getOptimalAnimationDuration = (defaultDuration = 300) => {
  if (prefersReducedMotion()) return 0;
  if (isLowMemoryDevice()) return defaultDuration * 0.5;
  if (isSlowConnection()) return defaultDuration * 0.7;
  return defaultDuration;
};

// Get optimal blur amount based on device performance
export const getOptimalBlurAmount = (defaultBlur = 20) => {
  if (isLowMemoryDevice()) return defaultBlur * 0.5;
  if (isMobile()) return defaultBlur * 0.7;
  return defaultBlur;
};

// Debounce function for performance
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Throttle function for performance
export const throttle = (func, limit) => {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Optimize image loading for mobile
export const optimizeImageLoading = (src, options = {}) => {
  const { width = 800, quality = 80 } = options;
  
  if (isMobile()) {
    // Reduce image quality and size on mobile
    return `${src}?w=${width * 0.7}&q=${quality * 0.8}`;
  }
  
  return src;
};

// Get optimal batch size for data processing
export const getOptimalBatchSize = (defaultSize = 50) => {
  if (isLowMemoryDevice()) return Math.floor(defaultSize * 0.3);
  if (isMobile()) return Math.floor(defaultSize * 0.6);
  return defaultSize;
};

// Check if device supports specific features
export const supportsFeature = (feature) => {
  const featureSupport = {
    webgl: () => {
      try {
        const canvas = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && 
                 (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
      } catch (e) {
        return false;
      }
    },
    webp: () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    },
    avif: () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      return canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0;
    },
    backdropFilter: () => {
      return CSS.supports('backdrop-filter', 'blur(1px)') ||
             CSS.supports('-webkit-backdrop-filter', 'blur(1px)');
    },
    intersectionObserver: () => {
      return 'IntersectionObserver' in window;
    },
    resizeObserver: () => {
      return 'ResizeObserver' in window;
    }
  };
  
  return featureSupport[feature] ? featureSupport[feature]() : false;
};

// Get device performance profile
export const getDeviceProfile = () => {
  return {
    isMobile: isMobile(),
    prefersReducedMotion: prefersReducedMotion(),
    isLowMemory: isLowMemoryDevice(),
    isSlowConnection: isSlowConnection(),
    supportsWebGL: supportsFeature('webgl'),
    supportsWebP: supportsFeature('webp'),
    supportsBackdropFilter: supportsFeature('backdropFilter'),
    supportsIntersectionObserver: supportsFeature('intersectionObserver'),
    supportsResizeObserver: supportsFeature('resizeObserver')
  };
};

// Optimize CSS classes based on device capabilities
export const getOptimizedClasses = (baseClasses, mobileClasses = '', lowPerformanceClasses = '') => {
  if (isLowMemoryDevice()) {
    return `${baseClasses} ${lowPerformanceClasses}`.trim();
  }
  if (isMobile()) {
    return `${baseClasses} ${mobileClasses}`.trim();
  }
  return baseClasses;
}; 