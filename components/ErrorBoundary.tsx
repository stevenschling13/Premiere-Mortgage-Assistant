import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  private handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900 px-4 animate-fade-in">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-xl text-center">
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="text-red-500" size={24} />
              </div>
            </div>
            
            <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-sm text-slate-600 mb-6">
              We encountered an unexpected error.
            </p>

            {this.state.error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-left overflow-hidden">
                <details className="text-xs text-red-800">
                  <summary className="font-bold cursor-pointer mb-1 outline-none focus:text-red-900">
                    Error Details
                  </summary>
                  <pre className="whitespace-pre-wrap font-mono mt-2 text-red-600 bg-red-50/50 p-2 rounded">
                    {this.state.error.toString()}
                  </pre>
                  {this.state.errorInfo && (
                     <pre className="whitespace-pre-wrap font-mono mt-2 text-red-500 opacity-75 text-[10px] p-2">
                       {this.state.errorInfo.componentStack}
                     </pre>
                  )}
                </details>
              </div>
            )}

            <button
              type="button"
              onClick={this.handleReset}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand-red hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-red focus-visible:ring-offset-white px-4 py-2.5 text-sm font-bold text-white transition-all shadow-sm active:scale-95"
            >
              <RefreshCw size={16} />
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;