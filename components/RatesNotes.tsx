import React, { useState } from 'react';
import { Save, Calendar, PenTool, Sparkles, Loader2, Copy, AlertCircle } from 'lucide-react';
import { analyzeRateTrends } from '../services/geminiService';
import { loadFromStorage, saveToStorage, StorageKeys } from '../services/storageService';
import { useToast } from './Toast';
import { MarkdownRenderer } from './MarkdownRenderer';

// Internal Component for Validated Inputs
interface RateInputProps {
    label: string;
    value: string;
    onChange: (val: string) => void;
}

const RateInput: React.FC<RateInputProps> = ({ label, value, onChange }) => {
    // Check if it's a valid number format (allows empty string to be neutral)
    const isValid = value === '' || (!isNaN(parseFloat(value)) && isFinite(Number(value)) && value !== '.');
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        // Regex: Only allow digits and a single decimal point
        if (/^[0-9]*\.?[0-9]*$/.test(val)) {
            onChange(val);
        }
    };

    return (
        <div className="flex items-center justify-between group py-1">
            <label className="text-sm font-medium text-gray-700 group-hover:text-brand-dark transition-colors">{label}</label>
            <div className="relative w-28">
                <input 
                    type="text"
                    inputMode="decimal"
                    value={value}
                    onChange={handleChange}
                    className={`w-full p-2 pr-8 border rounded-lg text-right font-mono text-sm outline-none transition-all shadow-sm
                        ${!isValid 
                            ? 'border-red-300 focus:ring-2 focus:ring-red-100 bg-red-50 text-red-900 placeholder-red-300' 
                            : 'border-gray-300 focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 bg-white text-gray-900'
                        }
                    `}
                    placeholder="0.000"
                />
                <div className="absolute right-2 top-2.5 pointer-events-none flex items-center justify-center">
                    {!isValid ? (
                        <AlertCircle size={14} className="text-red-500 animate-pulse" />
                    ) : (
                        <span className="text-gray-400 text-xs font-medium">%</span>
                    )}
                </div>
            </div>
        </div>
    );
};

export const RatesNotes: React.FC = () => {
    const { showToast } = useToast();

    // Default Rates
    const defaultRates = {
        conforming30: '6.625',
        jumbo30: '6.125',
        arm7_1: '5.875',
        arm5_1: '5.750'
    };

    // Load from storage
    const [rates, setRates] = useState(() => loadFromStorage(StorageKeys.RATES, defaultRates));
    const [notes, setNotes] = useState(() => loadFromStorage(StorageKeys.NOTES, ''));
    
    const [lastSaved, setLastSaved] = useState<string>('');
    const [aiCommentary, setAiCommentary] = useState<string>('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleSave = () => {
        saveToStorage(StorageKeys.RATES, rates);
        saveToStorage(StorageKeys.NOTES, notes);
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString();
        setLastSaved(timeStr);
        showToast('Rates and notes saved successfully', 'success');
    };

    const handleAnalyzeRates = async () => {
        setIsAnalyzing(true);
        try {
            const result = await analyzeRateTrends(rates);
            setAiCommentary(result || 'Unable to generate commentary.');
        } catch (e) {
            console.error(e);
            showToast('Analysis failed', 'error');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        showToast('Copied to clipboard', 'info');
    };

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto flex flex-col min-h-[calc(100dvh-120px)] md:h-full animate-fade-in">
            <div className="mb-6 flex justify-between items-end shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-brand-dark">Daily Rates & Scratchpad</h2>
                    <p className="text-gray-500 text-sm md:text-base">Record daily par rates and quick call notes.</p>
                </div>
                {lastSaved && <span className="text-xs text-green-600 animate-fade-in hidden md:inline">Saved {lastSaved}</span>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6 shrink-0">
                <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2 text-brand-red">
                            <Calendar size={20} />
                            <h3 className="font-bold text-sm md:text-base">Today's Par Rates</h3>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <RateInput 
                            label="30-Yr Fixed (Conf)" 
                            value={rates.conforming30} 
                            onChange={(val) => setRates({...rates, conforming30: val})} 
                        />
                        <RateInput 
                            label="30-Yr Fixed (Jumbo)" 
                            value={rates.jumbo30} 
                            onChange={(val) => setRates({...rates, jumbo30: val})} 
                        />
                        <RateInput 
                            label="7/1 ARM (Jumbo)" 
                            value={rates.arm7_1} 
                            onChange={(val) => setRates({...rates, arm7_1: val})} 
                        />
                        <RateInput 
                            label="5/1 ARM (Jumbo)" 
                            value={rates.arm5_1} 
                            onChange={(val) => setRates({...rates, arm5_1: val})} 
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <div className="bg-gradient-to-br from-brand-dark to-slate-800 p-4 md:p-6 rounded-xl text-white shadow-md flex-1 min-h-[140px]">
                        <div className="flex justify-between items-center mb-2">
                             <h3 className="font-bold text-sm md:text-base">Market Sentiment</h3>
                             <button 
                                onClick={handleAnalyzeRates}
                                disabled={isAnalyzing}
                                className="text-xs flex items-center bg-white/10 hover:bg-white/20 border border-white/20 text-white px-3 py-1.5 rounded-lg transition-all shadow-sm backdrop-blur-sm disabled:opacity-50"
                            >
                                {isAnalyzing ? <Loader2 size={12} className="animate-spin mr-1"/> : <Sparkles size={12} className="mr-1 text-brand-gold"/>}
                                {isAnalyzing ? 'Analyzing...' : 'Generate Analysis'}
                            </button>
                        </div>
                        <div className="h-full relative">
                            <textarea 
                                className="w-full bg-white/10 border border-white/20 rounded-lg p-3 text-sm text-white placeholder-gray-400 h-24 md:h-full resize-none focus:ring-1 focus:ring-brand-gold outline-none scrollbar-thin scrollbar-thumb-white/20"
                                placeholder="e.g. 10-yr treasury yields rising after jobs report..."
                            />
                        </div>
                    </div>
                    {aiCommentary && (
                        <div className="bg-brand-light border border-brand-gold/30 p-4 rounded-xl relative animate-fade-in shadow-sm">
                            <div className="flex justify-between items-start mb-1">
                                <h4 className="text-xs font-bold text-brand-gold uppercase tracking-wider">AI Analysis</h4>
                                <button onClick={() => copyToClipboard(aiCommentary)} className="text-gray-400 hover:text-brand-dark transition-colors">
                                    <Copy size={12}/>
                                </button>
                            </div>
                            <div className="text-xs text-gray-700 italic leading-relaxed">
                                <MarkdownRenderer content={aiCommentary} />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col min-h-[300px] mb-8 md:mb-0">
                <div className="p-3 md:p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <div className="flex items-center space-x-2 text-gray-700">
                        <PenTool size={18} />
                        <span className="font-bold text-sm md:text-base">Scratchpad</span>
                    </div>
                    <button 
                        onClick={handleSave}
                        className="flex items-center space-x-2 px-3 py-1.5 md:px-4 md:py-2 bg-brand-gold text-brand-dark rounded-lg text-sm font-bold hover:bg-yellow-500 transition-all shadow-sm active:scale-95"
                    >
                        <Save size={16} />
                        <span>Save</span>
                    </button>
                </div>
                <textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="flex-1 w-full p-4 md:p-6 outline-none resize-none font-mono text-sm leading-relaxed text-gray-800 bg-white"
                    placeholder="Type notes here during calls..."
                />
            </div>
        </div>
    );
};