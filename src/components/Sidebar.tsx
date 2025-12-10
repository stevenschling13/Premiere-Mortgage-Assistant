import React from 'react';
import { Users, Calculator, Sparkles, Building2, LogOut, Megaphone, FileText, PieChart, X, TrendingUp, Download, Calendar, GraduationCap, ChevronLeft, ChevronRight } from 'lucide-react';
import { AppView } from '../types';

interface SidebarProps {
  currentView: AppView;
  onChangeView: (view: AppView) => void;
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
  toggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, isOpen, onClose, isCollapsed = false, toggleCollapse }) => {
  
  const navItems = [
    { id: AppView.DASHBOARD, label: 'Client Dashboard', icon: Users },
    { id: AppView.PLANNER, label: 'Daily Planner', icon: Calendar },
    { id: AppView.KNOWLEDGE, label: 'Knowledge Base', icon: GraduationCap },
    { id: AppView.MARKETING, label: 'Marketing Studio', icon: Megaphone },
    { id: AppView.CALCULATOR, label: 'Jumbo Calculator', icon: Calculator },
    { id: AppView.DTI_ANALYSIS, label: 'Affordability & DTI', icon: PieChart },
    { id: AppView.RATES_NOTES, label: 'Rates & Notes', icon: FileText },
    { id: AppView.COMPENSATION, label: 'Wealth & Performance', icon: TrendingUp },
    { id: AppView.ASSISTANT, label: 'AI Assistant', icon: Sparkles },
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
        fixed inset-y-0 left-0 z-50 bg-brand-dark text-white flex flex-col h-screen shadow-xl
        transform transition-all duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
        ${isCollapsed ? 'w-20' : 'w-64'}
      `}
    >
      <div className={`p-6 border-b border-gray-700 flex items-center justify-between safe-top ${isCollapsed ? 'justify-center p-4' : ''}`}>
        <div className="flex items-center space-x-3 overflow-hidden">
          <Building2 className={`text-brand-red shrink-0 ${isCollapsed ? 'w-8 h-8' : 'w-8 h-8'}`} />
          {!isCollapsed && (
            <div className="transition-opacity duration-200 animate-fade-in whitespace-nowrap">
              <h1 className="font-bold text-lg tracking-tight">Private Bank</h1>
              <p className="text-xs text-gray-400">Mortgage Division</p>
            </div>
          )}
        </div>
        {/* Mobile Close Button */}
        <button onClick={onClose} className="md:hidden text-gray-400 hover:text-white" aria-label="Close sidebar">
          <X className="w-6 h-6" />
        </button>
      </div>

      <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto scrollbar-hide overflow-x-hidden">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onChangeView(item.id)}
            title={isCollapsed ? item.label : undefined}
            className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg transition-all duration-200 group relative ${
              currentView === item.id 
                ? 'bg-brand-red text-white shadow-lg' 
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            } ${isCollapsed ? 'justify-center' : ''}`}
          >
            <item.icon className={`w-5 h-5 shrink-0 transition-transform ${currentView === item.id ? 'scale-110' : 'group-hover:scale-110'}`} />
            {!isCollapsed && <span className="font-medium text-sm truncate animate-fade-in">{item.label}</span>}
            
            {/* Tooltip for collapsed mode */}
            {isCollapsed && (
                <div className="absolute left-full ml-4 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                    {item.label}
                </div>
            )}
          </button>
        ))}
      </nav>

      <div className={`p-4 border-t border-gray-700 bg-brand-dark shrink-0 safe-bottom space-y-3 ${isCollapsed ? 'items-center flex flex-col' : ''}`}>
        <div className={`${isCollapsed ? 'px-0' : 'px-4'} w-full`}>
             {!isCollapsed && (
                 <div className="text-xs text-brand-gold uppercase tracking-wider font-semibold mb-2 flex items-center">
                    <TrendingUp size={10} className="mr-1"/> Market Pulse
                 </div>
             )}
             <button 
                onClick={() => onChangeView(AppView.MARKETING)}
                title="View Live Market Data"
                className={`bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs py-2 rounded border border-white/10 flex items-center transition-colors group ${isCollapsed ? 'justify-center w-10 h-10 px-0' : 'justify-between px-3 w-full'}`}
             >
                {isCollapsed ? (
                    <div className="relative">
                        <TrendingUp size={16} />
                        <span className="absolute -top-1 -right-1 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                    </div>
                ) : (
                    <>
                        <span>View Live Data</span>
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                    </>
                )}
             </button>
        </div>
        
        <div className={`border-t border-white/5 pt-2 w-full ${isCollapsed ? 'flex flex-col items-center space-y-2' : ''}`}>
            <button 
                onClick={handleExportData}
                className={`flex items-center text-gray-400 hover:text-white transition-colors py-2 hover:bg-gray-800 rounded-lg group ${isCollapsed ? 'justify-center w-10 px-0' : 'space-x-3 px-4 w-full'}`}
                title="Export Data"
            >
              <Download className="w-5 h-5 shrink-0 group-hover:text-blue-400 transition-colors" />
              {!isCollapsed && <span className="text-sm">Export Data</span>}
            </button>
            <button 
                onClick={handleSignOut}
                className={`flex items-center text-gray-400 hover:text-white transition-colors py-2 hover:bg-gray-800 rounded-lg group ${isCollapsed ? 'justify-center w-10 px-0' : 'space-x-3 px-4 w-full'}`}
                title="Sign Out"
            >
              <LogOut className="w-5 h-5 shrink-0 group-hover:text-red-400 transition-colors" />
              {!isCollapsed && <span className="text-sm">Sign Out</span>}
            </button>
        </div>

        {/* Collapse Toggle */}
        <div className="hidden md:flex justify-center pt-2 border-t border-white/5 w-full">
            <button 
                onClick={toggleCollapse}
                className="p-1 text-gray-500 hover:text-white transition-colors"
                title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
                {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
        </div>
      </div>
    </div>
  );
};