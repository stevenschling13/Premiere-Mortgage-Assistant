import React, { useEffect, createContext, useContext, useState, useCallback, ReactNode, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { ToastMessage, ToastType } from '../types';

// Context Definition
export interface ToastContextType {
  showToast: (message: string, type: ToastType, action?: { label: string; onClick: () => void }) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

// Hoisted helpers to prevent allocation per render
const getToastStyles = (type: ToastType) => {
  switch (type) {
    case 'success': return 'bg-white border-l-4 border-green-500 text-gray-800';
    case 'error': return 'bg-white border-l-4 border-red-500 text-gray-800';
    case 'warning': return 'bg-white border-l-4 border-orange-500 text-gray-800';
    default: return 'bg-white border-l-4 border-blue-500 text-gray-800';
  }
};

const getToastIcon = (type: ToastType) => {
  switch (type) {
    case 'success': return <CheckCircle size={18} className="text-green-500" />;
    case 'error': return <AlertCircle size={18} className="text-red-500" />;
    case 'warning': return <AlertTriangle size={18} className="text-orange-500" />;
    default: return <Info size={18} className="text-blue-500" />;
  }
};

// Memoized Item to prevent re-renders of existing toasts when new ones appear
const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = React.memo(({ toast, onDismiss }) => {
  // Stable handler derived from ID to maintain memoization
  const handleDismiss = useCallback(() => onDismiss(toast.id), [onDismiss, toast.id]);

  useEffect(() => {
    const duration = toast.action ? 8000 : 4000;
    const timer = setTimeout(handleDismiss, duration);
    return () => clearTimeout(timer);
  }, [handleDismiss, toast.action]);

  return (
    <div className={`flex flex-col p-4 rounded shadow-lg min-w-[300px] max-w-[400px] animate-slide-in-right pointer-events-auto ${getToastStyles(toast.type)}`}>
      <div className="flex items-start">
        <div className="mr-3 mt-0.5">{getToastIcon(toast.type)}</div>
        <div className="flex-1 text-sm font-medium leading-tight">{toast.message}</div>
        <button onClick={handleDismiss} className="ml-4 text-gray-400 hover:text-gray-600 self-start" aria-label="Dismiss">
            <X size={14} />
        </button>
      </div>
      {toast.action && (
          <button 
            onClick={() => {
                toast.action?.onClick();
                handleDismiss();
            }}
            className="mt-3 self-end text-xs font-bold uppercase tracking-wide bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded transition-colors"
          >
              {toast.action.label}
          </button>
      )}
    </div>
  );
});

// Internal Container Component using Portal for layout isolation
export const ToastContainer: React.FC<{ toasts: ToastMessage[]; removeToast: (id: string) => void }> = ({ toasts, removeToast }) => {
  // Server-side safety check (though this is SPA)
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
      ))}
    </div>,
    document.body
  );
};

// Exported Provider
export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastType, action?: { label: string; onClick: () => void }) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2);
    setToasts(prev => [...prev, { id, message, type, action }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // PERFORMANCE: Memoize context value to prevent consumers from re-rendering
  const contextValue = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

// Backward compatibility alias
export { ToastContainer as InternalToastContainer };