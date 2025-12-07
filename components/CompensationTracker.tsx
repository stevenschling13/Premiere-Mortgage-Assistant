import React, { useState, useMemo, useEffect } from 'react';
import { DollarSign, TrendingUp, ShieldCheck, Briefcase, CheckCircle2, Settings, ArrowUpRight, Loader2, Sparkles, X } from 'lucide-react';
import { loadFromStorage, saveToStorage, StorageKeys } from '../services/storageService';
import { Client, UserProfile } from '../types';
import { analyzeIncomeProjection } from '../services/geminiService';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ReferenceLine, CartesianGrid } from 'recharts';
import { useToast } from './Toast';

const DEFAULT_PROFILE: UserProfile = {
    baseSalary: 50000,
    commissionBps: 55, // 0.55%
    splitPercentage: 15, // 15%
    annualIncomeGoal: 100000
};

export const CompensationTracker: React.FC = () => {
    const { showToast } = useToast();
    const [clients, setClients] = useState<Client[]>(() => loadFromStorage(StorageKeys.CLIENTS, []));
    
    // User Settings State
    const [profile, setProfile] = useState<UserProfile>(() => loadFromStorage(StorageKeys.USER_PROFILE, DEFAULT_PROFILE));
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [tempProfile, setTempProfile] = useState<UserProfile>(profile);

    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    useEffect(() => {
        saveToStorage(StorageKeys.CLIENTS, clients);
    }, [clients]);

    useEffect(() => {
        saveToStorage(StorageKeys.USER_PROFILE, profile);
    }, [profile]);

    // Derived Constants from Profile
    const HOURLY_RATE = profile.baseSalary / 2080; // approx 2080 work hours
    const BANKER_BPS = profile.commissionBps / 10000; 
    const ASSISTANT_SPLIT = profile.splitPercentage / 100;

    // Calculate YTD Base (Simulation: Assumes we are in month 4 for context, or just prorate)
    // For production, let's just show annual base stats and realized YTD base
    const currentMonth = new Date().getMonth() + 1; // 1-indexed
    const ytdBase = (profile.baseSalary / 12) * currentMonth;

    // Calculate Commissions from Closed Deals
    const closedClients = clients.filter(c => c.status === 'Closed');
    
    const closedData = useMemo(() => {
        return closedClients.map(client => {
            const bankerGross = client.loanAmount * BANKER_BPS;
            const myCut = bankerGross * ASSISTANT_SPLIT;
            return {
                ...client,
                bankerGross,
                myCut
            };
        }).sort((a, b) => b.myCut - a.myCut);
    }, [closedClients, BANKER_BPS, ASSISTANT_SPLIT]);

    const ytdCommission = closedData.reduce((acc, deal) => acc + deal.myCut, 0);

    const totalYtdIncome = ytdBase + ytdCommission;
    const percentToGoal = (totalYtdIncome / profile.annualIncomeGoal) * 100;

    // Calculate Projected Pipeline Commission
    const activeClients = clients.filter(c => c.status !== 'Closed' && c.status !== 'Lead');
    
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
    }, [activeClients, BANKER_BPS, ASSISTANT_SPLIT]);

    const projectedCommission = pipelineData.reduce((acc, item) => acc + item.weightedValue, 0);

    // Monthly Breakdown Data
    const monthlyData = useMemo(() => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const currentMonthIndex = new Date().getMonth();
        
        const data = months.map((month, index) => ({
            month,
            commission: 0,
            volume: 0,
            deals: 0,
            index
        }));

        closedData.forEach(deal => {
            if (!deal.nextActionDate) return;
            const d = new Date(deal.nextActionDate);
            const mIndex = d.getMonth();
            if (mIndex >= 0 && mIndex < 12) {
                data[mIndex].commission += deal.myCut;
                data[mIndex].volume += deal.loanAmount;
                data[mIndex].deals += 1;
            }
        });

        // Return up to current month for cleaner chart
        return data.filter(d => d.index <= currentMonthIndex);
    }, [closedData]);

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        try {
            const result = await analyzeIncomeProjection(clients, ytdCommission);
            setAiAnalysis(result);
        } catch (e) {
            console.error(e);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSaveSettings = () => {
        setProfile(tempProfile);
        setIsSettingsOpen(false);
        showToast('Compensation settings updated', 'success');
    };

    const chartData = [
        { name: 'Base Salary', amount: profile.baseSalary, fill: '#1E293B' },
        { name: 'YTD Comm.', amount: ytdCommission, fill: '#F4B23E' },
        { name: 'Projected', amount: projectedCommission, fill: '#CD1337' },
    ];

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in pb-20 md:pb-8 relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-brand-dark tracking-tight flex items-center">
                        <ShieldCheck className="mr-3 text-brand-gold" size={32}/>
                        Wealth & Performance
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Track your income against targets.</p>
                </div>
                <div className="flex flex-col md:flex-row items-end md:items-center gap-4 w-full md:w-auto">
                    <button 
                        onClick={() => {
                            setTempProfile(profile);
                            setIsSettingsOpen(true);
                        }}
                        className="bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center whitespace-nowrap"
                    >
                        <Settings size={16} className="mr-2"/>
                        Configure Comp
                    </button>
                    
                    <div className="bg-gradient-to-r from-brand-dark to-slate-800 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
                        <div className="text-right">
                            <span className="block text-xs text-brand-gold uppercase tracking-wider font-bold">Annual Target</span>
                            <span className="text-2xl font-bold">${profile.annualIncomeGoal.toLocaleString()}</span>
                        </div>
                        <div className="h-10 w-px bg-white/20"></div>
                        <div className="text-right">
                            <span className="block text-xs text-gray-300 uppercase tracking-wider font-bold">YTD Actual</span>
                            <span className="text-xl font-bold text-green-400">${totalYtdIncome.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Base Salary Card */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Briefcase size={64} />
                    </div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">The Foundation (Salary)</p>
                    <div className="flex items-baseline space-x-1">
                        <span className="text-3xl font-bold text-brand-dark">${profile.baseSalary.toLocaleString()}</span>
                        <span className="text-sm text-gray-400">/ yr</span>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-sm">
                        <span className="text-gray-500">Hourly Rate (Est)</span>
                        <span className="font-semibold text-gray-800">${HOURLY_RATE.toFixed(2)}</span>
                    </div>
                </div>

                {/* Commission Pool Card */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden group">
                     <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp size={64} className="text-brand-red"/>
                    </div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Commission ({profile.splitPercentage}% Cut)</p>
                    <div className="flex items-baseline space-x-1">
                        <span className="text-3xl font-bold text-brand-red">${ytdCommission.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                        <span className="text-sm text-gray-400">YTD</span>
                    </div>
                     <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-sm">
                        <span className="text-gray-500">Avg Deal Value</span>
                        <span className="font-semibold text-gray-800">
                             {closedData.length > 0 
                                ? `$${(ytdCommission / closedData.length).toLocaleString(undefined, {maximumFractionDigits:0})}` 
                                : '$0'}
                        </span>
                    </div>
                </div>

                 {/* Paycheck Projector */}
                 <div className="bg-brand-dark text-white p-6 rounded-xl shadow-lg relative overflow-hidden">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-brand-gold rounded-full opacity-20 blur-xl"></div>
                    <p className="text-xs font-bold text-brand-gold uppercase tracking-wider mb-2">Projected Monthly Net</p>
                    <div className="flex items-baseline space-x-1">
                        <span className="text-3xl font-bold text-white">
                            ${((profile.baseSalary / 26) + (projectedCommission / 3)).toLocaleString(undefined, {maximumFractionDigits:0})}*
                        </span>
                        <span className="text-sm text-gray-400">est</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2 leading-tight">
                        *Projection includes bi-weekly base + 1/3 of weighted pipeline closing soon.
                    </p>
                    <div className="mt-4 w-full bg-gray-700 rounded-full h-1.5">
                        <div className="bg-brand-gold h-1.5 rounded-full" style={{width: `${Math.min(percentToGoal, 100)}%`}}></div>
                    </div>
                    <div className="flex justify-between text-[10px] mt-1 text-gray-400">
                        <span>Progress to Goal</span>
                        <span>{percentToGoal.toFixed(1)}%</span>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Pipeline Table */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col max-h-[500px]">
                    <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center sticky top-0 z-10">
                        <h3 className="font-bold text-gray-800 flex items-center">
                            <DollarSign size={16} className="mr-2 text-brand-dark"/>
                            Active Pipeline Commission
                        </h3>
                    </div>
                    <div className="overflow-y-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase bg-gray-50">Client</th>
                                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase bg-gray-50">Status</th>
                                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase text-right bg-gray-50">Loan Vol</th>
                                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase text-right text-brand-red bg-gray-50">Your Cut</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {pipelineData.map((deal) => (
                                    <tr key={deal.id} className="hover:bg-gray-50 transition-colors group">
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
                                        <td className="px-4 py-3 text-right font-bold text-brand-dark font-mono group-hover:text-brand-red transition-colors">
                                            ${deal.myCut.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                        </td>
                                    </tr>
                                ))}
                                {pipelineData.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-gray-400 text-sm">
                                            No active deals. Add clients in Dashboard to see projections.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* AI Analysis & Chart */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-64">
                         <h4 className="text-xs font-bold text-gray-500 uppercase mb-4">Income Composition</h4>
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{top: 5, right: 5, bottom: 20, left: 0}}>
                                <XAxis dataKey="name" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                                <RechartsTooltip 
                                    cursor={{fill: 'transparent'}}
                                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Amount']}
                                />
                                <ReferenceLine y={profile.annualIncomeGoal} stroke="red" strokeDasharray="3 3" />
                                <Bar dataKey="amount" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="bg-brand-light rounded-xl border border-brand-gold/30 overflow-hidden shadow-sm">
                        <div className="bg-brand-gold/10 p-4 border-b border-brand-gold/20 flex justify-between items-center">
                            <div className="flex items-center space-x-2">
                                <Sparkles size={16} className="text-brand-dark"/>
                                <span className="text-xs font-bold text-brand-dark uppercase tracking-wider">Wealth Projector</span>
                            </div>
                            <button 
                                onClick={handleAnalyze}
                                disabled={isAnalyzing}
                                className="text-xs bg-white hover:bg-white/80 border border-brand-gold/30 px-3 py-1 rounded-full transition-colors flex items-center"
                            >
                                {isAnalyzing ? <Loader2 size={12} className="animate-spin mr-1"/> : <ArrowUpRight size={12} className="mr-1"/>}
                                {isAnalyzing ? 'Analyzing...' : 'Refresh Projection'}
                            </button>
                        </div>
                        <div className="p-5">
                            {aiAnalysis ? (
                                <div className="text-sm text-gray-700 leading-relaxed space-y-4 font-sans">
                                    {aiAnalysis.split('\n\n').map((paragraph, idx) => (
                                        <p key={idx}>{paragraph}</p>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6">
                                    <p className="text-xs text-gray-500 mb-2">Click refresh to analyze your pipeline against your ${profile.annualIncomeGoal.toLocaleString()} target.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Settings Modal */}
            {isSettingsOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-up">
                        <div className="bg-brand-dark text-white p-4 flex justify-between items-center">
                            <h3 className="font-bold flex items-center">
                                <Settings size={18} className="mr-2"/> 
                                Compensation Settings
                            </h3>
                            <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Annual Base Salary</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-gray-400">$</span>
                                    <input 
                                        type="number"
                                        value={tempProfile.baseSalary}
                                        onChange={(e) => setTempProfile({...tempProfile, baseSalary: parseFloat(e.target.value) || 0})}
                                        className="w-full pl-6 p-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-red outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Total Commission (Basis Points)</label>
                                <div className="relative">
                                    <input 
                                        type="number"
                                        value={tempProfile.commissionBps}
                                        onChange={(e) => setTempProfile({...tempProfile, commissionBps: parseFloat(e.target.value) || 0})}
                                        className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-red outline-none"
                                    />
                                    <span className="absolute right-3 top-2.5 text-gray-400 text-xs">bps</span>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1">Total bps earned by the banker on loan volume (e.g., 55).</p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Your Split Percentage</label>
                                <div className="relative">
                                    <input 
                                        type="number"
                                        value={tempProfile.splitPercentage}
                                        onChange={(e) => setTempProfile({...tempProfile, splitPercentage: parseFloat(e.target.value) || 0})}
                                        className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-red outline-none"
                                    />
                                    <span className="absolute right-3 top-2.5 text-gray-400">%</span>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1">Percentage of the gross commission that you keep.</p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Annual Income Goal</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-gray-400">$</span>
                                    <input 
                                        type="number"
                                        value={tempProfile.annualIncomeGoal}
                                        onChange={(e) => setTempProfile({...tempProfile, annualIncomeGoal: parseFloat(e.target.value) || 0})}
                                        className="w-full pl-6 p-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-red outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 flex justify-end space-x-2">
                            <button 
                                onClick={() => setIsSettingsOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSaveSettings}
                                className="px-4 py-2 text-sm font-bold text-white bg-brand-red rounded-lg hover:bg-red-700 shadow-sm"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};