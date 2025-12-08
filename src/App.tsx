import './polyfill';
import React, { useState, useCallback, useEffect, ReactNode } from 'react';
import { Sidebar } from './components/Sidebar';
import { Calculator } from './components/Calculator';
import { ClientManager } from './components/ClientManager';
import { Assistant } from './components/Assistant';
import { DtiAnalysis } from './components/DtiAnalysis';
import { RatesNotes } from './components/RatesNotes';
import { MarketingStudio } from './components/MarketInsights';
import { CompensationTracker } from './components/CompensationTracker';
import { ToastContainer, ToastContext } from './components/Toast';
import { AppView, ToastMessage, ToastType } from './types';
import { Menu, Building2, Loader2, AlertTriangle, RefreshCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

// Error Boundary Implementation
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };
  // Explicitly defining props to satisfy strict type checking if React types are failing inference
  public readonly props: Readonly<ErrorBoundaryProps>;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.group("ErrorBoundary Caught Error");
    console.error("Error Message:", error.message);
    console.error("Component Stack Trace:\n", errorInfo.componentStack);
    console.groupEnd();
  }

  handleReset = () => {
      if(confirm('This will clear all local data and reload. Are you sure?')) {
          localStorage.clear();
          window.location.reload();
      }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-gray-50 text-center p-6 animate-fade-in">
          <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-gray-100">
            <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Application Error</h2>
            <p className="text-gray-500 mb-6 text-sm">
                We encountered an unexpected issue. Please try reloading or resetting your local data.
            </p>
            {this.state.error && (
                <div className="bg-gray-100 p-3 rounded text-xs text-left mb-6 font-mono overflow-auto max-h-32 text-red-700">
                    {this.state.error.toString()}
                </div>
            )}
            <div className="flex flex-col gap-3">
                <button 
                onClick={() => window.location.reload()}
                className="w-full px-4 py-3 bg-brand-dark text-white rounded-lg hover:bg-gray-800 transition-colors font-medium flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-brand-dark"
                >
                <RefreshCcw size={16} className="mr-2"/> Reload Application
                </button>
                <button 
                onClick={this.handleReset}
                className="w-full px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-300"
                >
                Reset & Clear Data
                </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// API Key Gate Component
const ApiKeyGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      try {
        if ((window as any).aistudio?.hasSelectedApiKey) {
          const selected = await (window as any).aistudio.hasSelectedApiKey();
          setHasKey(selected);
        } else {
          // Fallback for environments where the helper isn't injected
          setHasKey(true); 
        }
      } catch (e) {
        console.warn("Failed to check API key status", e);
        setHasKey(true); // Fail open to allow app usage if check fails
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    try {
        if ((window as any).aistudio?.openSelectKey) {
            await (window as any).aistudio.openSelectKey();
            setHasKey(true); 
        } else {
            setHasKey(true);
        }
    } catch (e) {
        console.error("Error selecting key", e);
    }
  };

  if (hasKey === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-brand-red" />
      </div>
    );
  }

  if (hasKey === false) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4 animate-fade-in">
        <div className="max-w-md text-center">
          <div className="bg-brand-dark/50 p-4 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-8 border border-white/10 shadow-xl">
             <Building2 className="w-12 h-12 text-brand-gold" />
          </div>
          <h1 className="text-3xl font-bold mb-3 tracking-tight">Premiere Mortgage Assistant</h1>
          <p className="text-gray-400 mb-8 leading-relaxed text-sm">
            To access the AI-powered features (Gemini 3 Pro, Imagen, Veo), please connect a billing-enabled Google Cloud Project API Key.
          </p>
          <button 
            onClick={handleSelectKey}
            className="bg-brand-red hover:bg-red-700 text-white font-bold py-3.5 px-8 rounded-full shadow-lg transition-transform active:scale-95 flex items-center mx-auto focus:outline-none focus:ring-4 focus:ring-red-500/50"
          >
            Connect API Key
          </button>
          <div className="mt-10 pt-6 border-t border-white/5">
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              rel="noreferrer"
              className="text-xs text-gray-500 hover:text-white transition-colors flex items-center justify-center hover:underline focus:text-white focus:outline-none"
            >
              View Billing Documentation
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const renderContent = () => {
    switch (currentView) {
      case AppView.DASHBOARD:
        return <ClientManager />;
      case AppView.CALCULATOR:
        return <Calculator />;
      case AppView.DTI_ANALYSIS:
        return <DtiAnalysis />;
      case AppView.RATES_NOTES:
        return <RatesNotes />;
      case AppView.MARKETING:
        return <MarketingStudio />;
      case AppView.COMPENSATION:
        return <CompensationTracker />;
      case AppView.ASSISTANT:
        return <Assistant />;
      default:
        return <ClientManager />;
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      <div className="flex h-[100dvh] bg-slate-50 font-sans text-gray-900 overflow-hidden">
        <a 
          href="#main-content" 
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-brand-red focus:text-white focus:rounded-md focus:shadow-lg focus:outline-none"
        >
          Skip to main content
        </a>

        <ToastContainer toasts={toasts} removeToast={removeToast} />

        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm animate-fade-in"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <Sidebar 
          currentView={currentView} 
          onChangeView={(view) => {
            setCurrentView(view);
            setIsSidebarOpen(false);
          }} 
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <div className="flex-1 flex flex-col md:ml-64 h-full transition-all duration-300 w-full relative bg-gray-50/50">
          
          <div className="md:hidden bg-brand-dark text-white p-4 flex items-center justify-between shadow-md shrink-0 z-30 safe-top">
            <div className="flex items-center space-x-2">
              <Building2 className="w-6 h-6 text-brand-red" />
              <div>
                <span className="font-bold block leading-none">Private Bank</span>
                <span className="text-[10px] text-gray-400 block leading-none mt-0.5">Mortgage Division</span>
              </div>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-gray-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-white rounded-md"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>

          <main 
            id="main-content"
            className="flex-1 overflow-y-auto w-full relative scroll-smooth focus:outline-none"
            tabIndex={-1}
          >
            <ErrorBoundary>
              {renderContent()}
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </ToastContext.Provider>
  );
};

const App: React.FC = () => {
  return (
    <ApiKeyGate>
      <AppContent />
    </ApiKeyGate>
  );
};

export default App;