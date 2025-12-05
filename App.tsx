
import React, { useState, createContext, useContext, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Calculator } from './components/Calculator';
import { ClientManager } from './components/ClientManager';
import { Assistant } from './components/Assistant';
import { DtiAnalysis } from './components/DtiAnalysis';
import { RatesNotes } from './components/RatesNotes';
import { MarketingStudio } from './components/MarketInsights';
import { ToastContainer } from './components/Toast';
import { AppView, ToastMessage, ToastType } from './types';
import { Menu, Building2 } from 'lucide-react';

// Context
interface ToastContextType {
  showToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

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
      case AppView.ASSISTANT:
        return <Assistant />;
      default:
        return <ClientManager />;
    }
  };

  return (
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
          <div className="md:hidden bg-brand-dark text-white p-4 flex items-center justify-between shadow-md shrink-0 z-30">
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

          {/* Scrollable Main Content */}
          <main className="flex-1 overflow-y-auto w-full relative">
            {renderContent()}
          </main>
        </div>
      </div>
    </ToastContext.Provider>
  );
};

export default App;
