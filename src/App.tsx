import React, { useState, useCallback, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Calculator } from './components/Calculator';
import { ClientManager } from './components/ClientManager';
import { Assistant } from './components/Assistant';
import { DtiAnalysis } from './components/DtiAnalysis';
import { RatesNotes } from './components/RatesNotes';
import { MarketingStudio } from './components/MarketInsights';
import { CompensationTracker } from './components/CompensationTracker';
import { DailyPlanner } from './components/DailyPlanner';
import { KnowledgeBase } from './components/KnowledgeBase';
import { ToastContainer, ToastContext } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CommandPalette } from './components/CommandPalette';
import { AppView, ToastMessage, ToastType, Client } from './types';
import { Menu, Building2, Loader2, Bot } from 'lucide-react';
import { errorService } from './services/errorService';
import { saveToStorage, StorageKeys, loadFromStorage } from './services/storageService';

// API Key Gate Component
const ApiKeyGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      try {
        // Short timeout to prevent infinite loading if the bridge is unresponsive
        const timeout = new Promise(resolve => setTimeout(resolve, 1500));
        const check = (window as any).aistudio?.hasSelectedApiKey 
            ? (window as any).aistudio.hasSelectedApiKey() 
            : Promise.resolve(true); // Default to true if not in AI Studio environment
        
        const result = await Promise.race([check, timeout.then(() => true)]);
        setHasKey(!!result);
      } catch (e) {
        console.warn("Failed to check API key status", e);
        setHasKey(true);
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  
  const [selectedClientFromPalette, setSelectedClientFromPalette] = useState<Client | null>(null);

  const showToast = useCallback((message: string, type: ToastType, action?: { label: string; onClick: () => void }) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type, action }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
      const handleGlobalError = (event: ErrorEvent) => {
          console.error("Global Error Caught:", event.error);
          errorService.log('ERROR', event.message, { type: 'global_error' }, event.error);
      };

      const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
          console.error("Unhandled Rejection:", event.reason);
          const msg = event.reason?.message || "Unknown Async Error";
          errorService.log('ERROR', `Unhandled Promise: ${msg}`, { reason: event.reason });
      };

      window.addEventListener('error', handleGlobalError);
      window.addEventListener('unhandledrejection', handleUnhandledRejection);

      return () => {
          window.removeEventListener('error', handleGlobalError);
          window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      };
  }, []);

  const handlePaletteNavigate = (view: AppView) => {
    setCurrentView(view);
    setIsCommandPaletteOpen(false);
  };

  const handlePaletteSelectClient = (client: Client) => {
    const existingRecents = loadFromStorage(StorageKeys.RECENT_IDS, []) as string[];
    const newRecents = [client.id, ...existingRecents.filter(id => id !== client.id)].slice(0, 5);
    saveToStorage(StorageKeys.RECENT_IDS, newRecents);
    
    setSelectedClientFromPalette(client);
    setCurrentView(AppView.DASHBOARD);
    setIsCommandPaletteOpen(false);
  };

  const renderContent = () => {
    switch (currentView) {
      case AppView.DASHBOARD:
        return <ClientManager initialSelectedClient={selectedClientFromPalette} onSelectionCleared={() => setSelectedClientFromPalette(null)} />;
      case AppView.PLANNER:
        return <DailyPlanner />;
      case AppView.KNOWLEDGE:
        return <KnowledgeBase />;
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
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        
        <CommandPalette 
          isOpen={isCommandPaletteOpen} 
          onClose={() => setIsCommandPaletteOpen(false)}
          onNavigate={handlePaletteNavigate}
          onSelectClient={handlePaletteSelectClient}
        />

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
          isCollapsed={isSidebarCollapsed}
          toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        <div className={`flex-1 flex flex-col h-full transition-all duration-300 w-full relative bg-gray-50/50 ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
          
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

          {currentView !== AppView.ASSISTANT && (
            <>
                <button
                    onClick={() => setIsAssistantOpen(!isAssistantOpen)}
                    className="fixed bottom-6 right-6 z-50 p-4 bg-brand-red text-white rounded-full shadow-2xl hover:bg-red-700 transition-all hover:scale-105 active:scale-95 group"
                    title="Open AI Assistant"
                >
                    <Bot size={28} className="group-hover:rotate-12 transition-transform"/>
                </button>

                <div 
                    className={`fixed inset-y-0 right-0 w-full md:w-[450px] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col ${isAssistantOpen ? 'translate-x-0' : 'translate-x-full'}`}
                >
                    {isAssistantOpen && <Assistant onClose={() => setIsAssistantOpen(false)} />}
                </div>
            </>
          )}
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