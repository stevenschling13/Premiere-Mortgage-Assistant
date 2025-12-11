import React, { useState, useEffect } from 'react';
import { DollarSign, AlertCircle, CheckCircle2, TrendingUp, Stethoscope, Loader2, RefreshCcw, Briefcase, Coins, X, Save, BookOpen } from 'lucide-react';
import { loadFromStorage, saveToStorage, StorageKeys } from '../services/storageService';
import { solveDtiScenario } from '../services/geminiService';
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
    if (selectedLoanType === 'FHA' && !hasAusApproval) {
        // Safe check for manualDTI existence
        if ('manualDTI' in guidelines) {
            effectiveMaxDti = (guidelines as any).manualDTI;
        } else {
            effectiveMaxDti = 43.00;
        }
    }

    const isOverStandard = backEndRatio > guidelines.standardDTI;
    const isHardStop = backEndRatio > effectiveMaxDti;

    // VA Residual Income Calculation
    let requiredResidual = 0;
    let actualResidual = 0;
    if (selectedLoanType === 'VA') {
        const baseIndex = Math.min(vaFamilySize, 5) - 1;
        const baseAmount = VA_RESIDUAL_INCOME_TABLE[vaRegion][baseIndex];
        const additionalAmount = Math.max(0, vaFamilySize - 5) * VA_ADDITIONAL_MEMBER_AMOUNT;
        requiredResidual = baseAmount + additionalAmount;
        actualResidual = totalMonthlyIncome - totalMonthlyDebts - proposedHousing - (0.14 * 2500); // Rough estimate of taxes/utilities deduction for display
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
            setDealDoctorAdvice(advice);
        } catch (e) {
            console.error(e);
            showToast('Analysis failed', 'error');
        } finally {
            setIsSolving(false);
        }
    };

    // Tools
    const applyRsu = () => {
        const monthly = rsuCalc.value / rsuCalc.years / 12;
        setIncome(prev => ({ ...prev, rsu: monthly }));
        setShowBooster(false);
    };

    const applyAssetDepletion = () => {
        const monthly = assetCalc.value / assetCalc.months;
        setIncome(prev => ({ ...prev, other: prev.other + monthly }));
        setShowBooster(false);
    };

    const resetCalculator = () => {
        if(confirm("Reset all fields?")) {
            setIncome(DEFAULT_INCOME);
            setDebts(DEFAULT_DEBTS);
            setProposedHousing(14500);
            setDealDoctorAdvice(null);
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in pb-20 md:pb-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 border-b border-gray-200 pb-6">
                <div>
                    <h2 className="text-3xl font-bold text-brand-dark flex items-center">
                        <TrendingUp size={32} className="mr-3 text-brand-gold"/>
                        Affordability & DTI
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Underwriting sandbox for complex income scenarios.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <button onClick={() => setShowBooster(true)} className="px-4 py-2 bg-white border border-gray-200 hover:border-brand-gold text-brand-dark rounded-lg text-sm font-bold shadow-sm transition-all flex items-center justify-center">
                        <Coins size={16} className="mr-2 text-brand-gold"/> Income Tools
                    </button>
                    <button onClick={handleRunDealDoctor} disabled={isSolving} className="px-4 py-2 bg-brand-red hover:bg-red-700 text-white rounded-lg text-sm font-bold shadow-lg transition-colors disabled:opacity-50 flex items-center justify-center">
                        {isSolving ? <Loader2 size={16} className="animate-spin mr-2"/> : <Stethoscope size={16} className="mr-2"/>}
                        {dealDoctorAdvice ? "Re-Analyze" : "Deal Doctor"}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Left Column: Inputs */}
                <div className="xl:col-span-2 space-y-6">
                    {/* Loan Config */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center text-sm uppercase tracking-wide">
                            <BookOpen size={16} className="mr-2"/> Program Guidelines
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Loan Type</label>
                                <select 
                                    value={selectedLoanType} 
                                    onChange={(e) => setSelectedLoanType(e.target.value as LoanType)}
                                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-sm font-bold outline-none focus:ring-1 focus:ring-brand-dark"
                                >
                                    <option value="CONVENTIONAL">Conventional</option>
                                    <option value="JUMBO">Jumbo / Non-QM</option>
                                    <option value="FHA">FHA</option>
                                    <option value="VA">VA</option>
                                </select>
                            </div>
                            
                            {(selectedLoanType === 'FHA' || selectedLoanType === 'CONVENTIONAL') && (
                                <div className="flex items-end pb-2">
                                    <label className="flex items-center space-x-2 cursor-pointer select-none">
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${hasAusApproval ? 'bg-green-500 border-green-500' : 'bg-white border-gray-300'}`}>
                                            {hasAusApproval && <CheckCircle2 size={14} className="text-white"/>}
                                        </div>
                                        <input type="checkbox" className="hidden" checked={hasAusApproval} onChange={e => setHasAusApproval(e.target.checked)} />
                                        <span className="text-xs font-bold text-gray-600 uppercase">AUS Approve/Eligible</span>
                                    </label>
                                </div>
                            )}

                            {selectedLoanType === 'VA' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Region</label>
                                        <select value={vaRegion} onChange={(e) => setVaRegion(e.target.value as VaRegion)} className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-sm">
                                            {VA_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Family Size</label>
                                        <input type="number" value={vaFamilySize} onChange={(e) => setVaFamilySize(parseInt(e.target.value))} className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-sm"/>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Income Inputs */}
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-800 flex items-center">
                                    <Briefcase size={18} className="mr-2 text-green-600"/> Monthly Income
                                </h3>
                                <span className="text-green-600 font-bold bg-green-50 px-2 py-1 rounded text-sm">
                                    ${totalMonthlyIncome.toLocaleString()}
                                </span>
                            </div>
                            <div className="space-y-3">
                                {Object.entries(income).map(([key, val]) => (
                                    <div key={key}>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{key.replace(/([A-Z])/g, ' $1').trim()}</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-gray-400 text-xs">$</span>
                                            <input 
                                                type="number" 
                                                value={val || ''}
                                                onChange={(e) => handleIncomeChange(key as keyof typeof income, e.target.value)}
                                                className="w-full pl-6 p-2 bg-gray-50 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-green-500 outline-none transition-colors"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Debts Inputs */}
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-800 flex items-center">
                                    <AlertCircle size={18} className="mr-2 text-red-500"/> Liabilities
                                </h3>
                                <span className="text-red-500 font-bold bg-red-50 px-2 py-1 rounded text-sm">
                                    ${totalMonthlyDebts.toLocaleString()}
                                </span>
                            </div>
                            <div className="space-y-3">
                                {Object.entries(debts).map(([key, val]) => (
                                    <div key={key}>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{key.replace(/([A-Z])/g, ' $1').trim()}</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-gray-400 text-xs">$</span>
                                            <input 
                                                type="number" 
                                                value={val || ''}
                                                onChange={(e) => handleDebtChange(key as keyof typeof debts, e.target.value)}
                                                className="w-full pl-6 p-2 bg-gray-50 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-red-500 outline-none transition-colors"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Housing Expense */}
                    <div className="bg-brand-dark text-white p-6 rounded-xl shadow-lg">
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="flex items-center">
                                <DollarSign size={24} className="text-brand-gold mr-3"/>
                                <div>
                                    <h3 className="font-bold text-lg">Proposed Housing Expense</h3>
                                    <p className="text-xs text-gray-400">PITI + HOA (Subject Property)</p>
                                </div>
                            </div>
                            <div className="relative w-full sm:w-48">
                                <span className="absolute left-4 top-3 text-brand-dark font-bold">$</span>
                                <input 
                                    type="number" 
                                    value={proposedHousing || ''}
                                    onChange={(e) => setProposedHousing(parseFloat(e.target.value) || 0)}
                                    className="w-full pl-8 p-3 text-lg font-bold text-brand-dark rounded-lg outline-none focus:ring-2 focus:ring-brand-gold"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Analysis */}
                <div className="xl:col-span-1 space-y-6">
                    {/* Ratios Card */}
                    <div className={`p-6 rounded-xl border-2 shadow-sm relative overflow-hidden transition-colors ${isHardStop ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
                        {isHardStop && <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl">GUIDELINE FAIL</div>}
                        <h3 className="font-bold text-gray-800 mb-6 text-center uppercase tracking-widest text-sm">Underwriting Ratios</h3>
                        
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div>
                                <div className="text-xs font-bold text-gray-500 uppercase mb-1">Front-End</div>
                                <div className={`text-3xl font-bold ${frontEndRatio > guidelines.standardDTI ? 'text-orange-500' : 'text-brand-dark'}`}>
                                    {frontEndRatio.toFixed(2)}%
                                </div>
                                <div className="text-[10px] text-gray-400 mt-1">Target: {guidelines.standardDTI}%</div>
                            </div>
                            <div>
                                <div className="text-xs font-bold text-gray-500 uppercase mb-1">Back-End</div>
                                <div className={`text-3xl font-bold ${backEndRatio > effectiveMaxDti ? 'text-red-600' : backEndRatio > 43 ? 'text-orange-500' : 'text-green-600'}`}>
                                    {backEndRatio.toFixed(2)}%
                                </div>
                                <div className="text-[10px] text-gray-400 mt-1">Max: {effectiveMaxDti}%</div>
                            </div>
                        </div>

                        {selectedLoanType === 'VA' && (
                            <div className="mt-6 pt-6 border-t border-gray-200/50">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-gray-500">VA Residual Income</span>
                                    <span className={actualResidual >= requiredResidual ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>
                                        ${actualResidual.toLocaleString()}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                    <div className={`h-1.5 rounded-full ${actualResidual >= requiredResidual ? 'bg-green-500' : 'bg-red-500'}`} style={{width: `${Math.min((actualResidual/requiredResidual)*100, 100)}%`}}></div>
                                </div>
                                <div className="text-[10px] text-gray-400 mt-1 text-right">Required: ${requiredResidual}</div>
                            </div>
                        )}
                    </div>

                    {/* AI Deal Doctor Output */}
                    {dealDoctorAdvice ? (
                        <div className="bg-brand-dark text-white p-5 rounded-xl shadow-lg border border-white/10 animate-fade-in relative">
                            <div className="flex items-center mb-3">
                                <Stethoscope size={20} className="text-brand-gold mr-2" />
                                <h3 className="font-bold text-sm uppercase">Deal Doctor Strategy</h3>
                            </div>
                            <div className="text-sm leading-relaxed text-gray-200 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                <MarkdownRenderer content={dealDoctorAdvice} />
                            </div>
                            <button onClick={() => setDealDoctorAdvice(null)} className="absolute top-2 right-2 text-gray-400 hover:text-white"><X size={14}/></button>
                        </div>
                    ) : (
                        <div className="p-6 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-center text-gray-400 min-h-[200px]">
                            <Stethoscope size={32} className="mb-2 opacity-20"/>
                            <p className="text-sm font-medium">Deal Doctor Standby</p>
                            <p className="text-xs mt-1">Run analysis to see structuring advice.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Income Booster Modal */}
            {showBooster && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-4 bg-brand-dark text-white flex justify-between items-center">
                            <h3 className="font-bold flex items-center"><Coins size={18} className="mr-2 text-brand-gold"/> Income Calculators</h3>
                            <button onClick={() => setShowBooster(false)}><X size={18}/></button>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* RSU Calc */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-800 mb-2 uppercase">RSU Income</h4>
                                <div className="flex space-x-2">
                                    <div className="flex-1">
                                        <label className="text-[10px] font-bold text-gray-500">Total Vested (3 Yr Avg)</label>
                                        <input type="number" value={rsuCalc.value} onChange={(e) => setRsuCalc({...rsuCalc, value: parseFloat(e.target.value)})} className="w-full p-2 border rounded text-sm"/>
                                    </div>
                                    <div className="w-20">
                                        <label className="text-[10px] font-bold text-gray-500">Years</label>
                                        <input type="number" value={rsuCalc.years} onChange={(e) => setRsuCalc({...rsuCalc, years: parseFloat(e.target.value)})} className="w-full p-2 border rounded text-sm"/>
                                    </div>
                                </div>
                                <button onClick={applyRsu} className="mt-2 w-full py-2 bg-blue-50 text-blue-700 font-bold text-xs rounded hover:bg-blue-100 transition-colors">Apply ${(rsuCalc.value / rsuCalc.years / 12).toFixed(0)}/mo</button>
                            </div>

                            <hr className="border-gray-100"/>

                            {/* Asset Depletion */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-800 mb-2 uppercase">Asset Depletion</h4>
                                <div className="flex space-x-2">
                                    <div className="flex-1">
                                        <label className="text-[10px] font-bold text-gray-500">Eligible Assets (Post-Close)</label>
                                        <input type="number" value={assetCalc.value} onChange={(e) => setAssetCalc({...assetCalc, value: parseFloat(e.target.value)})} className="w-full p-2 border rounded text-sm"/>
                                    </div>
                                    <div className="w-20">
                                        <label className="text-[10px] font-bold text-gray-500">Term</label>
                                        <input type="number" value={assetCalc.months} onChange={(e) => setAssetCalc({...assetCalc, months: parseFloat(e.target.value)})} className="w-full p-2 border rounded text-sm"/>
                                    </div>
                                </div>
                                <button onClick={applyAssetDepletion} className="mt-2 w-full py-2 bg-purple-50 text-purple-700 font-bold text-xs rounded hover:bg-purple-100 transition-colors">Apply ${(assetCalc.value / assetCalc.months).toFixed(0)}/mo</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};