/**
 * Centralized logging utility for Digibook
 * Handles different environments and log levels appropriately
 */

const isDevelopment = process.env.NODE_ENV === 'development';

class Logger {
  /**
   * Debug logging - only in development
   */
  debug(message, data = null) {
    if (isDevelopment) {
      if (data) {
        console.log(`[DEBUG] ${message}`, data);
      } else {
        console.log(`[DEBUG] ${message}`);
      }
    }
  }

  /**
   * Info logging - always logged
   */
  info(message, data = null) {
    if (data) {
      console.info(`[INFO] ${message}`, data);
    } else {
      console.info(`[INFO] ${message}`);
    }
  }

  /**
   * Warning logging - always logged
   */
  warn(message, data = null) {
    if (data) {
      console.warn(`[WARN] ${message}`, data);
    } else {
      console.warn(`[WARN] ${message}`);
    }
  }

  /**
   * Error logging - always logged, could be sent to error tracking service
   */
  error(message, error = null) {
    if (error) {
      console.error(`[ERROR] ${message}`, error);
    } else {
      console.error(`[ERROR] ${message}`);
    }

    // TODO: In production, could send to error tracking service like Sentry
    // if (!isDevelopment && error) {
    //   // Send to error tracking service
    // }
  }

  /**
   * Success logging - only in development
   */
  success(message, data = null) {
    if (isDevelopment) {
      if (data) {
        console.log(`[SUCCESS] ${message}`, data);
      } else {
        console.log(`[SUCCESS] ${message}`);
      }
    }
  }

  /**
   * Database operations logging - only in development
   */
  db(operation, details = null) {
    if (isDevelopment) {
      if (details) {
        console.log(`[DB] ${operation}`, details);
      } else {
        console.log(`[DB] ${operation}`);
      }
    }
  }

  /**
   * Component lifecycle logging - only in development
   */
  component(componentName, action, data = null) {
    if (isDevelopment) {
      if (data) {
        console.log(`[${componentName}] ${action}`, data);
      } else {
        console.log(`[${componentName}] ${action}`);
      }
    }
  }
}

// Create singleton instance
export const logger = new Logger();

// Export individual methods for convenience
export const { debug, info, warn, error, success, db, component } = logger;
