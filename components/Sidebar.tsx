
import React from 'react';
import { Users, Calculator, Sparkles, Building2, LogOut, Megaphone, FileText, PieChart, X } from 'lucide-react';
import { AppView } from '../types';

interface SidebarProps {
  currentView: AppView;
  onChangeView: (view: AppView) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, isOpen, onClose }) => {
  
  const navItems = [
    { id: AppView.DASHBOARD, label: 'Client Dashboard', icon: Users },
    { id: AppView.MARKETING, label: 'Marketing Studio', icon: Megaphone },
    { id: AppView.CALCULATOR, label: 'Jumbo Calculator', icon: Calculator },
    { id: AppView.DTI_ANALYSIS, label: 'Affordability & DTI', icon: PieChart },
    { id: AppView.RATES_NOTES, label: 'Rates & Notes', icon: FileText },
    { id: AppView.ASSISTANT, label: 'AI Assistant', icon: Sparkles },
  ];

  return (
    <div 
      className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-brand-dark text-white flex flex-col h-screen shadow-xl
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}
    >
      <div className="p-6 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Building2 className="w-8 h-8 text-brand-red" />
          <div>
            <h1 className="font-bold text-lg tracking-tight">Private Bank</h1>
            <p className="text-xs text-gray-400">Mortgage Division</p>
          </div>
        </div>
        {/* Mobile Close Button */}
        <button onClick={onClose} className="md:hidden text-gray-400 hover:text-white">
          <X className="w-6 h-6" />
        </button>
      </div>

      <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onChangeView(item.id)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              currentView === item.id 
                ? 'bg-brand-red text-white shadow-lg' 
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            <span className="font-medium text-sm">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-700 bg-brand-dark shrink-0">
        <div className="mb-4 px-4">
             <div className="text-xs text-brand-gold uppercase tracking-wider font-semibold mb-2">Market Snapshot</div>
             <div className="text-xs text-gray-400 flex justify-between">
                <span>10yr Treasury</span>
                <span className="text-white">4.12%</span>
             </div>
             <div className="text-xs text-gray-400 flex justify-between mt-1">
                <span>SOFR</span>
                <span className="text-white">5.31%</span>
             </div>
        </div>
        <button className="flex items-center space-x-3 text-gray-400 hover:text-white transition-colors px-4 py-2 w-full">
          <LogOut className="w-5 h-5 shrink-0" />
          <span className="text-sm">Sign Out</span>
        </button>
      </div>
    </div>
  );
};
