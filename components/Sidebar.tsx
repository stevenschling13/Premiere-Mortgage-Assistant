import React from 'react';
import { Users, Calculator, Sparkles, Building2, LogOut, Megaphone, FileText, PieChart, X, TrendingUp, Download, Calendar } from 'lucide-react';
import { AppView } from '../types';

interface SidebarProps {
  currentView: AppView;
  onChangeView: (view: AppView) => void;
  isOpen: boolean;
  onClose: () => void;
}

const SidebarComponent: React.FC<SidebarProps> = ({ currentView, onChangeView, isOpen, onClose }) => {
  
  const navItems = [
    { id: AppView.DASHBOARD, label: 'Client Dashboard', icon: Users },
    { id: AppView.PLANNER, label: 'Daily Planner', icon: Calendar },
    { id: AppView.MARKETING, label: 'Market Intelligence', icon: Megaphone },
    { id: AppView.CALCULATOR, label: 'Jumbo Calculator', icon: Calculator },
    { id: AppView.DTI_ANALYSIS, label: 'Affordability & DTI', icon: PieChart },
    { id: AppView.RATES_NOTES, label: 'Rates & Commentary', icon: FileText },
    { id: AppView.COMPENSATION, label: 'Wealth & Performance', icon: TrendingUp },
    { id: AppView.ASSISTANT, label: 'Virtual Analyst', icon: Sparkles },
  ];

  const handleSignOut = () => {
    if (confirm("Sign out? This will clear your local session data.")) {
       localStorage.clear();
       window.location.reload();
    }
  };

  const handleExportData = () => {
      const data: Record<string, any> = {};
      // Iterate over known keys or all local storage
      // Only export app-specific keys
      for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('premiere_mortgage_')) {
              try {
                  data[key] = JSON.parse(localStorage.getItem(key) || 'null');
              } catch (e) {
                  data[key] = localStorage.getItem(key);
              }
          }
      }
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mortgage_assistant_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  return (
    <div 
      className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-brand-dark text-white flex flex-col h-screen shadow-xl
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}
    >
      <div className="p-6 border-b border-gray-700 flex items-center justify-between safe-top">
        <div className="flex items-center space-x-3">
          <Building2 className="w-8 h-8 text-brand-red" />
          <div>
            <h1 className="font-bold text-lg tracking-tight">Private Bank</h1>
            <p className="text-xs text-gray-400">Mortgage Division</p>
          </div>
        </div>
        {/* Mobile Close Button */}
        <button onClick={onClose} className="md:hidden text-gray-400 hover:text-white" aria-label="Close sidebar">
          <X className="w-6 h-6" />
        </button>
      </div>

      <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto scrollbar-hide">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onChangeView(item.id)}
            title={item.label}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
              currentView === item.id 
                ? 'bg-brand-red text-white shadow-lg' 
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <item.icon className={`w-5 h-5 shrink-0 transition-transform ${currentView === item.id ? 'scale-110' : 'group-hover:scale-110'}`} />
            <span className="font-medium text-sm truncate">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-700 bg-brand-dark shrink-0 safe-bottom space-y-3">
        <div className="px-4">
             <div className="text-xs text-brand-gold uppercase tracking-wider font-semibold mb-2 flex items-center">
                <TrendingUp size={10} className="mr-1"/> Market Pulse
             </div>
             <button 
                onClick={() => onChangeView(AppView.MARKETING)}
                className="w-full bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs py-2 px-3 rounded border border-white/10 flex items-center justify-between transition-colors group"
             >
                <span>View Live Data</span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
             </button>
        </div>
        
        <div className="border-t border-white/5 pt-2">
            <button 
                onClick={handleExportData}
                className="flex items-center space-x-3 text-gray-400 hover:text-white transition-colors px-4 py-2 w-full hover:bg-gray-800 rounded-lg group"
                title="Download backup of all data"
            >
              <Download className="w-5 h-5 shrink-0 group-hover:text-blue-400 transition-colors" />
              <span className="text-sm">Export Data</span>
            </button>
            <button 
                onClick={handleSignOut}
                className="flex items-center space-x-3 text-gray-400 hover:text-white transition-colors px-4 py-2 w-full hover:bg-gray-800 rounded-lg group"
            >
              <LogOut className="w-5 h-5 shrink-0 group-hover:text-red-400 transition-colors" />
              <span className="text-sm">Sign Out</span>
            </button>
        </div>
      </div>
    </div>
  );
};

export const Sidebar = React.memo(SidebarComponent);