
import React, { useState, useEffect } from 'react';
import { DollarSign, AlertCircle, CheckCircle2, TrendingUp, Calculator } from 'lucide-react';
import { loadFromStorage, saveToStorage, StorageKeys } from '../services/storageService';

const DEFAULT_INCOME = { baseSalary: 25000, bonus: 5000, rsu: 8000, other: 0 };
const DEFAULT_DEBTS = { creditCards: 500, carLoans: 1200, studentLoans: 0, otherRealEstate: 2500, otherLoans: 0 };

export const DtiAnalysis: React.FC = () => {
    // Persisted State
    const [income, setIncome] = useState(() => loadFromStorage(StorageKeys.DTI_DATA, { income: DEFAULT_INCOME, debts: DEFAULT_DEBTS, proposedHousing: 14500 }).income);
    const [debts, setDebts] = useState(() => loadFromStorage(StorageKeys.DTI_DATA, { income: DEFAULT_INCOME, debts: DEFAULT_DEBTS, proposedHousing: 14500 }).debts);
    const [proposedHousing, setProposedHousing] = useState(() => loadFromStorage(StorageKeys.DTI_DATA, { income: DEFAULT_INCOME, debts: DEFAULT_DEBTS, proposedHousing: 14500 }).proposedHousing);

    // Save on change
    useEffect(() => {
        saveToStorage(StorageKeys.DTI_DATA, { income, debts, proposedHousing });
    }, [income, debts, proposedHousing]);

    // Calculations
    const totalMonthlyIncome = (Object.values(income) as number[]).reduce((a, b) => a + b, 0);
    const totalMonthlyDebts = (Object.values(debts) as number[]).reduce((a, b) => a + b, 0);
    
    const frontEndRatio = totalMonthlyIncome > 0 ? (proposedHousing / totalMonthlyIncome) * 100 : 0;
    const backEndRatio = totalMonthlyIncome > 0 ? ((proposedHousing + totalMonthlyDebts) / totalMonthlyIncome) * 100 : 0;

    const isHighRisk = backEndRatio > 43;

    // Purchasing Power Calculation (Reverse DTI)
    const maxAllowedBackEnd = totalMonthlyIncome * 0.43;
    const maxHousingPayment = Math.max(0, maxAllowedBackEnd - totalMonthlyDebts);
    // Rough estimation: $700 monthly payment ~ $100k purchasing power (at current rates + taxes/ins)
    const estimatedPurchasingPower = (maxHousingPayment / 700) * 100000;

    const handleIncomeChange = (field: keyof typeof income, val: string) => {
        const num = val === '' ? 0 : parseFloat(val);
        setIncome({...income, [field]: isNaN(num) ? 0 : num});
    };

    const handleDebtChange = (field: keyof typeof debts, val: string) => {
        const num = val === '' ? 0 : parseFloat(val);
        setDebts({...debts, [field]: isNaN(num) ? 0 : num});
    };

    return (
        <div className="p-8 max-w-5xl mx-auto animate-fade-in">
             <div className="mb-8">
                <h2 className="text-3xl font-bold text-brand-dark">Affordability & DTI Analysis</h2>
                <p className="text-gray-500 mt-1">Analyze borrower qualification ratios and maximum purchasing power.</p>
            </div>

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
                                    <input type="number" inputMode="decimal" defaultValue={income.baseSalary} onBlur={(e) => handleIncomeChange('baseSalary', e.target.value)} className="w-full pl-6 p-2 bg-gray-50 text-gray-900 rounded border border-gray-200 focus:bg-white focus:border-brand-red outline-none transition-colors" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Bonus / Commission</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-gray-400">$</span>
                                    <input type="number" inputMode="decimal" defaultValue={income.bonus} onBlur={(e) => handleIncomeChange('bonus', e.target.value)} className="w-full pl-6 p-2 bg-gray-50 text-gray-900 rounded border border-gray-200 focus:bg-white focus:border-brand-red outline-none transition-colors" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">RSU / Stock (Vest)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-gray-400">$</span>
                                    <input type="number" inputMode="decimal" defaultValue={income.rsu} onBlur={(e) => handleIncomeChange('rsu', e.target.value)} className="w-full pl-6 p-2 bg-gray-50 text-gray-900 rounded border border-gray-200 focus:bg-white focus:border-brand-red outline-none transition-colors" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Other</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-gray-400">$</span>
                                    <input type="number" inputMode="decimal" defaultValue={income.other} onBlur={(e) => handleIncomeChange('other', e.target.value)} className="w-full pl-6 p-2 bg-gray-50 text-gray-900 rounded border border-gray-200 focus:bg-white focus:border-brand-red outline-none transition-colors" />
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
                                <input type="number" inputMode="decimal" defaultValue={debts.creditCards} onBlur={(e) => handleDebtChange('creditCards', e.target.value)} className="flex-1 p-2 bg-gray-50 text-gray-900 rounded border border-gray-200 outline-none" />
                             </div>
                             <div className="flex items-center space-x-4">
                                <label className="w-1/3 text-sm text-gray-600">Auto Loans/Leases</label>
                                <input type="number" inputMode="decimal" defaultValue={debts.carLoans} onBlur={(e) => handleDebtChange('carLoans', e.target.value)} className="flex-1 p-2 bg-gray-50 text-gray-900 rounded border border-gray-200 outline-none" />
                             </div>
                             <div className="flex items-center space-x-4">
                                <label className="w-1/3 text-sm text-gray-600">Student Loans</label>
                                <input type="number" inputMode="decimal" defaultValue={debts.studentLoans} onBlur={(e) => handleDebtChange('studentLoans', e.target.value)} className="flex-1 p-2 bg-gray-50 text-gray-900 rounded border border-gray-200 outline-none" />
                             </div>
                             <div className="flex items-center space-x-4">
                                <label className="w-1/3 text-sm text-gray-600">Other Properties (PITIA)</label>
                                <input type="number" inputMode="decimal" defaultValue={debts.otherRealEstate} onBlur={(e) => handleDebtChange('otherRealEstate', e.target.value)} className="flex-1 p-2 bg-gray-50 text-gray-900 rounded border border-gray-200 outline-none" />
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
                    <div className="bg-brand-dark text-white p-6 rounded-xl shadow-md">
                        <h3 className="text-lg font-bold mb-4">Proposed Housing Expense</h3>
                        <div className="relative mb-2">
                             <DollarSign className="absolute left-3 top-3.5 h-6 w-6 text-gray-400" />
                             <input 
                                type="number" 
                                inputMode="decimal"
                                defaultValue={proposedHousing} 
                                onBlur={(e) => setProposedHousing(parseFloat(e.target.value)||0)}
                                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-2xl font-bold text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-gold outline-none"
                            />
                        </div>
                        <p className="text-xs text-gray-400">Enter total PITIA + HOA for subject property</p>
                    </div>

                    {/* Purchasing Power Card */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-xl shadow-md relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Calculator size={80} />
                        </div>
                        <h4 className="text-xs font-bold uppercase tracking-wider mb-2 opacity-80">Max Purchasing Power (43% DTI)</h4>
                        <div className="flex items-baseline space-x-2">
                             <span className="text-3xl font-bold">~${estimatedPurchasingPower.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                        </div>
                        <div className="mt-2 text-xs opacity-75">
                            Max Housing Payment: ${maxHousingPayment.toLocaleString(undefined, {maximumFractionDigits:0})} / mo
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
                        <div className="mb-8">
                             <div className="flex justify-between items-end mb-2">
                                <span className="text-gray-500 font-medium">Front-End Ratio (Housing)</span>
                                <span className="text-2xl font-bold text-brand-dark">{frontEndRatio.toFixed(2)}%</span>
                             </div>
                             <div className="w-full bg-gray-200 rounded-full h-3">
                                <div className="bg-brand-gold h-3 rounded-full" style={{width: `${Math.min(frontEndRatio, 100)}%`}}></div>
                             </div>
                        </div>

                        <div>
                             <div className="flex justify-between items-end mb-2">
                                <span className="text-gray-500 font-medium">Back-End Ratio (Total DTI)</span>
                                <span className={`text-3xl font-bold ${isHighRisk ? 'text-red-600' : 'text-green-600'}`}>{backEndRatio.toFixed(2)}%</span>
                             </div>
                             <div className="w-full bg-gray-200 rounded-full h-4">
                                <div 
                                    className={`h-4 rounded-full transition-all duration-500 ${isHighRisk ? 'bg-brand-red' : 'bg-green-500'}`} 
                                    style={{width: `${Math.min(backEndRatio, 100)}%`}}
                                ></div>
                             </div>
                             <div className="mt-4 flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                                {isHighRisk ? <AlertCircle className="text-red-500 shrink-0" /> : <CheckCircle2 className="text-green-500 shrink-0" />}
                                <div>
                                    <h4 className={`font-bold text-sm ${isHighRisk ? 'text-red-800' : 'text-green-800'}`}>
                                        {isHighRisk ? 'Exceeds Standard Guidelines (>43%)' : 'Within Standard Guidelines (<43%)'}
                                    </h4>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {isHighRisk 
                                            ? 'Exceptions may be available for high-net-worth clients with significant post-closing liquidity. Consult with Credit Risk.'
                                            : 'Borrower qualifies under standard QM DTI requirements.'
                                        }
                                    </p>
                                </div>
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
