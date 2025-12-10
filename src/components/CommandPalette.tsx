
import React, { useState, useEffect, useRef } from 'react';
import { Search, Command, User, Calculator, TrendingUp, Calendar, FileText, Megaphone, Sparkles, GraduationCap, ArrowRight, X } from 'lucide-react';
import { AppView, Client } from '../types';
import { loadFromStorage, StorageKeys } from '../services';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: AppView) => void;
  onSelectClient?: (client: Client) => void;
}

type CommandItem = {
  id: string;
  label: string;
  subLabel?: string;
  icon: React.ReactNode;
  type: 'NAVIGATION' | 'CLIENT' | 'ACTION';
  action: () => void;
};

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onNavigate, onSelectClient }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load clients directly from storage for global search context
  const clients: Client[] = loadFromStorage(StorageKeys.CLIENTS, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const navigationItems: CommandItem[] = [
    { id: 'nav-dash', label: 'Client Dashboard', icon: <User size={16} />, type: 'NAVIGATION', action: () => onNavigate(AppView.DASHBOARD) },
    { id: 'nav-calc', label: 'Jumbo Calculator', icon: <Calculator size={16} />, type: 'NAVIGATION', action: () => onNavigate(AppView.CALCULATOR) },
    { id: 'nav-plan', label: 'Daily Planner', icon: <Calendar size={16} />, type: 'NAVIGATION', action: () => onNavigate(AppView.PLANNER) },
    { id: 'nav-dti', label: 'DTI Analysis', icon: <TrendingUp size={16} />, type: 'NAVIGATION', action: () => onNavigate(AppView.DTI_ANALYSIS) },
    { id: 'nav-market', label: 'Marketing Studio', icon: <Megaphone size={16} />, type: 'NAVIGATION', action: () => onNavigate(AppView.MARKETING) },
    { id: 'nav-rates', label: 'Rates & Notes', icon: <FileText size={16} />, type: 'NAVIGATION', action: () => onNavigate(AppView.RATES_NOTES) },
    { id: 'nav-learn', label: 'Knowledge Base', icon: <GraduationCap size={16} />, type: 'NAVIGATION', action: () => onNavigate(AppView.KNOWLEDGE) },
    { id: 'nav-ai', label: 'AI Assistant', icon: <Sparkles size={16} />, type: 'NAVIGATION', action: () => onNavigate(AppView.ASSISTANT) },
  ];

  const clientItems: CommandItem[] = clients.map(c => ({
    id: `client-${c.id}`,
    label: c.name,
    subLabel: `${c.status} • $${(c.loanAmount / 1000).toFixed(0)}k`,
    icon: <User size={16} className="text-brand-gold" />,
    type: 'CLIENT',
    action: () => {
      onNavigate(AppView.DASHBOARD);
      // We rely on the Dashboard to pick up the selection via local storage recent ID or specific callback if implemented
      // Ideally, we'd pass the client object back up
      if (onSelectClient) onSelectClient(c);
    }
  }));

  const filteredItems = React.useMemo(() => {
    if (!query) return navigationItems.slice(0, 5); // Default view

    const lowerQuery = query.toLowerCase();
    
    const matchedNav = navigationItems.filter(item => 
      item.label.toLowerCase().includes(lowerQuery)
    );

    const matchedClients = clientItems.filter(item => 
      item.label.toLowerCase().includes(lowerQuery) || 
      (item.subLabel && item.subLabel.toLowerCase().includes(lowerQuery))
    );

    return [...matchedNav, ...matchedClients].slice(0, 8);
  }, [query, clientItems]);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[20vh] px-4 animate-fade-in">
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden relative z-10 transform transition-all scale-100">
        <div className="flex items-center px-4 py-3 border-b border-gray-100">
          <Search className="w-5 h-5 text-gray-400 mr-3" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients, tools, or commands..."
            className="flex-1 text-lg bg-transparent outline-none text-gray-800 placeholder-gray-400"
          />
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded border border-gray-200 font-medium">ESC</span>
            <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
          </div>
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No matching results.</p>
            </div>
          ) : (
            <>
              {query === '' && <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Quick Navigation</div>}
              {filteredItems.map((item, index) => (
                <div
                  key={item.id}
                  onClick={() => { item.action(); onClose(); }}
                  className={`flex items-center justify-between px-3 py-3 rounded-lg cursor-pointer transition-colors group ${
                    index === selectedIndex ? 'bg-brand-dark text-white' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-md ${index === selectedIndex ? 'bg-white/10' : 'bg-gray-100 text-gray-500 group-hover:bg-white group-hover:shadow-sm'}`}>
                      {item.icon}
                    </div>
                    <div>
                      <div className={`font-medium ${index === selectedIndex ? 'text-white' : 'text-gray-900'}`}>{item.label}</div>
                      {item.subLabel && (
                        <div className={`text-xs ${index === selectedIndex ? 'text-gray-400' : 'text-gray-500'}`}>{item.subLabel}</div>
                      )}
                    </div>
                  </div>
                  
                  {index === selectedIndex && (
                    <ArrowRight className="w-4 h-4 text-brand-gold animate-slide-in-right" />
                  )}
                </div>
              ))}
            </>
          )}
        </div>
        
        <div className="bg-gray-50 px-4 py-2 border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-500">
            <div className="flex gap-4">
                <span><strong className="font-bold">↑↓</strong> to navigate</span>
                <span><strong className="font-bold">↵</strong> to select</span>
            </div>
            <div className="flex items-center gap-1">
                <Command size={10} /> + K
            </div>
        </div>
      </div>
    </div>
  );
};
