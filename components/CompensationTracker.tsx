import React, { useState, useMemo, useEffect } from 'react';
import DollarSign from 'lucide-react/icons/dollar-sign';
import TrendingUp from 'lucide-react/icons/trending-up';
import ShieldCheck from 'lucide-react/icons/shield-check';
import Briefcase from 'lucide-react/icons/briefcase';
import CheckCircle2 from 'lucide-react/icons/check-circle-2';
import PlusCircle from 'lucide-react/icons/plus-circle';
import Sparkles from 'lucide-react/icons/sparkles';
import Loader2 from 'lucide-react/icons/loader-2';
import ArrowUpRight from 'lucide-react/icons/arrow-up-right';
import Settings from 'lucide-react/icons/settings';
import Calculator from 'lucide-react/icons/calculator';
import BarChart3 from 'lucide-react/icons/bar-chart-3';
import PieChart from 'lucide-react/icons/pie-chart';
import History from 'lucide-react/icons/history';
import X from 'lucide-react/icons/x';
import Save from 'lucide-react/icons/save';
import Target from 'lucide-react/icons/target';
import AlertTriangle from 'lucide-react/icons/alert-triangle';
import { loadFromStorage, saveToStorage, StorageKeys } from '../services/storageService';
import { Client, ManualDeal } from '../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ReferenceLine, CartesianGrid } from 'recharts';
import { useToast } from './Toast';
import { MarkdownRenderer } from './MarkdownRenderer';

const loadCompensationService = () => import('../services/gemini/compensationService');

const DEFAULT_SETTINGS = {
    baseSalary: 51001,
    targetIncome: 108750,
    commissionSplit: 0.15,
    hourlyRate: 24.52
};

export const CompensationTracker: React.FC = () => {
    const { showToast } = useToast();
    const [clients, setClients] = useState<Client[]>(() => loadFromStorage(StorageKeys.CLIENTS, []));
    const [manualDeals, setManualDeals] = useState<ManualDeal[]>(() => loadFromStorage(StorageKeys.MANUAL_DEALS, []));
    
    // Configurable Settings
    const [settings, setSettings] = useState(() => loadFromStorage(StorageKeys.COMP_SETTINGS, DEFAULT_SETTINGS));
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Manual Deal Modal State
    const [isAddDealOpen, setIsAddDealOpen] = useState(false);
    const [newDeal, setNewDeal] = useState<Partial<ManualDeal>>({
        date: new Date().toISOString().split('T')[0],
        clientName: '',
        loanAmount: 0,
        commission: 0
    });

    // View State
    const [chartMode, setChartMode] = useState<'INCOME' | 'VOLUME'>('INCOME');
    const [tableMode, setTableMode] = useState<'PIPELINE' | 'HISTORY'>('PIPELINE');
    const [quickCalc, setQuickCalc] = useState({ loanAmount: 2000000, bps: 55 });

    // Constants (derived from settings)
    const HOURLY_RATE = settings.hourlyRate;
    const ANNUAL_BASE = settings.baseSalary;
    const TARGET_ANNUAL_INCOME = settings.targetIncome;
    const BANKER_BPS = 0.0055; // 55 BPS blended average
    const ASSISTANT_SPLIT = settings.commissionSplit;

    const [gapStrategy, setGapStrategy] = useState<string | null>(null);
    const [isStrategizing, setIsStrategizing] = useState(false);

    useEffect(() => {
        saveToStorage(StorageKeys.CLIENTS, clients);
    }, [clients]);

    useEffect(() => {
        saveToStorage(StorageKeys.MANUAL_DEALS, manualDeals);
    }, [manualDeals]);

    useEffect(() => {
        saveToStorage(StorageKeys.COMP_SETTINGS, settings);
    }, [settings]);

    // --- Computed Data ---

    // 1. Calculate YTD Base (Real-time based on current month)
    const currentMonthIndex = new Date().getMonth(); // 0-11
    const ytdBase = (ANNUAL_BASE / 12) * (currentMonthIndex + 1);

    // 2. Aggregate ALL Closed Deals (CRM + Manual)
    const allClosedDeals = useMemo(() => {
        const crmClosed = clients.filter(c => c.status === 'Closed').map(c => ({
            id: c.id,
            date: c.nextActionDate, // Assuming nextActionDate is closing date for closed deals
            name: c.name,
            amount: c.loanAmount,
            commission: (c.loanAmount * BANKER_BPS * ASSISTANT_SPLIT), 
            source: 'CRM'
        }));
        
        const manual = manualDeals.map(d => ({
            id: d.id,
            date: d.date,
            name: d.clientName,
            amount: d.loanAmount,
            commission: d.commission,
            source: 'Manual'
        }));

        return [...crmClosed, ...manual].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [clients, manualDeals, settings]);

    const ytdCommission = useMemo(() => allClosedDeals.reduce((acc, deal) => acc + deal.commission, 0), [allClosedDeals]);
    const totalYtdIncome = ytdBase + ytdCommission;
    const percentToGoal = (totalYtdIncome / TARGET_ANNUAL_INCOME) * 100;
    const incomeGap = TARGET_ANNUAL_INCOME - totalYtdIncome;

    // 3. Projected Pipeline (Active CRM Deals)
    const activeClients = useMemo(() => clients.filter(c => c.status !== 'Closed' && c.status !== 'Lead'), [clients]);
    
    const pipelineData = useMemo(() => {
        return activeClients.map(client => {
            const bankerGross = client.loanAmount * BANKER_BPS;
            const myCut = bankerGross * ASSISTANT_SPLIT;
            
            let probability = 0;
            switch(client.status) {
                case 'Pre-Approval': probability = 0.30; break;
                case 'Underwriting': probability = 0.70; break;
                case 'Clear to Close': probability = 0.95; break;
                default: probability = 0.10;
            }

            return {
                ...client,
                bankerGross,
                myCut,
                probability,
                weightedValue: myCut * probability
            };
        }).sort((a, b) => b.weightedValue - a.weightedValue);
    }, [activeClients, ASSISTANT_SPLIT]);

    const projectedCommission = useMemo(() => pipelineData.reduce((acc, item) => acc + item.weightedValue, 0), [pipelineData]);

    // 4. Monthly Breakdown Data
    const monthlyData = useMemo(() => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        const data = months.map((month, index) => ({
            month,
            commission: 0,
            volume: 0,
            deals: 0,
            index
        }));

        allClosedDeals.forEach(deal => {
            if (!deal.date) return;
            // Handle YYYY-MM-DD
            const d = new Date(deal.date);
            const mIndex = d.getUTCMonth(); // Use UTC to avoid timezone shifts on simple dates
            if (mIndex >= 0 && mIndex < 12) {
                data[mIndex].commission += deal.commission;
                data[mIndex].volume += deal.amount;
                data[mIndex].deals += 1;
            }
        });

        // Return up to current month for cleaner chart
        return data.filter(d => d.index <= currentMonthIndex);
    }, [allClosedDeals, currentMonthIndex]);

    // --- Handlers ---

    const handleAddManualDeal = () => {
        if (!newDeal.clientName || !newDeal.commission || !newDeal.date) {
            showToast('Please fill in all fields', 'error');
            return;
        }

        const deal: ManualDeal = {
            id: `man-${Date.now()}`,
            clientName: newDeal.clientName,
            date: newDeal.date,
            loanAmount: newDeal.loanAmount || 0,
            commission: newDeal.commission || 0
        };

        setManualDeals(prev => [deal, ...prev]);
        setIsAddDealOpen(false);
        setNewDeal({
             date: new Date().toISOString().split('T')[0],
             clientName: '',
             loanAmount: 0,
             commission: 0
        });
        showToast('Past deal added to ledger', 'success');
    };

    const handleDeleteManualDeal = (id: string) => {
        if(confirm('Remove this deal from history?')) {
            setManualDeals(prev => prev.filter(d => d.id !== id));
            showToast('Deal removed', 'info');
        }
    };

    const handleGenerateStrategy = async () => {
        setIsStrategizing(true);
        try {
            const { generateGapStrategy } = await loadCompensationService();
            const strategy = await generateGapStrategy(totalYtdIncome, TARGET_ANNUAL_INCOME, pipelineData);
            setGapStrategy(strategy);
        } catch (e) {
            console.error(e);
            showToast('Strategy generation unavailable', 'error');
        } finally {
            setIsStrategizing(false);
        }
    };

    const chartData = [
        { name: 'Base Salary', amount: ANNUAL_BASE, fill: '#1E293B' },
        { name: 'YTD Comm.', amount: ytdCommission, fill: '#F4B23E' },
        { name: 'Projected', amount: projectedCommission, fill: '#CD1337' },
    ];

    const quickCalcMyCut = (quickCalc.loanAmount * (quickCalc.bps / 10000)) * ASSISTANT_SPLIT;

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in pb-20 md:pb-8">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-brand-dark tracking-tight flex items-center">
                        <ShieldCheck className="mr-3 text-brand-gold" size={32}/>
                        Compensation & Performance
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Real-time compensation tracking & forecasting</p>
                </div>
                
                <div className="flex flex-col md:flex-row items-end md:items-center gap-4 w-full md:w-auto relative">
                     {/* Settings Toggle */}
                    <button 
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)} 
                        className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-dark"
                        aria-label="Configuration Settings"
                    >
                        <Settings size={20} className="text-gray-600"/>
                    </button>
                    
                    {/* Settings Modal (Inline) */}
                    {isSettingsOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsSettingsOpen(false)}></div>
                            <div className="absolute top-full right-0 mt-2 bg-white p-6 rounded-xl shadow-xl border border-gray-200 z-50 w-72 animate-fade-in">
                                <h3 className="font-bold text-gray-800 mb-4 flex items-center text-sm uppercase tracking-wide"><Settings size={14} className="mr-2"/> Configuration</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500">Target Annual Income</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2 text-gray-400">$</span>
                                            <input type="number" value={settings.targetIncome} onChange={(e) => setSettings({...settings, targetIncome: parseFloat(e.target.value)})} className="w-full pl-6 p-2 border rounded text-sm outline-none focus:border-brand-dark"/>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500">Base Salary</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2 text-gray-400">$</span>
                                            <input type="number" value={settings.baseSalary} onChange={(e) => setSettings({...settings, baseSalary: parseFloat(e.target.value)})} className="w-full pl-6 p-2 border rounded text-sm outline-none focus:border-brand-dark"/>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500">Commission Split (Decimal)</label>
                                        <input type="number" step="0.01" value={settings.commissionSplit} onChange={(e) => setSettings({...settings, commissionSplit: parseFloat(e.target.value)})} className="w-full p-2 border rounded text-sm outline-none focus:border-brand-dark"/>
                                    </div>
                                    <button onClick={() => setIsSettingsOpen(false)} className="w-full bg-brand-dark text-white py-2 rounded text-sm font-bold mt-2 hover:bg-gray-800">Save & Close</button>
                                </div>
                            </div>
                        </>
                    )}
                    
                    {/* Add Past Deal Button */}
                    <button 
                        onClick={() => setIsAddDealOpen(true)}
                        className="bg-white hover:bg-gray-50 text-brand-dark border border-gray-200 px-4 py-3 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center whitespace-nowrap"
                    >
                        <PlusCircle size={16} className="mr-2 text-green-600"/>
                        Add Past Deal
                    </button>

                    {/* Add Deal Modal */}
                    {isAddDealOpen && (
                         <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                             <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
                                 <div className="flex justify-between items-center mb-6">
                                     <h3 className="font-bold text-lg text-gray-900">Log Past / External Deal</h3>
                                     <button onClick={() => setIsAddDealOpen(false)} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} className="text-gray-500"/></button>
                                 </div>
                                 <div className="space-y-4">
                                     <div>
                                         <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date Closed</label>
                                         <input type="date" value={newDeal.date} onChange={e => setNewDeal({...newDeal, date: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-gold" />
                                     </div>
                                     <div>
                                         <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Client Name</label>
                                         <input placeholder="e.g. Smith - Refi" value={newDeal.clientName} onChange={e => setNewDeal({...newDeal, clientName: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-gold" />
                                     </div>
                                     <div className="grid grid-cols-2 gap-4">
                                         <div>
                                             <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Loan Volume</label>
                                             <div className="relative">
                                                 <span className="absolute left-3 top-3 text-gray-400 text-sm">$</span>
                                                 <input type="number" value={newDeal.loanAmount} onChange={e => setNewDeal({...newDeal, loanAmount: parseFloat(e.target.value)})} className="w-full pl-6 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-gold" />
                                             </div>
                                         </div>
                                         <div>
                                             <label className="block text-xs font-bold text-brand-dark uppercase mb-1">Net Commission</label>
                                             <div className="relative">
                                                 <span className="absolute left-3 top-3 text-gray-400 text-sm">$</span>
                                                 <input type="number" value={newDeal.commission} onChange={e => setNewDeal({...newDeal, commission: parseFloat(e.target.value)})} className="w-full pl-6 p-3 bg-green-50 border border-green-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500 font-bold text-green-700" />
                                             </div>
                                         </div>
                                     </div>
                                     <div className="pt-4 flex gap-3">
                                         <button onClick={() => setIsAddDealOpen(false)} className="flex-1 py-3 text-gray-500 font-medium hover:bg-gray-50 rounded-lg">Cancel</button>
                                         <button onClick={handleAddManualDeal} className="flex-1 py-3 bg-brand-dark text-white font-bold rounded-lg hover:bg-gray-800 shadow-lg">Add to Ledger</button>
                                     </div>
                                 </div>
                             </div>
                         </div>
                    )}

                    {/* Stats Pill */}
                    <div className="bg-brand-dark text-white px-6 py-4 rounded-xl shadow-lg flex items-center gap-6 w-full md:w-auto justify-between md:justify-start min-w-[300px]">
                        <div className="text-right">
                            <span className="block text-[10px] text-brand-gold uppercase tracking-wider font-bold mb-1">Annual Goal</span>
                            <span className="text-2xl font-bold leading-none">${TARGET_ANNUAL_INCOME.toLocaleString()}</span>
                        </div>
                        <div className="h-8 w-px bg-white/10"></div>
                        <div className="text-right">
                            <span className="block text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1">YTD Actual</span>
                            <span className={`text-2xl font-bold leading-none ${totalYtdIncome >= TARGET_ANNUAL_INCOME ? 'text-green-400' : 'text-white'}`}>
                                ${totalYtdIncome.toLocaleString(undefined, {maximumFractionDigits:0})}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Dashboard Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-8">
                
                {/* 1. Stats Cards Column */}
                <div className="xl:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Salary Card */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Briefcase size={64} />
                        </div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Base Salary (Prorated)</p>
                        <div className="flex items-baseline space-x-2">
                            <span className="text-3xl font-bold text-brand-dark">${ytdBase.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                            <span className="text-sm text-gray-400">YTD</span>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
                            Based on ${ANNUAL_BASE.toLocaleString()}/yr
                        </div>
                    </div>

                    {/* Commission Card */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <TrendingUp size={64} className="text-brand-red"/>
                        </div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Commission Earned</p>
                        <div className="flex items-baseline space-x-2">
                            <span className="text-3xl font-bold text-brand-red">${ytdCommission.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                            <span className="text-sm text-gray-400">YTD</span>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
                            {allClosedDeals.length} Closed Deals ({settings.commissionSplit * 100}% Split)
                        </div>
                    </div>

                    {/* Forecast Card */}
                    <div className="bg-gradient-to-br from-brand-dark to-slate-900 text-white p-6 rounded-xl shadow-lg relative overflow-hidden">
                        <div className="absolute -right-6 -top-6 w-24 h-24 bg-brand-gold rounded-full opacity-20 blur-xl"></div>
                        <p className="text-xs font-bold text-brand-gold uppercase tracking-wider mb-2">Quarterly Forecast</p>
                        <div className="flex items-baseline space-x-2">
                            <span className="text-3xl font-bold text-white">
                                ${(projectedCommission).toLocaleString(undefined, {maximumFractionDigits:0})}
                            </span>
                            <span className="text-sm text-gray-400">Pipeline</span>
                        </div>
                        <div className="mt-4 w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-brand-gold h-1.5 rounded-full transition-all duration-1000" style={{width: `${Math.min(percentToGoal, 100)}%`}}></div>
                        </div>
                        <div className="flex justify-between text-[10px] mt-2 text-gray-400">
                            <span>{percentToGoal.toFixed(1)}% to Annual Goal</span>
                        </div>
                    </div>
                </div>

                {/* 2. Quick Calc Widget */}
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center space-x-2 mb-4 text-blue-900">
                        <Calculator size={18} />
                        <h3 className="font-bold text-sm uppercase tracking-wider">Scenario Calc</h3>
                    </div>
                    
                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] font-bold text-blue-700 uppercase">Loan Amount</label>
                            <input 
                                type="number" 
                                value={quickCalc.loanAmount}
                                onChange={(e) => setQuickCalc({...quickCalc, loanAmount: parseFloat(e.target.value)})}
                                className="w-full p-2 text-sm border border-blue-200 rounded bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-blue-700 uppercase">Banker BPS</label>
                            <input 
                                type="number" 
                                value={quickCalc.bps}
                                onChange={(e) => setQuickCalc({...quickCalc, bps: parseFloat(e.target.value)})}
                                className="w-full p-2 text-sm border border-blue-200 rounded bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-blue-200">
                         <div className="flex justify-between items-end">
                             <span className="text-xs text-blue-800 font-medium">Net Payout</span>
                             <span className="text-2xl font-bold text-blue-900">${quickCalcMyCut.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                         </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 3. Data Table (Pipeline vs History) */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                    <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center sticky top-0 z-10">
                        <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg">
                            <button 
                                onClick={() => setTableMode('PIPELINE')}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${tableMode === 'PIPELINE' ? 'bg-white text-brand-dark shadow' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Active Pipeline
                            </button>
                            <button 
                                onClick={() => setTableMode('HISTORY')}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${tableMode === 'HISTORY' ? 'bg-white text-brand-dark shadow' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Performance History
                            </button>
                        </div>
                    </div>
                    
                    <div className="overflow-y-auto flex-1">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase bg-gray-50">Client / Deal</th>
                                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase bg-gray-50">
                                        {tableMode === 'PIPELINE' ? 'Status' : 'Date Closed'}
                                    </th>
                                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase text-right bg-gray-50">Volume</th>
                                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase text-right text-brand-red bg-gray-50">Commission</th>
                                    {tableMode === 'HISTORY' && <th className="px-4 py-3 w-10 bg-gray-50"></th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {tableMode === 'PIPELINE' ? (
                                    pipelineData.length > 0 ? pipelineData.map((deal) => (
                                        <tr key={deal.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 font-medium text-gray-900">{deal.name}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                                    deal.status === 'Clear to Close' ? 'bg-green-50 text-green-700 border-green-200' : 
                                                    deal.status === 'Underwriting' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                    'bg-gray-100 text-gray-600 border-gray-200'
                                                }`}>
                                                    {deal.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right text-gray-600 font-mono">
                                                ${(deal.loanAmount / 1000000).toFixed(2)}M
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-brand-dark font-mono">
                                                ${deal.myCut.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={4} className="p-8 text-center text-gray-400 text-sm">No active deals in pipeline.</td></tr>
                                    )
                                ) : (
                                    allClosedDeals.length > 0 ? allClosedDeals.map((deal) => (
                                        <tr key={deal.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-gray-900">{deal.name}</div>
                                                <div className="text-[10px] text-gray-400">{deal.source === 'Manual' ? 'Manual Entry' : 'CRM Record'}</div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 text-xs">
                                                {deal.date}
                                            </td>
                                            <td className="px-4 py-3 text-right text-gray-600 font-mono">
                                                ${(deal.amount / 1000000).toFixed(2)}M
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-green-600 font-mono">
                                                +${deal.commission.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {deal.source === 'Manual' && (
                                                    <button onClick={() => handleDeleteManualDeal(deal.id)} className="text-gray-300 hover:text-red-500">
                                                        <X size={14}/>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={5} className="p-8 text-center text-gray-400 text-sm">No closed deals yet.</td></tr>
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 4. AI & Charts Column */}
                <div className="space-y-6">
                    {/* Monthly Chart */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-64 flex flex-col">
                         <div className="flex justify-between items-center mb-4">
                            <h4 className="text-xs font-bold text-gray-500 uppercase">Monthly Performance</h4>
                            <div className="flex space-x-1">
                                <button onClick={() => setChartMode('INCOME')} className={`w-2 h-2 rounded-full ${chartMode === 'INCOME' ? 'bg-brand-red' : 'bg-gray-300'}`}/>
                                <button onClick={() => setChartMode('VOLUME')} className={`w-2 h-2 rounded-full ${chartMode === 'VOLUME' ? 'bg-blue-500' : 'bg-gray-300'}`}/>
                            </div>
                         </div>
                         <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                                    <RechartsTooltip 
                                        cursor={{fill: '#f8fafc'}}
                                        contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                                        formatter={(value: number) => [`$${value.toLocaleString()}`, chartMode === 'INCOME' ? 'Comm.' : 'Vol.']}
                                    />
                                    <Bar 
                                        dataKey={chartMode === 'INCOME' ? 'commission' : 'volume'} 
                                        fill={chartMode === 'INCOME' ? '#CD1337' : '#3B82F6'} 
                                        radius={[4, 4, 0, 0]} 
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                         </div>
                    </div>

                    {/* AI Revenue Strategy */}
                    <div className="bg-brand-light rounded-xl border border-brand-gold/30 overflow-hidden shadow-sm flex flex-col h-auto">
                        <div className="bg-brand-gold/10 p-4 border-b border-brand-gold/20 flex justify-between items-center">
                            <div className="flex items-center space-x-2 text-brand-dark">
                                <Sparkles size={16} className="text-brand-gold"/>
                                <h3 className="font-bold text-sm">Income Gap Strategy</h3>
                            </div>
                            <button 
                                onClick={handleGenerateStrategy}
                                disabled={isStrategizing}
                                className="text-[10px] bg-white hover:bg-white/80 border border-brand-gold/30 text-brand-dark px-2 py-1 rounded transition-colors disabled:opacity-50 flex items-center"
                            >
                                {isStrategizing ? <Loader2 size={10} className="animate-spin mr-1"/> : <Target size={10} className="mr-1"/>}
                                {gapStrategy ? "Refresh" : "Analyze"}
                            </button>
                        </div>
                        <div className="p-4 text-xs leading-relaxed">
                            {isStrategizing ? (
                                <div className="flex flex-col items-center justify-center py-4 text-gray-500">
                                    <Loader2 size={20} className="animate-spin mb-2"/>
                                    <span>Analyzing pipeline...</span>
                                </div>
                            ) : gapStrategy ? (
                                <div className="prose prose-sm max-w-none">
                                    <MarkdownRenderer content={gapStrategy} />
                                </div>
                            ) : (
                                <p className="text-gray-500 italic text-center">
                                    Click analyze to generate a plan to close the ${(incomeGap > 0 ? incomeGap : 0).toLocaleString()} gap.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};