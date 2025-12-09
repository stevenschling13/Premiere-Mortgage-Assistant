
import React, { useState } from 'react';
import { Save, Calendar, PenTool, Sparkles, Loader2, Copy, AlertCircle, Wand2, Mail } from 'lucide-react';
import { analyzeRateTrends, organizeScratchpadNotes, generateRateSheetEmail, loadFromStorage, saveToStorage, StorageKeys } from '../services';
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
    const [generatedBrief, setGeneratedBrief] = useState<string>('');
    
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isFormatting, setIsFormatting] = useState(false);
    const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);

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

    const handleFormatNotes = async () => {
        if (!notes.trim()) {
            showToast('Scratchpad is empty', 'error');
            return;
        }
        setIsFormatting(true);
        try {
            const formatted = await organizeScratchpadNotes(notes);
            setNotes(formatted || notes);
            showToast('Notes formatted by AI', 'success');
        } catch (e) {
            console.error(e);
            showToast('Formatting failed', 'error');
        } finally {
            setIsFormatting(false);
        }
    };

    const handleGenerateBrief = async () => {
        if (!notes.trim()) {
            showToast('Please add some market notes first', 'error');
            return;
        }
        setIsGeneratingBrief(true);
        try {
            const result = await generateRateSheetEmail(rates, notes);
            setGeneratedBrief(result || '');
            showToast('Partner update drafted', 'success');
        } catch (e) {
            console.error(e);
            showToast('Failed to generate brief', 'error');
        } finally {
            setIsGeneratingBrief(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        showToast('Copied to clipboard', 'info');
    };

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto flex flex-col min-h-[calc(100dvh-120px)] md:h-full animate-fade-in">
            <div className="mb-6 flex justify-between items-end shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-brand-dark flex items-center">
                        <Mail className="mr-3 text-brand-gold" size={28}/>
                        Rate Sheet & Briefing Publisher
                    </h2>
                    <p className="text-gray-500 text-sm md:text-base">Daily rate management and partner communication center.</p>
                </div>
                {lastSaved && <span className="text-xs text-green-600 animate-fade-in hidden md:inline">Saved {lastSaved}</span>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                {/* Left Column: Inputs */}
                <div className="flex flex-col gap-6">
                    {/* Rate Card */}
                    <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-2 text-brand-red">
                                <Calendar size={20} />
                                <h3 className="font-bold text-sm md:text-base">Today's Par Rates</h3>
                            </div>
                            <button onClick={handleSave} className="text-xs text-brand-dark hover:text-brand-red font-bold">
                                Save All
                            </button>
                        </div>
                        <div className="space-y-1">
                            <RateInput label="30-Yr Fixed (Conf)" value={rates.conforming30} onChange={(val) => setRates({...rates, conforming30: val})} />
                            <RateInput label="30-Yr Fixed (Jumbo)" value={rates.jumbo30} onChange={(val) => setRates({...rates, jumbo30: val})} />
                            <RateInput label="7/1 ARM (Jumbo)" value={rates.arm7_1} onChange={(val) => setRates({...rates, arm7_1: val})} />
                            <RateInput label="5/1 ARM (Jumbo)" value={rates.arm5_1} onChange={(val) => setRates({...rates, arm5_1: val})} />
                        </div>
                    </div>

                    {/* Scratchpad */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col flex-1 min-h-[300px]">
                        <div className="p-3 md:p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                            <div className="flex items-center space-x-2 text-gray-700">
                                <PenTool size={18} />
                                <span className="font-bold text-sm md:text-base">Market Notes</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={handleFormatNotes}
                                    disabled={isFormatting || !notes.trim()}
                                    className="p-1.5 text-purple-600 hover:bg-purple-50 rounded transition-colors disabled:opacity-50"
                                    title="Auto-organize notes"
                                >
                                    {isFormatting ? <Loader2 size={16} className="animate-spin"/> : <Wand2 size={16} />}
                                </button>
                            </div>
                        </div>
                        <textarea 
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="flex-1 w-full p-4 md:p-6 outline-none resize-none font-mono text-sm leading-relaxed text-gray-800 bg-white rounded-b-xl"
                            placeholder="Type raw market notes here (e.g. '10yr up 5bps, jobs report strong, lock bias')..."
                        />
                    </div>
                </div>

                {/* Right Column: Output / Publisher */}
                <div className="flex flex-col gap-6">
                    {/* Action Bar */}
                    <div className="bg-brand-dark text-white p-4 rounded-xl shadow-md flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-sm">Publisher Actions</h3>
                            <p className="text-xs text-gray-400">Generate professional updates.</p>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={handleAnalyzeRates}
                                disabled={isAnalyzing}
                                className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-colors flex items-center disabled:opacity-50"
                            >
                                {isAnalyzing ? <Loader2 size={14} className="animate-spin mr-1"/> : <Sparkles size={14} className="mr-1 text-brand-gold"/>}
                                Analyze Trends
                            </button>
                            <button 
                                onClick={handleGenerateBrief}
                                disabled={isGeneratingBrief}
                                className="px-3 py-2 bg-brand-red hover:bg-red-700 rounded-lg text-xs font-bold transition-colors flex items-center shadow-lg disabled:opacity-50"
                            >
                                {isGeneratingBrief ? <Loader2 size={14} className="animate-spin mr-1"/> : <Mail size={14} className="mr-1"/>}
                                Draft Partner Update
                            </button>
                        </div>
                    </div>

                    {/* Output Area */}
                    <div className="flex-1 bg-gray-50 rounded-xl border border-gray-200 overflow-hidden flex flex-col relative">
                        {(aiCommentary || generatedBrief) ? (
                            <div className="flex-1 flex flex-col">
                                <div className="bg-white border-b border-gray-200 p-3 flex justify-between items-center">
                                    <span className="text-xs font-bold uppercase text-gray-500 tracking-wider">
                                        {generatedBrief ? "Draft Email Preview" : "Market Analysis"}
                                    </span>
                                    <button 
                                        onClick={() => copyToClipboard(generatedBrief || aiCommentary)}
                                        className="text-xs flex items-center text-gray-600 hover:text-brand-dark"
                                    >
                                        <Copy size={12} className="mr-1"/> Copy Text
                                    </button>
                                </div>
                                <div className="p-6 overflow-y-auto flex-1 bg-white">
                                    <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed whitespace-pre-wrap font-sans">
                                        {generatedBrief || <MarkdownRenderer content={aiCommentary} />}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                                <Mail size={48} className="mb-4 opacity-20"/>
                                <p className="text-sm font-medium">Ready to Publish</p>
                                <p className="text-xs mt-2 max-w-xs">Enter rates and notes on the left, then click "Draft Partner Update" to generate a professional email.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
