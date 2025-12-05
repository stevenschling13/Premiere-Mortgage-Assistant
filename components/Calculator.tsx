import React, { useState, useMemo } from 'react';
import { LoanScenario } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { DollarSign, Percent, Calendar, RefreshCcw, Info, BrainCircuit } from 'lucide-react';
import { analyzeLoanScenario } from '../services/geminiService';

export const Calculator: React.FC = () => {
  const [scenario, setScenario] = useState<LoanScenario>({
    purchasePrice: 2500000,
    downPaymentPercent: 20,
    interestRate: 6.625,
    loanTerm: 30,
    propertyTaxRate: 1.25,
    insuranceAnnual: 6000,
    hoaMonthly: 850,
    isInterestOnly: false
  });

  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

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

  const handleGetAnalysis = async () => {
    setLoadingAi(true);
    setAiAnalysis(null);
    try {
      const dataStr = `Jumbo Loan Scenario. Price: $${scenario.purchasePrice}, Loan: $${loanAmount}, IO: ${scenario.isInterestOnly}, Rate: ${scenario.interestRate}%, Dwn: ${scenario.downPaymentPercent}%`;
      const result = await analyzeLoanScenario(dataStr);
      setAiAnalysis(result);
    } catch (e) {
      console.error(e);
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
        <div className="bg-white px-8 py-4 rounded-xl border border-gray-200 shadow-sm text-right">
          <span className="block text-gray-400 text-xs uppercase tracking-wider font-semibold mb-1">Est. Monthly Payment</span>
          <span className="text-4xl font-bold text-brand-red tracking-tight">
            ${totalMonthlyPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
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
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Purchase Price</label>
                <div className="relative group">
                  <DollarSign className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 group-focus-within:text-brand-red transition-colors" />
                  <input
                    type="number"
                    inputMode="decimal"
                    value={scenario.purchasePrice}
                    onChange={(e) => handleInputChange(e, 'purchasePrice')}
                    className="pl-10 w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red focus:bg-white outline-none transition-all font-medium text-brand-dark"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Down Payment %</label>
                  <div className="relative group">
                    <Percent className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 group-focus-within:text-brand-red transition-colors" />
                    <input
                      type="number"
                      inputMode="decimal"
                      value={scenario.downPaymentPercent}
                      onChange={(e) => handleInputChange(e, 'downPaymentPercent')}
                      className="pl-9 w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red focus:bg-white outline-none transition-all font-medium"
                    />
                  </div>
                </div>
                <div className="flex flex-col justify-end pb-2 text-right">
                    <span className="text-xs text-gray-400 uppercase">Equity Amount</span>
                    <span className="text-sm font-bold text-green-600 truncate">
                        ${downPaymentAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                </div>
              </div>

              <div className="p-4 bg-brand-dark/5 rounded-lg border border-brand-dark/10">
                  <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-bold text-brand-dark flex items-center">
                          Interest Only
                          <Info size={12} className="ml-1 text-gray-400" />
                      </label>
                      <button 
                          onClick={() => setScenario({...scenario, isInterestOnly: !scenario.isInterestOnly})}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-red ${scenario.isInterestOnly ? 'bg-brand-red' : 'bg-gray-300'}`}
                      >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${scenario.isInterestOnly ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                  </div>
                  <p className="text-xs text-gray-500 leading-tight">
                      {scenario.isInterestOnly ? 'Lower monthly obligation. Principal repayment deferred.' : 'Standard amortization schedule (P&I).'}
                  </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Rate (%)</label>
                  <input
                    type="number"
                    step="0.125"
                    inputMode="decimal"
                    value={scenario.interestRate}
                    onChange={(e) => handleInputChange(e, 'interestRate')}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red focus:bg-white outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Term (Years)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={scenario.loanTerm}
                    onChange={(e) => handleInputChange(e, 'loanTerm')}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red focus:bg-white outline-none font-medium"
                  />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tax Rate (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={scenario.propertyTaxRate}
                        onChange={(e) => handleInputChange(e, 'propertyTaxRate')}
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                      />
                   </div>
                   <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">HOA / Mo</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={scenario.hoaMonthly}
                        onChange={(e) => handleInputChange(e, 'hoaMonthly')}
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                      />
                   </div>
                 </div>
              </div>
            </div>
          </div>
          
          <button 
              onClick={handleGetAnalysis}
              disabled={loadingAi}
              className="w-full py-4 bg-gradient-to-r from-brand-dark to-slate-800 text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center justify-center space-x-2 disabled:opacity-80 active:scale-[0.99]"
          >
              {loadingAi ? <RefreshCcw className="animate-spin w-5 h-5 text-brand-gold"/> : <BrainCircuit className="w-5 h-5 text-brand-gold"/>}
              <span>{loadingAi ? 'Thinking...' : 'Deep Risk Analysis'}</span>
          </button>
        </div>

        {/* Visualization Column */}
        <div className="xl:col-span-8 space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row items-center justify-between min-h-[400px]">
                <div className="w-full md:w-1/2 h-64 md:h-80 relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={80}
                                outerRadius={100}
                                paddingAngle={5}
                                dataKey="value"
                                cornerRadius={4}
                            >
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                ))}
                            </Pie>
                            <RechartsTooltip 
                                formatter={(value: number) => [`$${value.toLocaleString(undefined, {maximumFractionDigits: 0})}`, '']}
                                contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Monthly</span>
                        <span className="text-brand-dark font-bold text-2xl">${totalMonthlyPayment.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                    </div>
                </div>
                
                <div className="w-full md:w-1/2 mt-8 md:mt-0 md:pl-12 space-y-6">
                    <h3 className="font-bold text-gray-800 border-b border-gray-100 pb-2">Payment Breakdown</h3>
                    <div className="space-y-3">
                        {chartData.map((item) => (
                            <div key={item.name} className="flex justify-between items-center group">
                                <div className="flex items-center space-x-3">
                                    <div className="w-3 h-3 rounded-full shadow-sm" style={{backgroundColor: item.color}}></div>
                                    <span className="text-gray-600 font-medium text-sm">{item.name}</span>
                                </div>
                                <span className="font-bold text-gray-900 text-sm group-hover:scale-105 transition-transform">
                                    ${item.value.toLocaleString(undefined, {maximumFractionDigits: 0})}
                                </span>
                            </div>
                        ))}
                    </div>
                    
                    <div className="pt-6 border-t border-gray-100 space-y-3">
                         <div className="flex justify-between text-sm">
                             <span className="text-gray-500">Loan Amount</span>
                             <span className="font-semibold text-brand-dark">${loanAmount.toLocaleString()}</span>
                         </div>
                         <div className="flex justify-between text-sm">
                             <span className="text-gray-500">Total Down Payment</span>
                             <span className="font-semibold text-green-600">${downPaymentAmount.toLocaleString()} ({scenario.downPaymentPercent}%)</span>
                         </div>
                    </div>
                </div>
            </div>

            {aiAnalysis && (
                <div className="bg-brand-light rounded-xl border border-brand-red/10 shadow-sm relative overflow-hidden animate-slide-up">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-gold"></div>
                    <div className="p-6 md:p-8">
                        <div className="flex items-center space-x-3 mb-4">
                             <div className="p-1.5 bg-brand-gold/10 rounded-md">
                                <BrainCircuit size={16} className="text-brand-dark"/>
                             </div>
                             <span className="text-brand-dark font-bold text-sm uppercase tracking-wider">Strategic Risk Assessment</span>
                        </div>
                        <div className="prose prose-sm text-gray-700 max-w-none">
                            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-600">{aiAnalysis}</pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};