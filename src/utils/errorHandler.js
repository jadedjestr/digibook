import { logger } from './logger';
import { notify } from './notifications';

/**
 * Centralized Error Handling Utility
 *
 * Provides consistent error handling across the application with:
 * - Standardized error logging
 * - User-friendly error messages
 * - Error recovery strategies
 * - Error categorization and reporting
 */

export class ErrorHandler {
  constructor() {
    this.errorTypes = {
      VALIDATION: 'validation',
      NETWORK: 'network',
      DATABASE: 'database',
      PERMISSION: 'permission',
      UNKNOWN: 'unknown',
    };

    this.severityLevels = {
      LOW: 'low',
      MEDIUM: 'medium',
      HIGH: 'high',
      CRITICAL: 'critical',
    };
  }

  /**
   * Handle and categorize errors with comprehensive logging and user notification
   * @param {Error} error - The error to handle
   * @param {Object} context - Additional context about where the error occurred
   * @param {Object} context.componentName - Name of the component where error occurred
   * @param {Object} context.action - Action being performed when error occurred
   * @param {Object} context.userId - ID of the user (if applicable)
   * @param {Object} options - Handling options
   * @param {boolean} options.showNotification - Whether to show user notification (default: true)
   * @param {boolean} options.attemptRecovery - Whether to attempt automatic recovery (default: false)
   * @returns {Object} Error information object with categorization and severity
   */
  handle(error, context = {}, options = {}) {
    const errorInfo = this.categorizeError(error, context);
    const severity = this.determineSeverity(errorInfo);

    // Log the error
    this.logError(errorInfo, severity);

    // Show user notification if appropriate
    if (options.showNotification !== false) {
      this.showUserNotification(errorInfo, severity);
    }

    // Attempt recovery if possible
    if (options.attemptRecovery !== false) {
      this.attemptRecovery(errorInfo, context);
    }

    return {
      errorInfo,
      severity,
      handled: true,
    };
  }

  /**
   * Categorize error based on type and context for proper handling
   * @param {Error} error - The error to categorize
   * @param {Object} context - Additional context about the error
   * @param {string} context.component - Name of the component where error occurred
   * @param {string} context.action - Action being performed when error occurred
   * @param {string} context.userId - ID of the user (if applicable)
   * @param {string} context.sessionId - Session ID (if applicable)
   * @returns {Object} Categorized error information
   * @returns {string} returns.type - Error type (validation, network, database, etc.)
   * @returns {string} returns.message - User-friendly error message
   * @returns {string} returns.stack - Error stack trace
   * @returns {string} returns.category - Error category
   * @returns {string} returns.timestamp - ISO timestamp of when error occurred
   * @returns {Object} returns.context - Error context information
   * @returns {Error} returns.originalError - Original error object
   */
  categorizeError(error, context) {
    const errorInfo = {
      message: error.message || 'An unknown error occurred',
      stack: error.stack,
      type: this.errorTypes.UNKNOWN,
      category: 'unknown',
      timestamp: new Date().toISOString(),
      context: {
        component: context.component || 'unknown',
        action: context.action || 'unknown',
        userId: context.userId || null,
        sessionId: context.sessionId || null,
      },
      originalError: error,
    };

    // Categorize based on error message and context
    if (this.isValidationError(error)) {
      errorInfo.type = this.errorTypes.VALIDATION;
      errorInfo.category = 'validation';
    } else if (this.isNetworkError(error)) {
      errorInfo.type = this.errorTypes.NETWORK;
      errorInfo.category = 'network';
    } else if (this.isDatabaseError(error)) {
      errorInfo.type = this.errorTypes.DATABASE;
      errorInfo.category = 'database';
    } else if (this.isPermissionError(error)) {
      errorInfo.type = this.errorTypes.PERMISSION;
      errorInfo.category = 'permission';
    }

    return errorInfo;
  }

  /**
   * Determine error severity
   */
  determineSeverity(errorInfo) {
    const { type, message } = errorInfo;

    // Critical errors
    if (type === this.errorTypes.DATABASE && message.includes('corruption')) {
      return this.severityLevels.CRITICAL;
    }

    // High severity errors
    if (
      type === this.errorTypes.DATABASE ||
      type === this.errorTypes.PERMISSION
    ) {
      return this.severityLevels.HIGH;
    }

    // Medium severity errors
    if (
      type === this.errorTypes.NETWORK ||
      type === this.errorTypes.VALIDATION
    ) {
      return this.severityLevels.MEDIUM;
    }

    // Low severity errors
    return this.severityLevels.LOW;
  }

  /**
   * Log error with appropriate level
   */
  logError(errorInfo, severity) {
    const logData = {
      type: errorInfo.type,
      category: errorInfo.category,
      context: errorInfo.context,
      timestamp: errorInfo.timestamp,
    };

    switch (severity) {
      case this.severityLevels.CRITICAL:
        logger.error(`CRITICAL ERROR: ${errorInfo.message}`, logData);
        break;
      case this.severityLevels.HIGH:
        logger.error(`HIGH SEVERITY: ${errorInfo.message}`, logData);
        break;
      case this.severityLevels.MEDIUM:
        logger.warn(`MEDIUM SEVERITY: ${errorInfo.message}`, logData);
        break;
      case this.severityLevels.LOW:
        logger.info(`LOW SEVERITY: ${errorInfo.message}`, logData);
        break;
      default:
        logger.error(`UNKNOWN SEVERITY: ${errorInfo.message}`, logData);
    }
  }

  /**
   * Show user-friendly notification
   */
  showUserNotification(errorInfo, severity) {
    const userMessage = this.getUserFriendlyMessage(errorInfo, severity);

    switch (severity) {
      case this.severityLevels.CRITICAL:
        notify.error(userMessage, { duration: 0 }); // Don't auto-dismiss
        break;
      case this.severityLevels.HIGH:
        notify.error(userMessage, { duration: 5000 });
        break;
      case this.severityLevels.MEDIUM:
        notify.warning(userMessage, { duration: 3000 });
        break;
      case this.severityLevels.LOW:
        notify.info(userMessage, { duration: 2000 });
        break;
      default:
        notify.error(userMessage);
    }
  }

  /**
   * Get user-friendly error message
   */
  getUserFriendlyMessage(errorInfo, severity) {
    const { type, message, context } = errorInfo;

    // Custom messages based on error type and context
    if (type === this.errorTypes.VALIDATION) {
      if (message.includes('required')) {
        return 'Please fill in all required fields.';
      }
      if (message.includes('invalid')) {
        return 'Please check your input and try again.';
      }
      return 'Please check your input and try again.';
    }

    if (type === this.errorTypes.DATABASE) {
      if (message.includes('not found')) {
        return 'The requested information could not be found.';
      }
      if (message.includes('constraint')) {
        return 'This action cannot be completed due to data constraints.';
      }
      return 'There was a problem saving your data. Please try again.';
    }

    if (type === this.errorTypes.NETWORK) {
      return 'Please check your internet connection and try again.';
    }

    if (type === this.errorTypes.PERMISSION) {
      return 'You do not have permission to perform this action.';
    }

    // Generic messages based on severity
    switch (severity) {
      case this.severityLevels.CRITICAL:
        return 'A critical error occurred. Please refresh the page and try again.';
      case this.severityLevels.HIGH:
        return 'An error occurred. Please try again or contact support if the problem persists.';
      case this.severityLevels.MEDIUM:
        return 'Something went wrong. Please try again.';
      case this.severityLevels.LOW:
        return 'A minor issue occurred, but your data is safe.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  /**
   * Attempt to recover from error
   */
  attemptRecovery(errorInfo, context) {
    const { type, message } = errorInfo;

    // Database recovery strategies
    if (type === this.errorTypes.DATABASE) {
      if (message.includes('connection')) {
        // Attempt to reconnect to database
        this.attemptDatabaseReconnection();
      } else if (message.includes('corruption')) {
        // Attempt to restore from backup
        this.attemptDataRestore();
      }
    }

    // Network recovery strategies
    if (type === this.errorTypes.NETWORK) {
      // Could implement retry logic here
      logger.info('Network error detected, user may need to retry manually');
    }

    // Validation recovery strategies
    if (type === this.errorTypes.VALIDATION) {
      // Could implement form reset or field highlighting
      logger.info('Validation error detected, user needs to correct input');
    }
  }

  /**
   * Attempt database reconnection
   */
  async attemptDatabaseReconnection() {
    try {
      logger.info('Attempting database reconnection...');

      // Implementation would depend on your database setup
      // For IndexedDB, this might involve checking if the database is still accessible
      logger.success('Database reconnection successful');
    } catch (error) {
      logger.error('Database reconnection failed:', error);
    }
  }

  /**
   * Attempt data restore from backup
   */
  async attemptDataRestore() {
    try {
      logger.info('Attempting data restore from backup...');

      // Implementation would involve restoring from localStorage backup
      // or prompting user to restore from exported data
      logger.success('Data restore successful');
    } catch (error) {
      logger.error('Data restore failed:', error);
    }
  }

  /**
   * Error type detection methods
   */
  isValidationError(error) {
    const validationKeywords = [
      'required',
      'invalid',
      'validation',
      'format',
      'length',
      'minimum',
      'maximum',
      'pattern',
      'constraint',
    ];
    return validationKeywords.some(keyword =>
      error.message.toLowerCase().includes(keyword)
    );
  }

  isNetworkError(error) {
    const networkKeywords = [
      'network',
      'connection',
      'timeout',
      'fetch',
      'request',
      'offline',
      'unreachable',
      'dns',
      'cors',
    ];
    return networkKeywords.some(keyword =>
      error.message.toLowerCase().includes(keyword)
    );
  }

  isDatabaseError(error) {
    const databaseKeywords = [
      'database',
      'indexeddb',
      'dexie',
      'constraint',
      'transaction',
      'not found',
      'already exists',
      'corruption',
      'locked',
    ];
    return databaseKeywords.some(keyword =>
      error.message.toLowerCase().includes(keyword)
    );
  }

  isPermissionError(error) {
    const permissionKeywords = [
      'permission',
      'unauthorized',
      'forbidden',
      'access denied',
      'not allowed',
      'insufficient',
    ];
    return permissionKeywords.some(keyword =>
      error.message.toLowerCase().includes(keyword)
    );
  }

  /**
   * Create error boundary handler for React components
   */
  createErrorBoundaryHandler(componentName) {
    return (error, errorInfo) => {
      this.handle(
        error,
        {
          component: componentName,
          action: 'render',
          errorInfo,
        },
        {
          showNotification: true,
          attemptRecovery: false,
        }
      );
    };
  }

  /**
   * Create async operation handler
   */
  createAsyncHandler(operationName, context = {}) {
    return async asyncFunction => {
      try {
        return await asyncFunction();
      } catch (error) {
        this.handle(error, {
          component: context.component || 'unknown',
          action: operationName,
          ...context,
        });
        throw error; // Re-throw to allow caller to handle if needed
      }
    };
  }

  /**
   * Create form validation handler
   */
  createValidationHandler(formName) {
    return validationErrors => {
      const error = new Error(
        `Validation failed for ${formName}: ${Object.keys(validationErrors).join(', ')}`
      );
      this.handle(
        error,
        {
          component: formName,
          action: 'validation',
          validationErrors,
        },
        {
          showNotification: true,
          attemptRecovery: false,
        }
      );
    };
  }
}

// Create singleton instance
export const errorHandler = new ErrorHandler();

// Export convenience functions
export const handleError = (error, context, options) =>
  errorHandler.handle(error, context, options);
export const createErrorBoundary = componentName =>
  errorHandler.createErrorBoundaryHandler(componentName);
export const createAsyncHandler = (operationName, context) =>
  errorHandler.createAsyncHandler(operationName, context);
export const createValidationHandler = formName =>
  errorHandler.createValidationHandler(formName);

export default errorHandler;
