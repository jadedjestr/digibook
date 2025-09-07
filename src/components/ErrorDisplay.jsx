import React from 'react';
import { AlertTriangle, RefreshCw, Home, Bug, X } from 'lucide-react';

/**
 * Consistent Error Display Components
 * 
 * Provides standardized error UI components for different error scenarios
 * with consistent styling and user-friendly messaging.
 */

// Error severity levels
export const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// Error types
export const ERROR_TYPE = {
  VALIDATION: 'validation',
  NETWORK: 'network',
  DATABASE: 'database',
  PERMISSION: 'permission',
  UNKNOWN: 'unknown'
};

/**
 * Base Error Display Component
 */
export const ErrorDisplay = ({ 
  title, 
  message, 
  severity = ERROR_SEVERITY.MEDIUM, 
  type = ERROR_TYPE.UNKNOWN,
  onRetry,
  onDismiss,
  showDetails = false,
  details,
  className = ''
}) => {
  const getSeverityStyles = () => {
    switch (severity) {
      case ERROR_SEVERITY.CRITICAL:
        return {
          container: 'bg-red-500/10 border-red-500/30 text-red-300',
          icon: 'text-red-400',
          title: 'text-red-200',
          message: 'text-red-300/80'
        };
      case ERROR_SEVERITY.HIGH:
        return {
          container: 'bg-orange-500/10 border-orange-500/30 text-orange-300',
          icon: 'text-orange-400',
          title: 'text-orange-200',
          message: 'text-orange-300/80'
        };
      case ERROR_SEVERITY.MEDIUM:
        return {
          container: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
          icon: 'text-yellow-400',
          title: 'text-yellow-200',
          message: 'text-yellow-300/80'
        };
      case ERROR_SEVERITY.LOW:
        return {
          container: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
          icon: 'text-blue-400',
          title: 'text-blue-200',
          message: 'text-blue-300/80'
        };
      default:
        return {
          container: 'bg-gray-500/10 border-gray-500/30 text-gray-300',
          icon: 'text-gray-400',
          title: 'text-gray-200',
          message: 'text-gray-300/80'
        };
    }
  };

  const getIcon = () => {
    switch (type) {
      case ERROR_TYPE.NETWORK:
        return <RefreshCw size={20} className="animate-spin" />;
      case ERROR_TYPE.DATABASE:
        return <Bug size={20} />;
      case ERROR_TYPE.VALIDATION:
        return <AlertTriangle size={20} />;
      default:
        return <AlertTriangle size={20} />;
    }
  };

  const styles = getSeverityStyles();

  return (
    <div className={`glass-panel border ${styles.container} ${className}`}>
      <div className="flex items-start space-x-3">
        <div className={`flex-shrink-0 ${styles.icon}`}>
          {getIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-medium ${styles.title}`}>
            {title}
          </h3>
          <p className={`mt-1 text-sm ${styles.message}`}>
            {message}
          </p>
          
          {showDetails && details && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs opacity-75 hover:opacity-100">
                Technical Details
              </summary>
              <pre className="mt-2 text-xs bg-black/20 p-2 rounded overflow-auto max-h-32">
                {typeof details === 'string' ? details : JSON.stringify(details, null, 2)}
              </pre>
            </details>
          )}
          
          {(onRetry || onDismiss) && (
            <div className="mt-3 flex space-x-2">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <RefreshCw size={12} className="mr-1" />
                  Try Again
                </button>
              )}
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>
        
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 p-1 hover:bg-white/10 rounded transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Validation Error Display
 */
export const ValidationError = ({ 
  errors, 
  onRetry, 
  onDismiss,
  className = '' 
}) => {
  const errorCount = Object.keys(errors).length;
  const errorMessages = Object.values(errors).filter(Boolean);

  return (
    <ErrorDisplay
      title="Please fix the following errors:"
      message={errorMessages.length > 0 ? errorMessages.join(', ') : 'Please check your input and try again.'}
      severity={ERROR_SEVERITY.MEDIUM}
      type={ERROR_TYPE.VALIDATION}
      onRetry={onRetry}
      onDismiss={onDismiss}
      showDetails={errorCount > 3}
      details={errors}
      className={className}
    />
  );
};

/**
 * Network Error Display
 */
export const NetworkError = ({ 
  message = 'Unable to connect. Please check your internet connection.',
  onRetry,
  onDismiss,
  className = '' 
}) => {
  return (
    <ErrorDisplay
      title="Connection Error"
      message={message}
      severity={ERROR_SEVERITY.MEDIUM}
      type={ERROR_TYPE.NETWORK}
      onRetry={onRetry}
      onDismiss={onDismiss}
      className={className}
    />
  );
};

/**
 * Database Error Display
 */
export const DatabaseError = ({ 
  message = 'There was a problem accessing your data.',
  onRetry,
  onDismiss,
  showDetails = false,
  details,
  className = '' 
}) => {
  return (
    <ErrorDisplay
      title="Data Error"
      message={message}
      severity={ERROR_SEVERITY.HIGH}
      type={ERROR_TYPE.DATABASE}
      onRetry={onRetry}
      onDismiss={onDismiss}
      showDetails={showDetails}
      details={details}
      className={className}
    />
  );
};

/**
 * Permission Error Display
 */
export const PermissionError = ({ 
  message = 'You do not have permission to perform this action.',
  onRetry,
  onDismiss,
  className = '' 
}) => {
  return (
    <ErrorDisplay
      title="Access Denied"
      message={message}
      severity={ERROR_SEVERITY.HIGH}
      type={ERROR_TYPE.PERMISSION}
      onRetry={onRetry}
      onDismiss={onDismiss}
      className={className}
    />
  );
};

/**
 * Critical Error Display
 */
export const CriticalError = ({ 
  title = "Critical Error",
  message = "A critical error occurred. Please refresh the page and try again.",
  onRetry,
  onDismiss,
  showDetails = true,
  details,
  className = '' 
}) => {
  return (
    <ErrorDisplay
      title={title}
      message={message}
      severity={ERROR_SEVERITY.CRITICAL}
      type={ERROR_TYPE.UNKNOWN}
      onRetry={onRetry}
      onDismiss={onDismiss}
      showDetails={showDetails}
      details={details}
      className={className}
    />
  );
};

/**
 * Loading Error Display
 */
export const LoadingError = ({ 
  message = "Failed to load data. Please try again.",
  onRetry,
  onDismiss,
  className = '' 
}) => {
  return (
    <ErrorDisplay
      title="Loading Error"
      message={message}
      severity={ERROR_SEVERITY.MEDIUM}
      type={ERROR_TYPE.UNKNOWN}
      onRetry={onRetry}
      onDismiss={onDismiss}
      className={className}
    />
  );
};

/**
 * Form Error Display
 */
export const FormError = ({ 
  errors,
  onRetry,
  onDismiss,
  className = '' 
}) => {
  if (!errors || Object.keys(errors).length === 0) {
    return null;
  }

  return (
    <ValidationError
      errors={errors}
      onRetry={onRetry}
      onDismiss={onDismiss}
      className={className}
    />
  );
};

/**
 * Inline Error Display (for form fields)
 */
export const InlineError = ({ 
  message, 
  className = '' 
}) => {
  if (!message) return null;

  return (
    <p className={`mt-1 text-sm text-red-400 ${className}`}>
      {message}
    </p>
  );
};

/**
 * Error Summary Component
 */
export const ErrorSummary = ({ 
  errors,
  onRetry,
  onDismiss,
  className = '' 
}) => {
  if (!errors || errors.length === 0) {
    return null;
  }

  const criticalErrors = errors.filter(e => e.severity === ERROR_SEVERITY.CRITICAL);
  const highErrors = errors.filter(e => e.severity === ERROR_SEVERITY.HIGH);
  const mediumErrors = errors.filter(e => e.severity === ERROR_SEVERITY.MEDIUM);
  const lowErrors = errors.filter(e => e.severity === ERROR_SEVERITY.LOW);

  return (
    <div className={`space-y-3 ${className}`}>
      {criticalErrors.map((error, index) => (
        <CriticalError
          key={`critical-${index}`}
          title={error.title}
          message={error.message}
          onRetry={onRetry}
          onDismiss={onDismiss}
          details={error.details}
        />
      ))}
      
      {highErrors.map((error, index) => (
        <DatabaseError
          key={`high-${index}`}
          message={error.message}
          onRetry={onRetry}
          onDismiss={onDismiss}
          details={error.details}
        />
      ))}
      
      {mediumErrors.map((error, index) => (
        <ErrorDisplay
          key={`medium-${index}`}
          title={error.title}
          message={error.message}
          severity={ERROR_SEVERITY.MEDIUM}
          onRetry={onRetry}
          onDismiss={onDismiss}
        />
      ))}
      
      {lowErrors.map((error, index) => (
        <ErrorDisplay
          key={`low-${index}`}
          title={error.title}
          message={error.message}
          severity={ERROR_SEVERITY.LOW}
          onRetry={onRetry}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
};

export default ErrorDisplay;
