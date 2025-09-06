import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Error boundary component for AccountSelector
 * Provides graceful error handling and recovery options
 */
class AccountSelectorErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0 
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    console.error('AccountSelector Error Boundary caught an error:', error, errorInfo);
    
    // Update state with error info
    this.setState({
      error,
      errorInfo
    });

    // Send error to monitoring service (if available)
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'exception', {
        description: `AccountSelector Error: ${error.message}`,
        fatal: false
      });
    }
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom error UI
      return (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-start space-x-3">
            <AlertTriangle size={20} className="text-red-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-red-300 font-medium">
                Account Selection Error
              </div>
              <div className="text-red-400/70 text-sm mt-1">
                Unable to load account options. This might be due to invalid data or a temporary issue.
              </div>
              
              {/* Error details in development */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-3 text-xs text-red-400/60">
                  <summary className="cursor-pointer hover:text-red-400/80">
                    Error Details (Development)
                  </summary>
                  <div className="mt-2 p-2 bg-red-500/5 rounded border border-red-500/20">
                    <div className="font-mono text-xs">
                      <div><strong>Error:</strong> {this.state.error.message}</div>
                      {this.state.errorInfo && (
                        <div className="mt-1">
                          <strong>Component Stack:</strong>
                          <pre className="whitespace-pre-wrap text-xs mt-1">
                            {this.state.errorInfo.componentStack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </details>
              )}
              
              {/* Action buttons */}
              <div className="flex space-x-2 mt-3">
                <button
                  onClick={this.handleRetry}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs bg-red-500/20 text-red-300 rounded-md hover:bg-red-500/30 transition-colors"
                >
                  <RefreshCw size={12} />
                  <span>Retry</span>
                </button>
                
                {this.state.retryCount > 0 && (
                  <button
                    onClick={this.handleReset}
                    className="px-3 py-1.5 text-xs bg-gray-500/20 text-gray-300 rounded-md hover:bg-gray-500/30 transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
              
              {/* Retry count indicator */}
              {this.state.retryCount > 0 && (
                <div className="text-xs text-red-400/60 mt-2">
                  Retry attempts: {this.state.retryCount}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // If no error, render children normally
    return this.props.children;
  }
}

export default AccountSelectorErrorBoundary;
