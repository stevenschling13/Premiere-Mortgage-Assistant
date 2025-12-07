import React, { useState, createContext, useContext, useCallback, Suspense, lazy } from 'react';
import { Sidebar } from './components/Sidebar';
import { ToastContainer, ToastContext } from './components/Toast';
import { AppView, ToastMessage, ToastType } from './types';
import { Menu, Building2, Loader2 } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy Load Components
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
          <ToastContainer toasts={toasts} removeToast={removeToast} />

          {isSidebarOpen && (
            <div 
              className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
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

          <div className="flex-1 flex flex-col md:ml-64 h-screen transition-all duration-300 w-full relative bg-gray-50/50">
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
              >
                <Menu className="w-6 h-6" />
              </button>
            </div>

            <main className="flex-1 overflow-y-auto w-full relative">
              {renderContent()}
            </main>
          </div>
        </div>
      </ToastContext.Provider>
    </ErrorBoundary>
  );
};

export default App;