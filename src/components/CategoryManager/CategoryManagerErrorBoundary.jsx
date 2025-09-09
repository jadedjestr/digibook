import { AlertTriangle, RefreshCw } from 'lucide-react';
import React from 'react';

class CategoryManagerErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console for debugging
    console.error('CategoryManager Error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className='glass-panel border border-red-500/20 p-6 text-center'>
          <div className='flex flex-col items-center space-y-4'>
            <AlertTriangle size={48} className='text-red-400' />
            <div>
              <h3 className='text-lg font-semibold text-red-300 mb-2'>
                Category Manager Error
              </h3>
              <p className='text-white/70 mb-4'>
                Something went wrong with the category manager. This might be
                due to a data corruption or network issue.
              </p>
              <button
                onClick={this.handleRetry}
                className='glass-button bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 flex items-center space-x-2 mx-auto'
              >
                <RefreshCw size={16} />
                <span>Retry</span>
              </button>
            </div>

            {/* Show error details in development */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className='mt-4 text-left w-full'>
                <summary className='cursor-pointer text-sm text-white/60 hover:text-white/80'>
                  Error Details (Development)
                </summary>
                <div className='mt-2 p-3 bg-red-900/20 rounded border border-red-500/20'>
                  <pre className='text-xs text-red-300 whitespace-pre-wrap overflow-auto max-h-32'>
                    {this.state.error && this.state.error.toString()}
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default CategoryManagerErrorBoundary;
