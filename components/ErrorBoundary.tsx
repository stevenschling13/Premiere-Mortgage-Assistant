import React, { ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Database, FileJson, Copy, Activity } from 'lucide-react';
import { errorService } from '../services/errorService';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Explicit props definition to satisfy strict TS checks if inherited props aren't picked up
  public readonly props: Readonly<ErrorBoundaryProps>;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
    this.state = { hasError: false };
  }

  public state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    errorService.log('ERROR', error.message, { componentStack: errorInfo.componentStack }, error);
  }

  handleReload = () => {
    window.location.reload();
  }

  handleSafeMode = () => {
    if(confirm('Safe Mode will clear your local caches and refresh. Your client data will be preserved if possible, but temporary settings may be lost. Continue?')) {
        // Clear non-essential items
        localStorage.removeItem('premiere_mortgage_market_data');
        localStorage.removeItem('premiere_mortgage_valuations');
        window.location.reload();
    }
  }

  handleCopyDiagnostics = () => {
      const logs = errorService.getLogs();
      const text = JSON.stringify(logs, null, 2);
      navigator.clipboard.writeText(text);
      alert('Diagnostic logs copied to clipboard.');
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-slate-900 text-white p-6 animate-fade-in font-sans">
          <div className="max-w-2xl w-full bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 relative overflow-hidden">
            
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500"></div>

            <div className="flex items-start gap-6">
                <div className="p-4 bg-red-500/10 rounded-full border border-red-500/20 shrink-0">
                    <AlertTriangle className="w-10 h-10 text-red-500" />
                </div>
                <div className="flex-1">
                    <h2 className="text-2xl font-bold text-white mb-2">System Interruption</h2>
                    <p className="text-slate-400 text-sm leading-relaxed mb-6">
                        The application encountered an unexpected critical error. A diagnostic report has been generated.
                    </p>
                    
                    {this.state.error && (
                        <div className="bg-slate-950 p-4 rounded-lg font-mono text-xs text-red-300 mb-6 border border-red-900/30 overflow-auto max-h-32 shadow-inner">
                            <span className="block mb-2 font-bold text-red-500 uppercase tracking-wider">Exception Trace:</span>
                            {this.state.error.toString()}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <button 
                            onClick={this.handleReload}
                            className="flex items-center justify-center px-4 py-3 bg-white text-slate-900 rounded-lg hover:bg-slate-200 transition-colors font-bold text-sm shadow-lg"
                        >
                            <RefreshCcw size={16} className="mr-2"/> Attempt Recovery
                        </button>
                        <button 
                            onClick={this.handleSafeMode}
                            className="flex items-center justify-center px-4 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors text-sm font-medium border border-slate-600"
                        >
                            <Database size={16} className="mr-2 text-orange-400"/> Safe Mode
                        </button>
                        <button 
                            onClick={this.handleCopyDiagnostics}
                            className="flex items-center justify-center px-4 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors text-sm font-medium border border-slate-600"
                        >
                            <Activity size={16} className="mr-2 text-blue-400"/> Copy Logs
                        </button>
                    </div>
                </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-700 flex justify-between items-center text-xs text-slate-500">
                <span>Error Code: 0xCRITICAL_RENDER_FAIL</span>
                <span>Session ID: {Date.now().toString(36).toUpperCase()}</span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}