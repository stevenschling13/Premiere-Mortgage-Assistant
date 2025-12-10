
import React, { useState, useEffect } from 'react';
import { DollarSign, AlertCircle, CheckCircle2, TrendingUp, Calculator, Stethoscope, Loader2, RefreshCcw, Briefcase, Coins, X, Save, Upload, BookOpen } from 'lucide-react';
import { loadFromStorage, saveToStorage, StorageKeys, solveDtiScenario } from '../services';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useToast } from './Toast';
import { Client } from '../types';
import { AGENCY_GUIDELINES, VA_RESIDUAL_INCOME_TABLE, VA_REGIONS, VA_ADDITIONAL_MEMBER_AMOUNT } from '../constants';

const DEFAULT_INCOME = { baseSalary: 25000, bonus: 5000, rsu: 8000, other: 0 };
const DEFAULT_DEBTS = { creditCards: 500, carLoans: 1200, studentLoans: 0, otherRealEstate: 2500, otherLoans: 0 };

type LoanType = 'CONVENTIONAL' | 'FHA' | 'VA' | 'JUMBO';
type VaRegion = typeof VA_REGIONS[number];

export const DtiAnalysis: React.FC = () => {
    const { showToast } = useToast();
    
    // Persisted State (Global Default)
    const [income, setIncome] = useState(() => loadFromStorage(StorageKeys.DTI_DATA, { income: DEFAULT_INCOME, debts: DEFAULT_DEBTS, proposedHousing: 14500 }).income);
    const [debts, setDebts] = useState(() => loadFromStorage(StorageKeys.DTI_DATA, { income: DEFAULT_INCOME, debts: DEFAULT_DEBTS, proposedHousing: 14500 }).debts);
    const [proposedHousing, setProposedHousing] = useState(() => loadFromStorage(StorageKeys.DTI_DATA, { income: DEFAULT_INCOME, debts: DEFAULT_DEBTS, proposedHousing: 14500 }).proposedHousing);
    const [liquidAssets, setLiquidAssets] = useState(0);

    // AI State
    const [isSolving, setIsSolving] = useState(false);
    const [dealDoctorAdvice, setDealDoctorAdvice] = useState<string | null>(null);

    // Calc UI State
    const [showBooster, setShowBooster] = useState(false);
    const [rsuCalc, setRsuCalc] = useState({ value: 0, years: 3 });
    const [assetCalc, setAssetCalc] = useState({ value: 0, months: 240 });
    
    // Loan Specific State
    const [selectedLoanType, setSelectedLoanType] = useState<LoanType>('CONVENTIONAL');
    const [hasAusApproval, setHasAusApproval] = useState(true); // FHA/Conventional AUS status
    const [vaRegion, setVaRegion] = useState<VaRegion>('WEST');
    const [vaFamilySize, setVaFamilySize] = useState(4);

    // Client Link State
    const [clients, setClients] = useState<Client[]>(() => loadFromStorage(StorageKeys.CLIENTS, []));
    const [selectedClientId, setSelectedClientId] = useState('');

    // Save on change (Global)
    useEffect(() => {
        saveToStorage(StorageKeys.DTI_DATA, { income, debts, proposedHousing });
    }, [income, debts, proposedHousing]);

    // Calculations
    const totalMonthlyIncome = (Object.values(income) as number[]).reduce((a, b) => a + b, 0);
    const totalMonthlyDebts = (Object.values(debts) as number[]).reduce((a, b) => a + b, 0);
    
    const frontEndRatio = totalMonthlyIncome > 0 ? (proposedHousing / totalMonthlyIncome) * 100 : 0;
    const backEndRatio = totalMonthlyIncome > 0 ? ((proposedHousing + totalMonthlyDebts) / totalMonthlyIncome) * 100 : 0;

    // Guideline Checking
    const guidelines = AGENCY_GUIDELINES[selectedLoanType];
    
    // Determine effective max DTI based on AUS toggle
    let effectiveMaxDti = guidelines.maxDTI;
    if (selectedLoanType === 'FHA' && !hasAusApproval && 'manualDTI' in guidelines) {
        effectiveMaxDti = guidelines.manualDTI ?? 43.00;
    }

    const isOverStandard = backEndRatio > guidelines.standardDTI;
    const isHardStop = backEndRatio > effectiveMaxDti;

    // VA Residual Income Calculation
    let requiredResidual = 0;
    if (selectedLoanType === 'VA') {
        const baseIndex = Math.min(vaFamilySize, 5) - 1;
        const baseAmount = VA_RESIDUAL_INCOME_TABLE[vaRegion][baseIndex];
        const additionalAmount = Math.max(0, vaFamilySize - 5) * VA_ADDITIONAL_MEMBER_AMOUNT;
        requiredResidual = baseAmount + additionalAmount;
    }

    const handleIncomeChange = (field: keyof typeof income, val: string) => {
        const num = val === '' ? 0 : parseFloat(val);
        setIncome({...income, [field]: isNaN(num) ? 0 : num});
    };

    const handleDebtChange = (field: keyof typeof debts, val: string) => {
        const num = val === '' ? 0 : parseFloat(val);
        setDebts({...debts, [field]: isNaN(num) ? 0 : num});
    };

    const handleRunDealDoctor = async () => {
        if (!isOverStandard && selectedLoanType !== 'VA') {
            showToast("Deal qualifies under standard guidelines!", "success");
            return;
        }
        
        setIsSolving(true);
        setDealDoctorAdvice(null);
        try {
            const financials = {
                totalIncome: totalMonthlyIncome,
                proposedHousing,
                debts,
                liquidAssets,
                loanType: selectedLoanType,
                hasAusApproval,
                requiredResidual: selectedLoanType === 'VA' ? requiredResidual : undefined
            };
            const advice = await solveDtiScenario(financials);
            setDealDoctorAdvice(advice ?? null);
        } catch (e) {
            console.error(e);
            showToast("DTI Optimizer unavailable.", "error");
        } finally {
            setIsSolving(false);
        }
    };

    const applyRsuIncome = () => {
        if (rsuCalc.value <= 0) return;
        const monthly = (rsuCalc.value * 0.75) / (rsuCalc.years * 12);
        setIncome({ ...income, rsu: Math.round(monthly) });
        showToast(`Applied $${Math.round(monthly).toLocaleString()}/mo RSU Income`, 'success');
    };

    const applyAssetIncome = () => {
        if (assetCalc.value <= 0) return;
        const monthly = (assetCalc.value * 0.7) / assetCalc.months;
        setIncome({ ...income, other: (income.other || 0) + Math.round(monthly) });
        showToast(`Added $${Math.round(monthly).toLocaleString()}/mo Asset Income`, 'success');
    };

    const handleSaveToClient = () => {
        if (!selectedClientId) {
            showToast('Select a client first', 'error');
            return;
        }
        const updatedClients = clients.map(c => {
            if (c.id === selectedClientId) {
                return {
                    ...c,
                    financialProfile: {
                        totalIncome: totalMonthlyIncome,
                        totalDebts: totalMonthlyDebts,
                        proposedHousing: proposedHousing,
                        liquidAssets: liquidAssets
                    }
                };
            }
            return c;
        });
        setClients(updatedClients);
        saveToStorage(StorageKeys.CLIENTS, updatedClients);
        showToast('Financials saved to client record', 'success');
    };

    return (
        <div className="p-8 max-w-5xl mx-auto animate-fade-in pb-20">
             <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-brand-dark">Affordability & DTI Analysis</h2>
                    <p className="text-gray-500 mt-1">Analyze borrower qualification against Agency Guidelines.</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setShowBooster(!showBooster)}
                        className={`flex items-center space-x-2 px-5 py-3 rounded-xl transition-all shadow-sm active:scale-95 ${
                            showBooster ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                        }`}
                    >
                        <TrendingUp size={18} />
                        <span className="font-bold text-sm">Income Tools</span>
                    </button>
                    <button 
                        onClick={handleRunDealDoctor}
                        disabled={isSolving}
                        className="flex items-center space-x-2 bg-brand-dark text-white px-5 py-3 rounded-xl hover:bg-gray-800 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                    >
                        {isSolving ? <Loader2 size={18} className="animate-spin" /> : <Stethoscope size={18} className="text-brand-gold" />}
                        <span className="font-bold text-sm">DTI Optimizer</span>
                    </button>
                </div>
            </div>

            {/* Client Sync Bar */}
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                    <span className="text-xs font-bold text-gray-500 uppercase">Sync with Client:</span>
                    <select 
                        value={selectedClientId} 
                        onChange={(e) => setSelectedClientId(e.target.value)}
                        className="p-2 bg-white border border-gray-200 rounded-lg text-sm w-full max-w-xs"
                    >
                        <option value="">Select a client...</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <button 
                    onClick={handleSaveToClient}
                    disabled={!selectedClientId}
                    className="ml-3 flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 hover:border-brand-gold text-gray-700 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                >
                    <Save size={14} className="text-green-600"/>
                    <span>Save to Record</span>
                </button>
            </div>

            {showBooster && (
                <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                    {/* RSU Calculator */}
                    <div className="bg-indigo-50 border border-indigo-200 p-5 rounded-xl relative">
                        <h4 className="font-bold text-indigo-900 flex items-center mb-3 text-sm uppercase tracking-wide">
                            <Briefcase size={14} className="mr-2"/> RSU Income Calc
                        </h4>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-indigo-700">Total Unvested Value</label>
                                <input 
                                    type="number" 
                                    value={rsuCalc.value} 
                                    onChange={(e) => setRsuCalc({...rsuCalc, value: parseFloat(e.target.value)})} 
                                    className="w-full p-2 text-sm border border-indigo-200 rounded bg-white"
                                />
                            </div>
                            <div className="flex items-end gap-2">
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-indigo-700">Vesting Term (Yrs)</label>
                                    <input 
                                        type="number" 
                                        value={rsuCalc.years} 
                                        onChange={(e) => setRsuCalc({...rsuCalc, years: parseFloat(e.target.value)})} 
                                        className="w-full p-2 text-sm border border-indigo-200 rounded bg-white"
                                    />
                                </div>
                                <button onClick={applyRsuIncome} className="bg-indigo-600 text-white px-3 py-2 rounded text-xs font-bold hover:bg-indigo-700 h-[38px]">Apply</button>
                            </div>
                        </div>
                        <p className="text-[10px] text-indigo-400 mt-2">Applies 25% haircut / monthly avg.</p>
                    </div>

                    {/* Asset Depletion Calculator */}
                    <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-xl relative">
                        <h4 className="font-bold text-emerald-900 flex items-center mb-3 text-sm uppercase tracking-wide">
                            <Coins size={14} className="mr-2"/> Asset Depletion
                        </h4>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-emerald-700">Eligible Liquid Assets</label>
                                <input 
                                    type="number" 
                                    value={assetCalc.value} 
                                    onChange={(e) => setAssetCalc({...assetCalc, value: parseFloat(e.target.value)})} 
                                    className="w-full p-2 text-sm border border-emerald-200 rounded bg-white"
                                />
                            </div>
                            <div className="flex items-end gap-2">
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-emerald-700">Amortization (Mos)</label>
                                    <input 
                                        type="number" 
                                        value={assetCalc.months} 
                                        onChange={(e) => setAssetCalc({...assetCalc, months: parseFloat(e.target.value)})} 
                                        className="w-full p-2 text-sm border border-emerald-200 rounded bg-white"
                                    />
                                </div>
                                <button onClick={applyAssetIncome} className="bg-emerald-600 text-white px-3 py-2 rounded text-xs font-bold hover:bg-emerald-700 h-[38px]">Add</button>
                            </div>
                        </div>
                        <p className="text-[10px] text-emerald-500 mt-2">Applies 30% haircut / amortization term.</p>
                    </div>
                </div>
            )}

            {dealDoctorAdvice && (
                <div className="mb-8 bg-blue-50 border border-blue-200 rounded-xl p-6 relative animate-slide-up shadow-sm">
                    <div className="flex items-start space-x-4">
                        <div className="bg-white p-3 rounded-full border border-blue-100 shadow-sm">
                            <Stethoscope size={24} className="text-blue-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-blue-900 text-lg mb-2">Optimization Strategy</h3>
                            <div className="prose prose-sm text-blue-800 max-w-none">
                                <MarkdownRenderer content={dealDoctorAdvice} />
                            </div>
                        </div>
                        <button onClick={() => setDealDoctorAdvice(null)} className="text-blue-400 hover:text-blue-700">
                            <RefreshCcw size={16} />
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Inputs */}
                <div className="space-y-6">
                    {/* Income Section */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h3 className="text-lg font-bold text-brand-dark mb-4 border-b pb-2">Monthly Gross Income</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Base Salary</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-gray-400">$</span>
                                    <input type="number" inputMode="decimal" value={income.baseSalary} onChange={(e) => handleIncomeChange('baseSalary', e.target.value)} className="w-full pl-6 p-2 bg-gray-50 text-gray-900 rounded border border-gray-200 focus:bg-white focus:border-brand-red outline-none transition-colors" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Bonus / Commission</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-gray-400">$</span>
                                    <input type="number" inputMode="decimal" value={income.bonus} onChange={(e) => handleIncomeChange('bonus', e.target.value)} className="w-full pl-6 p-2 bg-gray-50 text-gray-900 rounded border border-gray-200 focus:bg-white focus:border-brand-red outline-none transition-colors" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">RSU / Stock (Vest)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-gray-400">$</span>
                                    <input type="number" inputMode="decimal" value={income.rsu} onChange={(e) => handleIncomeChange('rsu', e.target.value)} className="w-full pl-6 p-2 bg-gray-50 text-gray-900 rounded border border-gray-200 focus:bg-white focus:border-brand-red outline-none transition-colors" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Other</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-gray-400">$</span>
                                    <input type="number" inputMode="decimal" value={income.other} onChange={(e) => handleIncomeChange('other', e.target.value)} className="w-full pl-6 p-2 bg-gray-50 text-gray-900 rounded border border-gray-200 focus:bg-white focus:border-brand-red outline-none transition-colors" />
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 pt-3 border-t flex justify-between items-center">
                            <span className="text-sm font-semibold text-gray-600">Total Monthly Income</span>
                            <span className="text-lg font-bold text-green-600">${totalMonthlyIncome.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Debts Section */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h3 className="text-lg font-bold text-brand-dark mb-4 border-b pb-2">Monthly Liabilities</h3>
                        <div className="space-y-3">
                             <div className="flex items-center space-x-4">
                                <label className="w-1/3 text-sm text-gray-600">Credit Cards (Min)</label>
                                <input type="number" inputMode="decimal" value={debts.creditCards} onChange={(e) => handleDebtChange('creditCards', e.target.value)} className="flex-1 p-2 bg-gray-50 text-gray-900 rounded border border-gray-200 outline-none" />
                             </div>
                             <div className="flex items-center space-x-4">
                                <label className="w-1/3 text-sm text-gray-600">Auto Loans/Leases</label>
                                <input type="number" inputMode="decimal" value={debts.carLoans} onChange={(e) => handleDebtChange('carLoans', e.target.value)} className="flex-1 p-2 bg-gray-50 text-gray-900 rounded border border-gray-200 outline-none" />
                             </div>
                             <div className="flex items-center space-x-4">
                                <label className="w-1/3 text-sm text-gray-600">Student Loans</label>
                                <input type="number" inputMode="decimal" value={debts.studentLoans} onChange={(e) => handleDebtChange('studentLoans', e.target.value)} className="flex-1 p-2 bg-gray-50 text-gray-900 rounded border border-gray-200 outline-none" />
                             </div>
                             <div className="flex items-center space-x-4">
                                <label className="w-1/3 text-sm text-gray-600">Other Properties (PITIA)</label>
                                <input type="number" inputMode="decimal" value={debts.otherRealEstate} onChange={(e) => handleDebtChange('otherRealEstate', e.target.value)} className="flex-1 p-2 bg-gray-50 text-gray-900 rounded border border-gray-200 outline-none" />
                             </div>
                        </div>
                        <div className="mt-4 pt-3 border-t flex justify-between items-center">
                            <span className="text-sm font-semibold text-gray-600">Total Liabilities</span>
                            <span className="text-lg font-bold text-red-600">${totalMonthlyDebts.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* Results Section */}
                <div className="space-y-6">
                    {/* Loan Type Selector */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Loan Program Guideline Check</label>
                        <div className="grid grid-cols-4 gap-2 mb-4">
                            {(Object.keys(AGENCY_GUIDELINES) as LoanType[]).map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setSelectedLoanType(type)}
                                    className={`py-2 text-[10px] md:text-xs font-bold rounded-lg transition-all ${
                                        selectedLoanType === type 
                                        ? 'bg-brand-dark text-white shadow-md' 
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>

                        {/* Specific Controls based on Loan Type */}
                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                            {selectedLoanType === 'VA' && (
                                <div className="grid grid-cols-2 gap-3 animate-fade-in">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Region</label>
                                        <select 
                                            value={vaRegion} 
                                            onChange={(e) => setVaRegion(e.target.value as VaRegion)}
                                            className="w-full p-2 bg-white border border-gray-200 rounded text-xs"
                                        >
                                            {VA_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Family Size</label>
                                        <input 
                                            type="number" 
                                            min="1"
                                            value={vaFamilySize} 
                                            onChange={(e) => setVaFamilySize(parseInt(e.target.value) || 1)}
                                            className="w-full p-2 bg-white border border-gray-200 rounded text-xs"
                                        />
                                    </div>
                                    <div className="col-span-2 text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded font-medium flex items-center">
                                        <div className="mr-1">ℹ️</div> Required Residual Income: <span className="font-bold ml-1">${requiredResidual.toLocaleString()}</span>
                                    </div>
                                </div>
                            )}

                            {(selectedLoanType === 'FHA' || selectedLoanType === 'CONVENTIONAL') && (
                                <div className="flex items-center justify-between animate-fade-in">
                                    <span className="text-xs font-bold text-gray-600">Automated Underwriting (AUS)</span>
                                    <button 
                                        onClick={() => setHasAusApproval(!hasAusApproval)}
                                        className={`flex items-center px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                                            hasAusApproval ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                                        }`}
                                    >
                                        {hasAusApproval ? "Approved / Accept" : "Manual Underwrite"}
                                    </button>
                                </div>
                            )}
                            
                            {/* Liquid Assets Input for Reserves */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Verified Liquid Assets (Reserves)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-gray-400 text-xs">$</span>
                                    <input 
                                        type="number" 
                                        value={liquidAssets} 
                                        onChange={(e) => setLiquidAssets(parseFloat(e.target.value) || 0)} 
                                        className="w-full pl-6 p-2 bg-white border border-gray-200 rounded text-xs focus:ring-1 focus:ring-brand-gold outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-brand-dark text-white p-6 rounded-xl shadow-md">
                        <h3 className="text-lg font-bold mb-4">Proposed Housing Expense</h3>
                        <div className="relative mb-2">
                             <DollarSign className="absolute left-3 top-3.5 h-6 w-6 text-gray-400" />
                             <input 
                                type="number" 
                                inputMode="decimal"
                                value={proposedHousing} 
                                onChange={(e) => setProposedHousing(parseFloat(e.target.value)||0)}
                                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-2xl font-bold text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-gold outline-none"
                            />
                        </div>
                        <p className="text-xs text-gray-400">Enter total PITIA + HOA for subject property</p>
                    </div>

                    <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200 relative overflow-hidden">
                        <div className="mb-8">
                             <div className="flex justify-between items-end mb-2">
                                <span className="text-gray-500 font-medium">Front-End Ratio</span>
                                <span className="text-2xl font-bold text-brand-dark">{frontEndRatio.toFixed(2)}%</span>
                             </div>
                             <div className="w-full bg-gray-200 rounded-full h-3">
                                <div className="bg-brand-gold h-3 rounded-full" style={{width: `${Math.min(frontEndRatio, 100)}%`}}></div>
                             </div>
                        </div>

                        <div>
                             <div className="flex justify-between items-end mb-2">
                                <span className="text-gray-500 font-medium">Back-End Ratio (Total DTI)</span>
                                <span className={`text-3xl font-bold ${isHardStop ? 'text-red-600' : isOverStandard ? 'text-orange-500' : 'text-green-600'}`}>{backEndRatio.toFixed(2)}%</span>
                             </div>
                             <div className="w-full bg-gray-200 rounded-full h-4">
                                <div 
                                    className={`h-4 rounded-full transition-all duration-500 ${isHardStop ? 'bg-red-600' : isOverStandard ? 'bg-orange-400' : 'bg-green-500'}`} 
                                    style={{width: `${Math.min(backEndRatio, 100)}%`}}
                                ></div>
                             </div>
                             
                             <div className={`mt-4 flex items-start gap-3 p-3 rounded-lg border ${
                                 isHardStop ? 'bg-red-50 border-red-200' : 
                                 isOverStandard ? 'bg-orange-50 border-orange-200' : 
                                 'bg-green-50 border-green-200'
                             }`}>
                                {isHardStop ? <X className="text-red-500 shrink-0" size={18}/> : 
                                 isOverStandard ? <AlertCircle className="text-orange-500 shrink-0" size={18}/> : 
                                 <CheckCircle2 className="text-green-500 shrink-0" size={18}/>}
                                <div>
                                    <h4 className={`font-bold text-sm ${
                                        isHardStop ? 'text-red-800' : 
                                        isOverStandard ? 'text-orange-800' : 
                                        'text-green-800'
                                    }`}>
                                        {isHardStop ? `Exceeds ${selectedLoanType} Max Limit (${effectiveMaxDti}%)` : 
                                         isOverStandard ? `Requires AUS Approval / Reserves` : 
                                         `Meets ${selectedLoanType} Guidelines`}
                                    </h4>
                                    <p className="text-xs mt-1 opacity-80 text-gray-700">
                                        {selectedLoanType === 'FHA' && !hasAusApproval ? 'Manual Underwrite Limit Applied (43%).' : guidelines.notes}
                                    </p>
                                    {liquidAssets > proposedHousing * 6 && isOverStandard && !isHardStop && (
                                        <p className="text-xs mt-1 text-green-700 font-bold">
                                            Strong Reserves detected: {Math.floor(liquidAssets/proposedHousing)} months PITIA. Likely compensating factor.
                                        </p>
                                    )}
                                </div>
                             </div>
                        </div>
                    </div>

                    {/* Guidelines Reference Card */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-xs text-gray-600">
                        <div className="flex items-center mb-2 font-bold uppercase tracking-wider text-gray-400">
                            <BookOpen size={12} className="mr-1"/> Source: {guidelines.name}
                        </div>
                        <div className="grid grid-cols-2 gap-y-2">
                            <div>Standard DTI: <span className="font-mono font-bold text-gray-800">{guidelines.standardDTI}%</span></div>
                            <div>Max DTI (AUS): <span className="font-mono font-bold text-gray-800">{guidelines.maxDTI}%</span></div>
                            {'manualDTI' in guidelines && guidelines.manualDTI !== undefined && (
                                <div>Max DTI (Manual): <span className="font-mono font-bold text-gray-800">{guidelines.manualDTI}%</span></div>
                            )}
                            <div>Max LTV: <span className="font-mono font-bold text-gray-800">{guidelines.maxLTV}%</span></div>
                            <div>Reserves: <span className="font-mono font-bold text-gray-800">{guidelines.reserves}</span></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
