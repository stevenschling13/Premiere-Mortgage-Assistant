import React, { useState, useCallback, useEffect, Suspense, useTransition } from 'react';
import { Sidebar } from './components/Sidebar';
import { ToastProvider, useToast } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppView } from './types';
import Menu from 'lucide-react/dist/esm/icons/menu';
import Building2 from 'lucide-react/dist/esm/icons/building-2';
import { errorService } from './services/errorService';

// Lazy Load View Components for Performance Optimization
const Calculator = React.lazy(() => import('./components/Calculator').then(module => ({ default: module.Calculator })));
const ClientManager = React.lazy(() => import('./components/ClientManager').then(module => ({ default: module.ClientManager })));
const Assistant = React.lazy(() => import('./components/Assistant').then(module => ({ default: module.Assistant })));
const DtiAnalysis = React.lazy(() => import('./components/DtiAnalysis').then(module => ({ default: module.DtiAnalysis })));
const RatesNotes = React.lazy(() => import('./components/RatesNotes').then(module => ({ default: module.RatesNotes })));
const MarketingStudio = React.lazy(() => import('./components/MarketInsights').then(module => ({ default: module.MarketingStudio })));
const CompensationTracker = React.lazy(() => import('./components/CompensationTracker').then(module => ({ default: module.CompensationTracker })));
const DailyPlanner = React.lazy(() => import('./components/DailyPlanner').then(module => ({ default: module.DailyPlanner })));

// Loading Fallback for Suspense
const ViewLoader = () => (
  <div className="flex h-full w-full items-center justify-center bg-gray-50/50">
    <div className="flex flex-col items-center gap-3 animate-pulse">
      <div className="w-10 h-10 border-4 border-brand-red border-t-transparent rounded-full animate-spin"></div>
      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Loading Module...</span>
    </div>
  </div>
);

// Inner App Content to access Toast Context if needed for global errors, 
// though ErrorBoundary handles most logging.
const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { showToast } = useToast();
  
  // Concurrency: Transition state for view switching
  const [isPending, startTransition] = useTransition();

  // Optimized View Switcher using startTransition
  const handleViewChange = useCallback((view: AppView) => {
      startTransition(() => {
          setCurrentView(view);
          setIsSidebarOpen(false);
      });
  }, []);

  // Optimized Sidebar Close Handler
  const handleCloseSidebar = useCallback(() => {
      setIsSidebarOpen(false);
  }, []);

  // Global Error Listener
  useEffect(() => {
      const handleGlobalError = (event: ErrorEvent) => {
          console.error("Global Error Caught:", event.error);
          errorService.log('ERROR', event.message, { type: 'global_error' }, event.error);
      };

      const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
          console.error("Unhandled Rejection:", event.reason);
          const msg = event.reason?.message || "Unknown Async Error";
          errorService.log('ERROR', `Unhandled Promise: ${msg}`, { reason: event.reason });
          
          showToast("Background operation failed.", "warning", {
              label: "Report Issue",
              onClick: () => {
                  alert(`Diagnostic info captured. ID: ${Date.now()}`);
              }
          });
      };

      window.addEventListener('error', handleGlobalError);
      window.addEventListener('unhandledrejection', handleUnhandledRejection);

      return () => {
          window.removeEventListener('error', handleGlobalError);
          window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      };
  }, [showToast]);

  const renderContent = () => {
    return (
      <Suspense fallback={<ViewLoader />}>
        {currentView === AppView.DASHBOARD && <ClientManager />}
        {currentView === AppView.PLANNER && <DailyPlanner />}
        {currentView === AppView.CALCULATOR && <Calculator />}
        {currentView === AppView.DTI_ANALYSIS && <DtiAnalysis />}
        {currentView === AppView.RATES_NOTES && <RatesNotes />}
        {currentView === AppView.MARKETING && <MarketingStudio />}
        {currentView === AppView.COMPENSATION && <CompensationTracker />}
        {currentView === AppView.ASSISTANT && <Assistant />}
      </Suspense>
    );
  };

  return (
    <div className="flex h-[100dvh] bg-slate-50 font-sans text-gray-900 overflow-hidden">
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-brand-red focus:text-white focus:rounded-md focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Loading Indicator for Transitions */}
      {isPending && (
          <div className="fixed top-0 left-0 right-0 h-1 bg-brand-red/20 z-[100]">
              <div className="h-full bg-brand-red animate-pulse w-full origin-left"></div>
          </div>
      )}

      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm animate-fade-in"
          onClick={handleCloseSidebar}
        />
      )}

      <Sidebar 
        currentView={currentView} 
        onChangeView={handleViewChange} 
        isOpen={isSidebarOpen}
        onClose={handleCloseSidebar}
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
          className="flex-1 overflow-y-auto overflow-x-hidden w-full relative scroll-smooth focus:outline-none"
          tabIndex={-1}
        >
          <ErrorBoundary>
            {renderContent()}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
};

export default App;