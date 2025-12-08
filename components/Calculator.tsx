import React, { useState, useMemo, useEffect } from 'react';
import { LoanScenario } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { RefreshCcw, Info, BrainCircuit, RotateCcw } from 'lucide-react';
import { analyzeLoanScenario } from '../services/geminiService';
import { loadFromStorage, saveToStorage, StorageKeys } from '../services/storageService';
import { useToast } from './Toast';
import { MarkdownRenderer } from './MarkdownRenderer';

const DEFAULT_SCENARIO: LoanScenario = {
    purchasePrice: 2500000,
    downPaymentPercent: 20,
    interestRate: 6.625,
    loanTerm: 30,
    propertyTaxRate: 1.25,
    insuranceAnnual: 6000,
    hoaMonthly: 850,
    isInterestOnly: false
};

export const Calculator: React.FC = () => {
  const { showToast } = useToast();
  
  // Persisted State
  const [scenario, setScenario] = useState<LoanScenario>(() => 
      loadFromStorage(StorageKeys.CALCULATOR_SCENARIO, DEFAULT_SCENARIO)
  );

  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Persistence Effect
  useEffect(() => {
      saveToStorage(StorageKeys.CALCULATOR_SCENARIO, scenario);
  }, [scenario]);

  const downPaymentAmount = useMemo(() => scenario.purchasePrice * (scenario.downPaymentPercent / 100), [scenario.purchasePrice, scenario.downPaymentPercent]);
  const loanAmount = useMemo(() => scenario.purchasePrice - downPaymentAmount, [scenario.purchasePrice, downPaymentAmount]);
  const monthlyRate = useMemo(() => scenario.interestRate / 100 / 12, [scenario.interestRate]);
  const numberOfPayments = useMemo(() => scenario.loanTerm * 12, [scenario.loanTerm]);

  const monthlyPI = useMemo(() => {
    if (monthlyRate === 0) return loanAmount / numberOfPayments;
    if (scenario.isInterestOnly) {
      return loanAmount * monthlyRate;
    } else {
      return (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    }
  }, [loanAmount, monthlyRate, numberOfPayments, scenario.isInterestOnly]);

  const monthlyPropertyTax = useMemo(() => (scenario.purchasePrice * (scenario.propertyTaxRate / 100)) / 12, [scenario.purchasePrice, scenario.propertyTaxRate]);
  const monthlyInsurance = useMemo(() => scenario.insuranceAnnual / 12, [scenario.insuranceAnnual]);
  const totalMonthlyPayment = useMemo(() => monthlyPI + monthlyPropertyTax + monthlyInsurance + scenario.hoaMonthly, [monthlyPI, monthlyPropertyTax, monthlyInsurance, scenario.hoaMonthly]);

  const chartData = useMemo(() => [
    { name: scenario.isInterestOnly ? 'Interest Only' : 'Principal & Interest', value: monthlyPI, color: '#1E293B' },
    { name: 'Property Tax', value: monthlyPropertyTax, color: '#CD1337' },
    { name: 'Home Insurance', value: monthlyInsurance, color: '#F4B23E' },
    { name: 'HOA', value: scenario.hoaMonthly, color: '#64748B' },
  ], [monthlyPI, monthlyPropertyTax, monthlyInsurance, scenario.hoaMonthly, scenario.isInterestOnly]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof LoanScenario) => {
    const val = parseFloat(e.target.value);
    setScenario({
      ...scenario,
      [field]: isNaN(val) ? 0 : val
    });
  };

  const handleReset = () => {
      if(confirm('Reset calculator to defaults?')) {
          setScenario(DEFAULT_SCENARIO);
          setAiAnalysis(null);
          showToast('Calculator reset', 'info');
      }
  };

  const handleGetAnalysis = async () => {
    setLoadingAi(true);
    setAiAnalysis(null);
    try {
      const dataStr = `Jumbo Loan Scenario. Price: $${scenario.purchasePrice}, Loan: $${loanAmount}, IO: ${scenario.isInterestOnly}, Rate: ${scenario.interestRate}%, Dwn: ${scenario.downPaymentPercent}%`;
      const result = await analyzeLoanScenario(dataStr);
      setAiAnalysis(result);
    } catch (e) {
      console.error(e);
      showToast('AI Analysis failed', 'error');
    } finally {
      setLoadingAi(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in pb-20 md:pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 border-b border-gray-200 pb-6">
        <div>
          <h2 className="text-3xl font-bold text-brand-dark tracking-tight">Jumbo Calculator</h2>
          <p className="text-sm text-gray-500 mt-1">Advanced scenario modeling for high-value properties.</p>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
            <button 
                onClick={handleReset}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                title="Reset Defaults"
            >
                <RotateCcw size={20} />
            </button>
            <div className="bg-white px-8 py-4 rounded-xl border border-gray-200 shadow-sm text-right flex-1 md:flex-none">
                <span className="block text-gray-400 text-xs uppercase tracking-wider font-semibold mb-1">Est. Monthly Payment</span>
                <span className="text-4xl font-bold text-brand-red tracking-tight">
                    ${totalMonthlyPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Input Column */}
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold mb-6 text-brand-dark flex items-center">
                Loan Parameters
            </h3>
            
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Purchase Price</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-gray-400">$</span>
                  <input 
                    type="number"
                    inputMode="decimal"
                    value={scenario.purchasePrice}
                    onChange={(e) => handleInputChange(e, 'purchasePrice')}
                    className="w-full pl-6 p-3 bg-gray-50 text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red outline-none transition-colors font-medium"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Down Payment (%)</label>
                  <div className="relative">
                    <input 
                      type="number"
                      inputMode="decimal"
                      value={scenario.downPaymentPercent}
                      onChange={(e) => handleInputChange(e, 'downPaymentPercent')}
                      className="w-full p-3 bg-gray-50 text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red outline-none transition-colors"
                    />
                    <span className="absolute right-3 top-3 text-gray-400">%</span>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Loan Amount</label>
                  <div className="p-3 bg-gray-100 text-gray-500 rounded-lg border border-transparent font-medium">
                    ${(loanAmount / 1000).toFixed(0)}k
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Interest Rate</label>
                  <div className="relative">
                    <input 
                      type="number"
                      inputMode="decimal"
                      step="0.125"
                      value={scenario.interestRate}
                      onChange={(e) => handleInputChange(e, 'interestRate')}
                      className="w-full p-3 bg-gray-50 text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red outline-none transition-colors"
                    />
                    <span className="absolute right-3 top-3 text-gray-400">%</span>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Term (Years)</label>
                  <input 
                    type="number"
                    inputMode="numeric"
                    value={scenario.loanTerm}
                    onChange={(e) => handleInputChange(e, 'loanTerm')}
                    className="w-full p-3 bg-gray-50 text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                 <label className="flex items-center space-x-3 cursor-pointer group">
                    <div className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${scenario.isInterestOnly ? 'bg-brand-red border-brand-red' : 'bg-white border-gray-300'}`}>
                        {scenario.isInterestOnly && <RefreshCcw size={14} className="text-white" />}
                    </div>
                    <input 
                        type="checkbox" 
                        className="hidden"
                        checked={scenario.isInterestOnly}
                        onChange={(e) => setScenario({...scenario, isInterestOnly: e.target.checked})}
                    />
                    <span className="text-sm font-medium text-gray-700 group-hover:text-brand-dark transition-colors">Interest Only Payment</span>
                 </label>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
             <h3 className="text-lg font-bold mb-4 text-brand-dark">Property Expenses</h3>
             <div className="space-y-4">
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Property Tax Rate (%)</label>
                    <input 
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={scenario.propertyTaxRate}
                      onChange={(e) => handleInputChange(e, 'propertyTaxRate')}
                      className="w-full p-2 bg-gray-50 text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red outline-none"
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Insurance / Yr</label>
                        <input 
                          type="number"
                          inputMode="decimal"
                          value={scenario.insuranceAnnual}
                          onChange={(e) => handleInputChange(e, 'insuranceAnnual')}
                          className="w-full p-2 bg-gray-50 text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red outline-none"
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">HOA / Mo</label>
                        <input 
                          type="number"
                          inputMode="decimal"
                          value={scenario.hoaMonthly}
                          onChange={(e) => handleInputChange(e, 'hoaMonthly')}
                          className="w-full p-2 bg-gray-50 text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red outline-none"
                        />
                     </div>
                 </div>
             </div>
          </div>
        </div>

        {/* Results Column */}
        <div className="xl:col-span-8 flex flex-col gap-8">
           {/* Chart Section */}
           <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col items-center justify-center min-h-[400px]">
                <h3 className="text-lg font-bold text-brand-dark mb-8 self-start w-full border-b pb-2">Payment Breakdown</h3>
                <div className="w-full h-[300px] flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={80}
                                outerRadius={120}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <RechartsTooltip 
                                formatter={(value: number) => `$${value.toLocaleString(undefined, {maximumFractionDigits: 0})}`}
                                contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full mt-8">
                    {chartData.map((item, idx) => (
                        <div key={idx} className="flex flex-col items-center p-3 rounded-lg bg-gray-50 border border-gray-100">
                            <div className="flex items-center space-x-2 mb-1">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                                <span className="text-xs font-bold text-gray-500 uppercase">{item.name}</span>
                            </div>
                            <span className="text-lg font-bold text-brand-dark">${item.value.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                        </div>
                    ))}
                </div>
           </div>
           
           {/* AI Analysis Section */}
           <div className="bg-brand-dark text-white p-6 rounded-xl shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-10">
                    <BrainCircuit size={120} />
                </div>
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center space-x-3">
                            <div className="bg-white/10 p-2 rounded-lg">
                                <BrainCircuit className="text-brand-gold" size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">AI Scenario Auditor (Gemini Pro)</h3>
                                <p className="text-xs text-gray-400">Deep-dive risk analysis & structuring advice</p>
                            </div>
                        </div>
                        <button 
                            onClick={handleGetAnalysis}
                            disabled={loadingAi}
                            className="px-4 py-2 bg-brand-red hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                            {loadingAi ? 'Analyzing...' : 'Run Analysis'}
                        </button>
                    </div>
                    
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 min-h-[100px] text-sm leading-relaxed text-gray-300">
                        {loadingAi ? (
                            <div className="flex items-center justify-center h-full text-brand-gold animate-pulse">
                                <RefreshCcw className="animate-spin mr-2" /> Thinking...
                            </div>
                        ) : aiAnalysis ? (
                            <div className="prose prose-invert prose-sm max-w-none">
                                <MarkdownRenderer content={aiAnalysis} />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-60">
                                <Info size={24} className="mb-2"/>
                                <p>Run analysis to get AI feedback on DTI, reserves, and risk factors.</p>
                            </div>
                        )}
                    </div>
                </div>
           </div>
        </div>
      </div>
    </div>
  );
};
