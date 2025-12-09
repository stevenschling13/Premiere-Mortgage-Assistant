
import React, { useEffect, createContext, useContext, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { ToastMessage, ToastType } from '../types';

interface ToastProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

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

export const ToastContainer: React.FC<ToastProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onRemove: () => void }> = ({ toast, onRemove }) => {
  useEffect(() => {
    // Longer duration for toasts with actions
    const duration = toast.action ? 8000 : 4000;
    const timer = setTimeout(() => {
      onRemove();
    }, duration);
    return () => clearTimeout(timer);
  }, [onRemove, toast.action]);

  const getStyles = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-white border-l-4 border-green-500 text-gray-800';
      case 'error':
        return 'bg-white border-l-4 border-red-500 text-gray-800';
      case 'warning':
        return 'bg-white border-l-4 border-orange-500 text-gray-800';
      default:
        return 'bg-white border-l-4 border-blue-500 text-gray-800';
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success': return <CheckCircle size={18} className="text-green-500" />;
      case 'error': return <AlertCircle size={18} className="text-red-500" />;
      case 'warning': return <AlertTriangle size={18} className="text-orange-500" />;
      default: return <Info size={18} className="text-blue-500" />;
    }
  };

  return (
    <div className={`flex flex-col p-4 rounded shadow-lg min-w-[300px] max-w-[400px] animate-slide-in-right ${getStyles()}`}>
      <div className="flex items-start">
        <div className="mr-3 mt-0.5">{getIcon()}</div>
        <div className="flex-1 text-sm font-medium leading-tight">{toast.message}</div>
        <button onClick={onRemove} className="ml-4 text-gray-400 hover:text-gray-600 self-start">
            <X size={14} />
        </button>
      </div>
      {toast.action && (
          <button 
            onClick={() => {
                toast.action?.onClick();
                onRemove();
            }}
            className="mt-3 self-end text-xs font-bold uppercase tracking-wide bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded transition-colors"
          >
              {toast.action.label}
          </button>
      )}
    </div>
  );
};
