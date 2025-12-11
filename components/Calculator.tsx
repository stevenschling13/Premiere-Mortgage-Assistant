import React, { useState, useMemo, useEffect, useDeferredValue, useRef, memo, useCallback } from 'react';
import { LoanScenario } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import RefreshCcw from 'lucide-react/icons/refresh-ccw';
import Info from 'lucide-react/icons/info';
import BrainCircuit from 'lucide-react/icons/brain-circuit';
import RotateCcw from 'lucide-react/icons/rotate-ccw';
import RefreshCcw from 'lucide-react/dist/esm/icons/refresh-ccw';
import Info from 'lucide-react/dist/esm/icons/info';
import BrainCircuit from 'lucide-react/dist/esm/icons/brain-circuit';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw';
import { loadFromStorage, saveToStorage, StorageKeys } from '../services/storageService';
import { useToast } from './Toast';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Skeleton } from './Skeleton';

const loadLoanToolsService = () => import('../services/gemini/loanToolsService');

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

// --- SUB-COMPONENT: Input Masking ---
const NumberInput = ({ 
    value, 
    onChange, 
    format = 'number', 
    className, 
    ...props 
}: {
    value: number;
    onChange: (val: number) => void;
    format?: 'currency' | 'percent' | 'number';
    className?: string;
    [key: string]: any;
}) => {
    const [localStr, setLocalStr] = useState('');
    const [isFocused, setIsFocused] = useState(false);

    // Sync with external value when not editing
    useEffect(() => {
        if (!isFocused) {
            if (format === 'currency') {
                setLocalStr(value.toLocaleString('en-US', { maximumFractionDigits: 0 }));
            } else {
                setLocalStr(value.toString());
            }
        }
    }, [value, isFocused, format]);

    const handleFocus = () => {
        setIsFocused(true);
        // Remove formatting for editing
        setLocalStr(value.toString());
    };

    const handleBlur = () => {
        setIsFocused(false);
        // formatting happens in useEffect when isFocused becomes false
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        
        // Allow digits and one dot
        if (!/^[0-9]*\.?[0-9]*$/.test(raw)) return;

        setLocalStr(raw);
        const parsed = parseFloat(raw);
        if (!isNaN(parsed)) {
            onChange(parsed);
        } else if (raw === '') {
            onChange(0);
        }
    };

    return (
        <input
            type="text"
            inputMode="decimal"
            value={localStr}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={className}
            {...props}
        />
    );
};

// --- SUB-COMPONENT: Memoized Chart Section ---
const CalculatorResults = memo(({ 
    chartData, 
    totalMonthlyPayment 
}: { 
    chartData: any[], 
    totalMonthlyPayment: number 
}) => {
    // Defer chart updates to prevent input lag
    const deferredChartData = useDeferredValue(chartData);

    return (
        <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col items-center justify-center min-h-[400px]">
            <h3 className="text-lg font-bold text-brand-dark mb-8 self-start w-full border-b pb-2">Payment Breakdown</h3>
            <div className="w-full h-[300px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={deferredChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={120}
                            paddingAngle={5}
                            dataKey="value"
                            isAnimationActive={false} // Disable animation for responsiveness
                        >
                            {deferredChartData.map((entry, index) => (
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
                {deferredChartData.map((item, idx) => (
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
    );
});

// --- SUB-COMPONENT: AI Analysis Section (Memoized) ---
// Optimization: Wrapped in React.memo to prevent re-renders when parent input state changes.
// It will only re-render if aiAnalysis content changes or loading state toggles.
const AiAnalysisSection = memo(({ 
    aiAnalysis, 
    loadingAi, 
    onGetAnalysis 
}: { 
    aiAnalysis: string | null, 
    loadingAi: boolean, 
    onGetAnalysis: () => void 
}) => {
    return (
        <div className="bg-brand-dark text-white p-6 rounded-xl shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10">
                <BrainCircuit size={120} />
            </div>
            <div className="relative z-10">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                    <div className="flex items-center space-x-3">
                        <div className="bg-white/10 p-2 rounded-lg shrink-0">
                            <BrainCircuit className="text-brand-gold" size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">AI Scenario Auditor</h3>
                            <p className="text-xs text-gray-400">Deep-dive risk analysis & structuring advice</p>
                        </div>
                    </div>
                    <button 
                        onClick={onGetAnalysis}
                        disabled={loadingAi}
                        className="w-full sm:w-auto px-4 py-2 bg-brand-red hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-white"
                    >
                        {loadingAi ? 'Analyzing...' : 'Run Analysis'}
                    </button>
                </div>
                
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 min-h-[100px] text-sm leading-relaxed text-gray-300">
                    {loadingAi && !aiAnalysis ? (
                        <div className="space-y-3 p-2">
                            <Skeleton className="h-4 w-3/4 bg-white/10" />
                            <Skeleton className="h-3 w-full bg-white/10" />
                            <Skeleton className="h-3 w-[90%] bg-white/10" />
                            <Skeleton className="h-3 w-[85%] bg-white/10" />
                        </div>
                    ) : aiAnalysis ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                            <MarkdownRenderer content={aiAnalysis} />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-60">
                            <Info size={24} className="mb-2"/>
                            <p className="text-center">Run analysis to get AI feedback on DTI, reserves, and risk factors.</p>
                        </div>
                    )}
                </div>
            </div>
       </div>
    );
});

export const Calculator: React.FC = () => {
  const { showToast } = useToast();
  
  // Persisted State
  const [scenario, setScenario] = useState<LoanScenario>(() => 
      loadFromStorage(StorageKeys.CALCULATOR_SCENARIO, DEFAULT_SCENARIO)
  );

  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  
  // Streaming Refs
  const textBuffer = useRef("");
  const analysisRafRef = useRef<number | null>(null);

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

  // OPTIMIZATION: Use refs to store latest scenario/loanAmount so the callback is stable
  // This prevents the AI section from re-rendering on every keystroke
  const latestScenario = useRef(scenario);
  const latestLoanAmount = useRef(loanAmount);

  useEffect(() => {
      latestScenario.current = scenario;
      latestLoanAmount.current = loanAmount;
  }, [scenario, loanAmount]);

  const updateField = (field: keyof LoanScenario, value: number) => {
    setScenario(prev => ({ ...prev, [field]: value }));
  };

  const handleReset = useCallback(() => {
      if(confirm('Reset calculator to defaults?')) {
          setScenario(DEFAULT_SCENARIO);
          setAiAnalysis(null);
          showToast('Calculator reset', 'info');
      }
  }, [showToast]);

  // Optimization: Stabilized handler using refs for data access
  const handleGetAnalysis = useCallback(async () => {
    setLoadingAi(true);
    setAiAnalysis(''); 
    textBuffer.current = "";

    // Access current state via refs to avoid closure staleness without adding dependencies
    const currentScenario = latestScenario.current;
    const currentLoanAmount = latestLoanAmount.current;

    let isStreaming = true;
    const loop = () => {
        if (!isStreaming) return;
        setAiAnalysis(textBuffer.current);
        analysisRafRef.current = requestAnimationFrame(loop);
    };
    loop();

    try {
      const dataStr = `Jumbo Loan Scenario. Price: $${currentScenario.purchasePrice}, Loan: $${currentLoanAmount}, IO: ${currentScenario.isInterestOnly}, Rate: ${currentScenario.interestRate}%, Dwn: ${currentScenario.downPaymentPercent}%`;
      const { streamAnalyzeLoanScenario } = await loadLoanToolsService();
      const stream = streamAnalyzeLoanScenario(dataStr);

      for await (const chunk of stream) {
          if (chunk) {
              textBuffer.current += chunk;
          }
      }
    } catch (e) {
      console.error(e);
      textBuffer.current += "\n\n[Analysis Error: Unable to complete report.]";
      showToast('AI Analysis failed', 'error');
    } finally {
      isStreaming = false;
      if (analysisRafRef.current) cancelAnimationFrame(analysisRafRef.current);
      setAiAnalysis(textBuffer.current);
      setLoadingAi(false);
    }
  }, [showToast]);

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
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-red"
                title="Reset Defaults"
            >
                <RotateCcw size={20} />
            </button>
            <div className="bg-white px-6 py-4 rounded-xl border border-gray-200 shadow-sm text-right flex-1 md:flex-none">
                <span className="block text-gray-400 text-xs uppercase tracking-wider font-semibold mb-1">Est. Monthly Payment</span>
                <span className="text-3xl md:text-4xl font-bold text-brand-red tracking-tight">
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
                  <NumberInput 
                    format="currency"
                    value={scenario.purchasePrice}
                    onChange={(val) => updateField('purchasePrice', val)}
                    className="w-full pl-6 p-3 bg-gray-50 text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red outline-none transition-colors font-medium text-lg"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Down Payment (%)</label>
                  <div className="relative">
                    <NumberInput 
                      format="percent"
                      value={scenario.downPaymentPercent}
                      onChange={(val) => updateField('downPaymentPercent', val)}
                      className="w-full p-3 bg-gray-50 text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red outline-none transition-colors font-medium"
                    />
                    <span className="absolute right-3 top-3 text-gray-400">%</span>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Loan Amount</label>
                  <div className="p-3 bg-gray-100 text-gray-500 rounded-lg border border-transparent font-medium flex items-center h-[50px]">
                    ${(loanAmount / 1000).toFixed(0)}k
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Interest Rate</label>
                  <div className="relative">
                    <NumberInput 
                      format="percent"
                      value={scenario.interestRate}
                      onChange={(val) => updateField('interestRate', val)}
                      className="w-full p-3 bg-gray-50 text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red outline-none transition-colors font-medium"
                    />
                    <span className="absolute right-3 top-3 text-gray-400">%</span>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Term (Years)</label>
                  <NumberInput 
                    value={scenario.loanTerm}
                    onChange={(val) => updateField('loanTerm', val)}
                    className="w-full p-3 bg-gray-50 text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red outline-none transition-colors font-medium"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                 <label className="flex items-center space-x-3 cursor-pointer group select-none">
                    <div className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${scenario.isInterestOnly ? 'bg-brand-red border-brand-red' : 'bg-white border-gray-300'}`}>
                        {scenario.isInterestOnly && <RefreshCcw size={14} className="text-white" />}
                    </div>
                    <input 
                        type="checkbox" 
                        className="hidden"
                        checked={scenario.isInterestOnly}
                        onChange={(e) => setScenario(prev => ({...prev, isInterestOnly: e.target.checked}))}
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
                    <NumberInput 
                      format="percent"
                      value={scenario.propertyTaxRate}
                      onChange={(val) => updateField('propertyTaxRate', val)}
                      className="w-full p-2 bg-gray-50 text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red outline-none"
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Insurance / Yr</label>
                        <NumberInput 
                          format="currency"
                          value={scenario.insuranceAnnual}
                          onChange={(val) => updateField('insuranceAnnual', val)}
                          className="w-full p-2 bg-gray-50 text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red outline-none"
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">HOA / Mo</label>
                        <NumberInput 
                          format="currency"
                          value={scenario.hoaMonthly}
                          onChange={(val) => updateField('hoaMonthly', val)}
                          className="w-full p-2 bg-gray-50 text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red outline-none"
                        />
                     </div>
                 </div>
             </div>
          </div>
        </div>

        {/* Results Column */}
        <div className="xl:col-span-8 flex flex-col gap-8">
           <CalculatorResults chartData={chartData} totalMonthlyPayment={totalMonthlyPayment} />
           <AiAnalysisSection aiAnalysis={aiAnalysis} loadingAi={loadingAi} onGetAnalysis={handleGetAnalysis} />
        </div>
      </div>
    </div>
  );
};