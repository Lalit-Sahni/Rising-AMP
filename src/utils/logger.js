/**
 * Development Logger Utility
 * 
 * This utility provides controlled logging that:
 * - Only logs in development mode
 * - Can be easily disabled for production
 * - Provides consistent logging format
 * - Replaces console.log statements for better security
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isDebugMode = process.env.REACT_APP_DEBUG === 'true';

/**
 * Logger class for controlled logging
 */
class Logger {
  constructor() {
    this.enabled = isDevelopment || isDebugMode;
    this.prefix = '[Rising-AMP]';
  }

  /**
   * Log info messages
   */
  info(message, ...args) {
    if (this.enabled) {
      console.log(`${this.prefix} ℹ️  ${message}`, ...args);
    }
  }

  /**
   * Log success messages
   */
  success(message, ...args) {
    if (this.enabled) {
      console.log(`${this.prefix} ✅ ${message}`, ...args);
    }
  }

  /**
   * Log warning messages
   */
  warn(message, ...args) {
    if (this.enabled) {
      console.warn(`${this.prefix} ⚠️  ${message}`, ...args);
    }
  }

  /**
   * Log error messages
   */
  error(message, ...args) {
    if (this.enabled) {
      console.error(`${this.prefix} ❌ ${message}`, ...args);
    }
  }

  /**
   * Log debug messages (only in debug mode)
   */
  debug(message, ...args) {
    if (this.enabled && isDebugMode) {
      console.log(`${this.prefix} 🐛 ${message}`, ...args);
    }
  }

  /**
   * Log Firebase operations
   */
  firebase(operation, message, ...args) {
    if (this.enabled) {
      console.log(`${this.prefix} 🔥 [${operation}] ${message}`, ...args);
    }
  }

  /**
   * Log OCR operations
   */
  ocr(operation, message, ...args) {
    if (this.enabled) {
      console.log(`${this.prefix} 👁️  [${operation}] ${message}`, ...args);
    }
  }

  /**
   * Log expense operations
   */
  expense(operation, message, ...args) {
    if (this.enabled) {
      console.log(`${this.prefix} 💰 [${operation}] ${message}`, ...args);
    }
  }

  /**
   * Log authentication operations
   */
  auth(operation, message, ...args) {
    if (this.enabled) {
      console.log(`${this.prefix} 🔐 [${operation}] ${message}`, ...args);
    }
  }

  /**
   * Log performance metrics
   */
  performance(operation, duration, ...args) {
    if (this.enabled) {
      console.log(`${this.prefix} ⏱️  [${operation}] ${duration}ms`, ...args);
    }
  }

  /**
   * Group related logs
   */
  group(label, callback) {
    if (this.enabled) {
      console.group(`${this.prefix} 📁 ${label}`);
      callback();
      console.groupEnd();
    }
  }

  /**
   * Log table data
   */
  table(data, label = 'Data') {
    if (this.enabled) {
      console.log(`${this.prefix} 📊 ${label}:`);
      console.table(data);
    }
  }

  /**
   * Log object with proper formatting
   */
  object(obj, label = 'Object') {
    if (this.enabled) {
      console.log(`${this.prefix} 📦 ${label}:`);
      console.log(JSON.stringify(obj, null, 2));
    }
  }
}

// Create singleton instance
const logger = new Logger();

// Export both the class and instance
export default logger;
export { Logger };

// Convenience functions for common operations
export const logInfo = (message, ...args) => logger.info(message, ...args);
export const logSuccess = (message, ...args) => logger.success(message, ...args);
export const logWarn = (message, ...args) => logger.warn(message, ...args);
export const logError = (message, ...args) => logger.error(message, ...args);
export const logDebug = (message, ...args) => logger.debug(message, ...args);
export const logFirebase = (operation, message, ...args) => logger.firebase(operation, message, ...args);
export const logOCR = (operation, message, ...args) => logger.ocr(operation, message, ...args);
export const logExpense = (operation, message, ...args) => logger.expense(operation, message, ...args);
export const logAuth = (operation, message, ...args) => logger.auth(operation, message, ...args);
export const logPerformance = (operation, duration, ...args) => logger.performance(operation, duration, ...args);
