import React, { useState, useMemo, useEffect } from 'react';
import { DollarSign, TrendingUp, ShieldCheck, Briefcase, CheckCircle2, PlayCircle, PlusCircle, Sparkles, Loader2, ArrowUpRight } from 'lucide-react';
import { loadFromStorage, saveToStorage, StorageKeys } from '../services/storageService';
import { Client } from '../types';
import { analyzeIncomeProjection } from '../services/geminiService';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ReferenceLine, CartesianGrid } from 'recharts';
import { useToast } from './Toast';

export const CompensationTracker: React.FC = () => {
    const { showToast } = useToast();
    const [clients, setClients] = useState<Client[]>(() => loadFromStorage(StorageKeys.CLIENTS, []));
    
    // "The Unicorn Role" Constants
    const HOURLY_RATE = 24.52;
    const ANNUAL_BASE = 51001;
    const TARGET_ANNUAL_INCOME = 108750;
    const BANKER_BPS = 0.0055; // 55 BPS blended average for April
    const ASSISTANT_SPLIT = 0.15; // 15% cut

    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    useEffect(() => {
        saveToStorage(StorageKeys.CLIENTS, clients);
    }, [clients]);

    // Calculate YTD Base (Simulation: Assumes we are in month 4)
    const currentMonth = new Date().getMonth() + 1; // 1-indexed
    const ytdBase = (ANNUAL_BASE / 12) * currentMonth;

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
    }, [closedClients]);

    const ytdCommission = closedData.reduce((acc, deal) => acc + deal.myCut, 0);

    const totalYtdIncome = ytdBase + ytdCommission;
    const percentToGoal = (totalYtdIncome / TARGET_ANNUAL_INCOME) * 100;

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
    }, [activeClients]);

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

    const generateHighVolumePipeline = () => {
        const firstNames = ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra'];
        const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson'];
        const streets = ['Oak', 'Maple', 'Cedar', 'Elm', 'Washington', 'Lake', 'Hill', 'Highland', 'Market', 'Main', 'Park', 'Sunset', 'Ridge', 'Meadow', 'Aspen'];
        const cities = ['San Francisco', 'Palo Alto', 'Atherton', 'Los Altos', 'Burlingame', 'Menlo Park', 'Hillsborough', 'Tiburon', 'Sausalito', 'Mill Valley'];

        const createClient = (status: string, isHistorical: boolean = false): Client => {
            const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
            const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
            // Loan Amount: Weighted towards Jumbo ($800k - $4.5M)
            const loan = Math.floor(Math.random() * (4500000 - 800000) + 800000); 
            const address = `${Math.floor(Math.random() * 9999)} ${streets[Math.floor(Math.random() * streets.length)]} St, ${cities[Math.floor(Math.random() * cities.length)]}`;
            
            let dateStr;
            if (isHistorical) {
                // Generate a date between Jan 1st of current year and today
                const now = new Date();
                const startOfYear = new Date(now.getFullYear(), 0, 1);
                const timeDiff = now.getTime() - startOfYear.getTime();
                const randomTime = Math.random() * timeDiff;
                const d = new Date(startOfYear.getTime() + randomTime);
                dateStr = d.toISOString().split('T')[0];
            } else {
                // Future date for active pipeline
                const d = new Date();
                d.setDate(d.getDate() + Math.floor(Math.random() * 60)); // Next 60 days
                dateStr = d.toISOString().split('T')[0];
            }

            return {
                id: `sim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: `${fn} ${ln}`,
                email: `${fn.toLowerCase()}.${ln.toLowerCase()}@example.com`,
                phone: `(555) ${Math.floor(Math.random() * 899 + 100)}-${Math.floor(Math.random() * 8999 + 1000)}`,
                loanAmount: loan,
                propertyAddress: address,
                status: status,
                nextActionDate: dateStr,
                notes: 'Simulated high-net-worth portfolio client.',
                checklist: [],
                emailHistory: []
            };
        };

        const newClients: Client[] = [];
        
        // Generate a $70M Year Pace Pipeline
        // ~22 Closed YTD (Historical)
        for(let i=0; i<22; i++) newClients.push(createClient('Closed', true));
        // ~4 Clear to Close
        for(let i=0; i<4; i++) newClients.push(createClient('Clear to Close'));
        // ~7 Underwriting
        for(let i=0; i<7; i++) newClients.push(createClient('Underwriting'));
        // ~12 Pre-Approval
        for(let i=0; i<12; i++) newClients.push(createClient('Pre-Approval'));
        // ~15 Leads
        for(let i=0; i<15; i++) newClients.push(createClient('Lead'));

        return newClients;
    };

    const handleInjectSchlingman = () => {
         const schlingman: Client = {
            id: `sim-schlingman-${Date.now()}`,
            name: 'Steven & Sophia Schlingman',
            email: 'steven.schlingman@example.com',
            phone: '(415) 555-8822',
            loanAmount: 3000000,
            propertyAddress: '1288 California St, San Francisco',
            status: 'Underwriting',
            nextActionDate: new Date().toISOString().split('T')[0],
            notes: 'VIP Client. $3M Jumbo. Fast track requested.',
            checklist: [{ id: 'chk-1', label: 'Verify Trust Docs', checked: false }],
            emailHistory: []
        };
        setClients(prev => [schlingman, ...prev]);
        showToast('Schlingman Deal ($3M) Added!', 'success');
    };

    const handleSimulateScenario = () => {
        // Removed confirm dialog to ensure execution
        const simulationData = generateHighVolumePipeline();
        
        // Add Schlingman to the batch
        simulationData.unshift({
            id: `sim-schlingman-${Date.now()}`,
            name: 'Steven & Sophia Schlingman',
            email: 'steven.schlingman@example.com',
            phone: '(415) 555-8822',
            loanAmount: 3000000,
            propertyAddress: '1288 California St, San Francisco',
            status: 'Underwriting',
            nextActionDate: new Date().toISOString().split('T')[0],
            notes: 'VIP Client. $3M Jumbo. Fast track requested.',
            checklist: [{ id: 'chk-1', label: 'Verify Trust Docs', checked: false }],
            emailHistory: []
        });

        setClients(prev => [...simulationData, ...prev]);
        showToast('Full $70M Pipeline (60+ Deals) Loaded!', 'success');
    };

    const chartData = [
        { name: 'Base Salary', amount: ANNUAL_BASE, fill: '#1E293B' },
        { name: 'YTD Comm.', amount: ytdCommission, fill: '#F4B23E' },
        { name: 'Projected', amount: projectedCommission, fill: '#CD1337' },
    ];

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in pb-20 md:pb-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-brand-dark tracking-tight flex items-center">
                        <ShieldCheck className="mr-3 text-brand-gold" size={32}/>
                        Wealth & Performance
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">"The Unicorn Role" - Compensation Tracker</p>
                </div>
                <div className="flex flex-col md:flex-row items-end md:items-center gap-4 w-full md:w-auto">
                    <button 
                        onClick={handleInjectSchlingman}
                        className="bg-white hover:bg-gray-50 text-brand-dark border border-gray-200 px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center whitespace-nowrap"
                    >
                        <PlusCircle size={16} className="mr-2 text-green-600"/>
                        Add Schlingman ($3M)
                    </button>
                    <button 
                        onClick={handleSimulateScenario}
                        className="bg-white hover:bg-gray-50 text-brand-dark border border-gray-200 px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center whitespace-nowrap"
                    >
                        <PlayCircle size={16} className="mr-2 text-brand-red"/>
                        Load Full $70M Pipeline
                    </button>
                    <div className="bg-gradient-to-r from-brand-dark to-slate-800 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
                        <div className="text-right">
                            <span className="block text-xs text-brand-gold uppercase tracking-wider font-bold">Annual Target</span>
                            <span className="text-2xl font-bold">${TARGET_ANNUAL_INCOME.toLocaleString()}</span>
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
                        <span className="text-3xl font-bold text-brand-dark">${(HOURLY_RATE * 40 * 52).toLocaleString()}</span>
                        <span className="text-sm text-gray-400">/ yr</span>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-sm">
                        <span className="text-gray-500">Hourly Rate</span>
                        <span className="font-semibold text-gray-800">${HOURLY_RATE}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                         <span className="text-gray-500">Rent Covered</span>
                         <span className="text-green-600 font-bold flex items-center"><ShieldCheck size={12} className="mr-1"/> 100%</span>
                    </div>
                </div>

                {/* Commission Pool Card */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden group">
                     <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp size={64} className="text-brand-red"/>
                    </div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Growth Engine (15% Cut)</p>
                    <div className="flex items-baseline space-x-1">
                        <span className="text-3xl font-bold text-brand-red">${ytdCommission.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                        <span className="text-sm text-gray-400">YTD</span>
                    </div>
                     <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-sm">
                        <span className="text-gray-500">April's Gross (Est)</span>
                        <span className="font-semibold text-gray-800">${(ytdCommission / ASSISTANT_SPLIT).toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                         <span className="text-gray-500">Avg Deal Value</span>
                         <span className="text-brand-red font-bold">~$575.00</span>
                    </div>
                </div>

                 {/* Paycheck Projector */}
                 <div className="bg-brand-dark text-white p-6 rounded-xl shadow-lg relative overflow-hidden">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-brand-gold rounded-full opacity-20 blur-xl"></div>
                    <p className="text-xs font-bold text-brand-gold uppercase tracking-wider mb-2">Next "Wealth Check"</p>
                    <div className="flex items-baseline space-x-1">
                        <span className="text-3xl font-bold text-white">
                            ${(2080 + (projectedCommission / 3)).toLocaleString(undefined, {maximumFractionDigits:0})}*
                        </span>
                        <span className="text-sm text-gray-400">est. net</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2 leading-tight">
                        *Projection includes base pay + 1/3 of weighted pipeline closing this month. 
                        Hit your "Magic Months" (3 paychecks) in May & November.
                    </p>
                    <div className="mt-4 w-full bg-gray-700 rounded-full h-1.5">
                        <div className="bg-brand-gold h-1.5 rounded-full" style={{width: `${Math.min(percentToGoal, 100)}%`}}></div>
                    </div>
                    <div className="flex justify-between text-[10px] mt-1 text-gray-400">
                        <span>Progress to $108k</span>
                        <span>{percentToGoal.toFixed(1)}%</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Pipeline Table */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col max-h-[500px]">
                    <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center sticky top-0 z-10">
                        <h3 className="font-bold text-gray-800 flex items-center">
                            <DollarSign size={16} className="mr-2 text-brand-dark"/>
                            Active Pipeline Commission
                        </h3>
                        <span className="text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded border">Volume Arbitrage Model</span>
                    </div>
                    <div className="overflow-y-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase bg-gray-50">Client</th>
                                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase bg-gray-50">Status</th>
                                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase text-right bg-gray-50">Loan Vol</th>
                                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase text-right text-brand-red bg-gray-50">Your Cut (15%)</th>
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
                                            No active deals in pipeline to calculate.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-gray-50 border-t border-gray-200 sticky bottom-0">
                                <tr>
                                    <td colSpan={3} className="px-4 py-3 text-right font-bold text-gray-600 text-xs uppercase">Total Pipeline Potential</td>
                                    <td className="px-4 py-3 text-right font-bold text-brand-red text-sm">
                                        ${pipelineData.reduce((a, b) => a + b.myCut, 0).toLocaleString()}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* AI Analysis & Chart */}
                <div className="space-y-6">
                    {/* Chart */}
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
                                <ReferenceLine y={TARGET_ANNUAL_INCOME} stroke="red" strokeDasharray="3 3" />
                                <Bar dataKey="amount" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* AI Advisor */}
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
                                    <p className="text-xs text-gray-500 mb-2">Click refresh to analyze your pipeline against the $108k target.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Monthly Breakdown Section */}
            <div className="mt-8 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="font-bold text-gray-800 flex items-center">
                            <TrendingUp size={18} className="mr-2 text-brand-dark"/>
                            Monthly Commission Trends
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                            Realized income performance by month (YTD).
                        </p>
                    </div>
                     <div className="text-right">
                         <span className="block text-xs text-gray-400 uppercase font-bold">Avg Monthly Comm.</span>
                         <span className="text-lg font-bold text-brand-dark">
                             ${(ytdCommission / (monthlyData.filter(m => m.commission > 0).length || 1)).toLocaleString(undefined, {maximumFractionDigits: 0})}
                         </span>
                    </div>
                </div>

                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyData} margin={{top: 10, right: 10, left: 0, bottom: 0}}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                                dataKey="month" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{fontSize: 12, fill: '#64748b'}} 
                                dy={10}
                            />
                            <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{fontSize: 12, fill: '#64748b'}}
                                tickFormatter={(value) => `$${value/1000}k`}
                            />
                            <RechartsTooltip 
                                cursor={{fill: '#f8fafc'}}
                                contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                                formatter={(value: number, name: string, props: any) => {
                                    if (name === 'commission') return [`$${value.toLocaleString()}`, 'Commission'];
                                    return [value, name];
                                }}
                                labelStyle={{fontWeight: 'bold', color: '#1e293b'}}
                            />
                            <Bar 
                                dataKey="commission" 
                                name="Commission" 
                                fill="#CD1337" 
                                radius={[4, 4, 0, 0]} 
                                barSize={40}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Realized Income Breakdown */}
            <div className="mt-8 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col max-h-[500px]">
                <div className="p-5 border-b border-gray-200 bg-gray-50 flex justify-between items-center sticky top-0 z-10">
                    <div>
                        <h3 className="font-bold text-gray-800 flex items-center">
                            <CheckCircle2 size={18} className="mr-2 text-green-600"/>
                            Commission Breakdown (Closed Deals)
                        </h3>
                        <p className="text-xs text-gray-500 mt-1 pl-6">
                            Detailed calculation of your 15% cut from realized bank revenue.
                        </p>
                    </div>
                    <div className="text-right">
                         <span className="block text-xs text-gray-400 uppercase font-bold">Total Earned</span>
                         <span className="text-xl font-bold text-green-600">${ytdCommission.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                </div>
                <div className="overflow-y-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/50 border-b border-gray-100 sticky top-0">
                            <tr>
                                <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase bg-gray-50">Client</th>
                                <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase bg-gray-50">Loan Amount</th>
                                <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase text-right bg-gray-50">Banker Gross (55bps)</th>
                                <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase text-right text-brand-red bg-gray-50">Your Cut (15%)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {closedData.map((deal) => (
                                <tr key={deal.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-900">{deal.name}</td>
                                    <td className="px-6 py-4 text-gray-600 font-mono">
                                        ${(deal.loanAmount).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-500 font-mono">
                                        ${deal.bankerGross.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-brand-dark font-mono bg-green-50/30">
                                        ${deal.myCut.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                    </td>
                                </tr>
                            ))}
                            {closedData.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-gray-400 text-sm">
                                        No closed deals yet. Move clients to "Closed" status to populate this ledger.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};