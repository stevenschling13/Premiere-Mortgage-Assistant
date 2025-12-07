
import React, { useState, useCallback, Suspense, lazy, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { ToastContainer, ToastContext } from './components/Toast';
import { AppView, ToastMessage, ToastType } from './types';
import { Menu, Building2, Loader2, Sparkles, ShieldCheck, Clock3, ArrowRight } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';

// Lazy Load Components to improve initial render time
const ClientManager = lazy(() => import('./components/ClientManager').then(module => ({ default: module.ClientManager })));
const Calculator = lazy(() => import('./components/Calculator').then(module => ({ default: module.Calculator })));
const DtiAnalysis = lazy(() => import('./components/DtiAnalysis').then(module => ({ default: module.DtiAnalysis })));
const RatesNotes = lazy(() => import('./components/RatesNotes').then(module => ({ default: module.RatesNotes })));
const MarketingStudio = lazy(() => import('./components/MarketInsights').then(module => ({ default: module.MarketingStudio })));
const CompensationTracker = lazy(() => import('./components/CompensationTracker').then(module => ({ default: module.CompensationTracker })));
const Assistant = lazy(() => import('./components/Assistant').then(module => ({ default: module.Assistant })));
const Settings = lazy(() => import('./components/Settings').then(module => ({ default: module.Settings })));

const LoadingFallback = () => (
  <div className="flex flex-col items-center justify-center h-full text-gray-400">
    <Loader2 size={48} className="animate-spin mb-4 text-brand-red" />
    <p className="text-sm font-medium">Loading workspace...</p>
  </div>
);

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const viewMeta = useMemo(() => ({
    [AppView.DASHBOARD]: {
      title: 'Client Command Center',
      description: 'Pipeline visibility, follow-ups, and action items tuned for private banking.',
    },
    [AppView.MARKETING]: {
      title: 'Marketing Studio',
      description: 'Campaign intelligence, hyper-personalized messaging, and executive-ready briefs.',
    },
    [AppView.CALCULATOR]: {
      title: 'Jumbo Calculator',
      description: 'Precision pricing and loan structuring with enterprise-grade guardrails.',
    },
    [AppView.DTI_ANALYSIS]: {
      title: 'Affordability & DTI',
      description: 'Scenario modeling to keep ratios, reserves, and covenants compliant.',
    },
    [AppView.RATES_NOTES]: {
      title: 'Rates & Notes',
      description: 'Live rates, structured notes, and curated guidance for sophisticated clients.',
    },
    [AppView.COMPENSATION]: {
      title: 'Wealth & Performance',
      description: 'Comp tracking, fee visibility, and relationship profitability in one view.',
    },
    [AppView.ASSISTANT]: {
      title: 'AI Assistant',
      description: 'Context-aware copilots for prospecting, diligence, and white-glove service.',
    },
    [AppView.SETTINGS]: {
      title: 'Workspace Settings',
      description: 'Data governance, preferences, and integration controls.',
    },
  }), []);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const renderContent = () => {
    return (
      <Suspense fallback={<LoadingFallback />}>
        {(() => {
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
            case AppView.SETTINGS:
              return <Settings />;
            default:
              return <ClientManager />;
          }
        })()}
      </Suspense>
    );
  };

  return (
    <ErrorBoundary>
      <ToastContext.Provider value={{ showToast }}>
        <div className="flex h-screen bg-slate-50 font-sans text-gray-900 overflow-hidden">
          {/* Toast Container */}
          <ToastContainer toasts={toasts} removeToast={removeToast} />

          {/* Mobile Sidebar Overlay */}
          {isSidebarOpen && (
            <div 
              className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          {/* Sidebar Navigation */}
          <Sidebar 
            currentView={currentView} 
            onChangeView={(view) => {
              setCurrentView(view);
              setIsSidebarOpen(false);
            }} 
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
          />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col md:ml-64 h-screen transition-all duration-300 w-full relative bg-gray-50/50">

            {/* Mobile Header */}
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
                className="p-2 text-gray-300 hover:text-white focus:outline-none"
                aria-label="Toggle Menu"
              >
                <Menu className="w-6 h-6" />
              </button>
            </div>

            {/* Scrollable Main Content */}
            <main className="flex-1 overflow-y-auto w-full relative bg-gradient-to-br from-slate-50 via-white to-slate-100">
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-32 -left-20 w-72 h-72 bg-brand-red/10 blur-3xl rounded-full" />
                <div className="absolute top-10 right-0 w-96 h-96 bg-indigo-100/60 blur-3xl rounded-full" />
              </div>

              <div className="relative max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
                <div className="bg-white/80 backdrop-blur-xl border border-white/60 shadow-[0_10px_40px_-24px_rgba(15,23,42,0.35)] rounded-3xl p-5 md:p-7">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-brand-red font-semibold">
                        <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                        Trusted banker workspace
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">{viewMeta[currentView].title}</h1>
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <Sparkles className="w-4 h-4" aria-hidden="true" />
                            Gen AI ready
                          </span>
                        </div>
                        <p className="text-sm md:text-base text-slate-600 mt-1 max-w-3xl">{viewMeta[currentView].description}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <button
                        onClick={() => setCurrentView(AppView.ASSISTANT)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold shadow-lg shadow-slate-900/10 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 transition"
                      >
                        <Sparkles className="w-4 h-4" aria-hidden="true" />
                        Launch AI copilot
                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => setCurrentView(AppView.DASHBOARD)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-slate-800 text-sm font-semibold border border-slate-200 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red transition"
                      >
                        <Clock3 className="w-4 h-4" aria-hidden="true" />
                        Client follow-ups
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
                    {[{
                      label: 'Operational focus',
                      value: 'Digital-first with banker review',
                      tone: 'success'
                    }, {
                      label: 'Client SLAs',
                      value: '98% on-time tasks',
                      tone: 'info'
                    }, {
                      label: 'Pipeline health',
                      value: 'Strong momentum',
                      tone: 'primary'
                    }, {
                      label: 'Data quality',
                      value: 'Monitored & compliant',
                      tone: 'muted'
                    }].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3 flex items-start gap-3 shadow-[0_10px_30px_-28px_rgba(15,23,42,0.45)]"
                      >
                        <div className={`mt-0.5 h-2 w-2 rounded-full ${
                          item.tone === 'success' ? 'bg-emerald-500' :
                          item.tone === 'info' ? 'bg-indigo-500' :
                          item.tone === 'primary' ? 'bg-brand-red' :
                          'bg-slate-300'
                        }`} />
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{item.label}</p>
                          <p className="text-sm font-semibold text-slate-900 mt-0.5">{item.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-slate-100 shadow-[0_20px_50px_-28px_rgba(15,23,42,0.45)] rounded-3xl overflow-hidden">
                  {renderContent()}
                </div>
              </div>
            </main>
          </div>
        </div>
      </ToastContext.Provider>
    </ErrorBoundary>
  );
};

export default App;
