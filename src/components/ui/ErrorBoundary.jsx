import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    if (import.meta.env.DEV) {
      console.error('Error Boundary caught an error:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
          <div className="bg-surface border border-hairline rounded-ot p-8 max-w-md w-full text-center space-y-4 shadow-whisper">
            <div>
              <h2 className="text-[18px] font-extrabold text-ink mb-2">
                Something went wrong
              </h2>
              <p className="text-[13.5px] text-slate-600">
                Something unexpected happened. Refresh the page and try again.
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-accent hover:bg-accent-600 text-white font-bold py-2.5 px-4 rounded-ot-sm transition-colors"
              >
                Refresh page
              </button>

              <button
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                className="w-full border border-hairline hover:bg-canvas text-ink font-semibold py-2.5 px-4 rounded-ot-sm transition-colors"
              >
                Try again
              </button>
            </div>

            {import.meta.env.DEV && this.state.error && (
              <details className="text-left">
                <summary className="text-slate-400 text-sm cursor-pointer hover:text-ink">
                  Error details (development)
                </summary>
                <div className="mt-2 p-3 bg-canvas border border-hairline rounded-ot-sm text-xs text-neg overflow-auto max-h-32">
                  <div className="font-semibold mb-1">Error:</div>
                  <div className="mb-2">{this.state.error.toString()}</div>
                  <div className="font-semibold mb-1">Stack trace:</div>
                  <div>{this.state.errorInfo.componentStack}</div>
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

export default ErrorBoundary;
