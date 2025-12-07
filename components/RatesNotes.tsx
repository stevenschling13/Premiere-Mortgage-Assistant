import React, { useState, useEffect } from 'react';
import { Save, Calendar, PenTool, Sparkles, Loader2, Copy } from 'lucide-react';
import { analyzeRateTrends } from '../services/geminiService';
import { loadFromStorage, saveToStorage, StorageKeys } from '../services/storageService';
import { useToast } from './Toast';

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

    // Persist changes automatically or on specific trigger? 
    // For notes, let's allow manual save. For rates, auto-save might be annoying if typing.
    // Let's implement manual save for the "Professional Control" feel, or auto-save debounce.
    // For simplicity and control, manual save button acts as the commit.

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
        <div className="p-8 max-w-4xl mx-auto h-full flex flex-col animate-fade-in">
            <div className="mb-6 flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold text-brand-dark">Daily Rates & Scratchpad</h2>
                    <p className="text-gray-500">Record daily par rates and quick call notes.</p>
                </div>
                {lastSaved && <span className="text-xs text-green-600 animate-fade-in">Saved at {lastSaved}</span>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2 text-brand-red">
                            <Calendar size={20} />
                            <h3 className="font-bold">Today's Par Rates</h3>
                        </div>
                        <button 
                            onClick={handleAnalyzeRates}
                            disabled={isAnalyzing}
                            className="text-xs flex items-center bg-brand-light hover:bg-gray-200 text-brand-dark px-2 py-1 rounded transition-colors"
                        >
                            {isAnalyzing ? <Loader2 size={12} className="animate-spin mr-1"/> : <Sparkles size={12} className="mr-1 text-brand-gold"/>}
                            {isAnalyzing ? 'Analyzing...' : 'AI Commentary'}
                        </button>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-gray-700">30-Yr Fixed (Conforming)</label>
                            <div className="relative w-24">
                                <input 
                                    type="text" 
                                    value={rates.conforming30}
                                    onChange={(e) => setRates({...rates, conforming30: e.target.value})}
                                    className="w-full p-2 pr-6 border border-gray-300 rounded text-right font-mono focus:ring-1 focus:ring-brand-red outline-none bg-white text-gray-900"
                                />
                                <span className="absolute right-2 top-2 text-gray-400 text-sm">%</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-gray-700">30-Yr Fixed (Jumbo)</label>
                            <div className="relative w-24">
                                <input 
                                    type="text" 
                                    value={rates.jumbo30}
                                    onChange={(e) => setRates({...rates, jumbo30: e.target.value})}
                                    className="w-full p-2 pr-6 border border-gray-300 rounded text-right font-mono focus:ring-1 focus:ring-brand-red outline-none bg-white text-gray-900"
                                />
                                <span className="absolute right-2 top-2 text-gray-400 text-sm">%</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-gray-700">7/1 ARM (Jumbo)</label>
                            <div className="relative w-24">
                                <input 
                                    type="text" 
                                    value={rates.arm7_1}
                                    onChange={(e) => setRates({...rates, arm7_1: e.target.value})}
                                    className="w-full p-2 pr-6 border border-gray-300 rounded text-right font-mono focus:ring-1 focus:ring-brand-red outline-none bg-white text-gray-900"
                                />
                                <span className="absolute right-2 top-2 text-gray-400 text-sm">%</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-gray-700">5/1 ARM (Jumbo)</label>
                            <div className="relative w-24">
                                <input 
                                    type="text" 
                                    value={rates.arm5_1}
                                    onChange={(e) => setRates({...rates, arm5_1: e.target.value})}
                                    className="w-full p-2 pr-6 border border-gray-300 rounded text-right font-mono focus:ring-1 focus:ring-brand-red outline-none bg-white text-gray-900"
                                />
                                <span className="absolute right-2 top-2 text-gray-400 text-sm">%</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <div className="bg-gradient-to-br from-brand-dark to-slate-800 p-6 rounded-xl text-white shadow-md flex-1">
                        <h3 className="font-bold mb-2">Market Sentiment</h3>
                        <textarea 
                            className="w-full bg-white/10 border border-white/20 rounded-lg p-3 text-sm text-white placeholder-gray-400 h-full resize-none focus:ring-1 focus:ring-brand-gold outline-none scrollbar-thin scrollbar-thumb-white/20"
                            placeholder="e.g. 10-yr treasury yields rising after jobs report..."
                        />
                    </div>
                    {aiCommentary && (
                        <div className="bg-brand-light border border-brand-gold/30 p-4 rounded-xl relative animate-fade-in shadow-sm">
                            <div className="flex justify-between items-start mb-1">
                                <h4 className="text-xs font-bold text-brand-gold uppercase tracking-wider">AI Analysis</h4>
                                <button onClick={() => copyToClipboard(aiCommentary)} className="text-gray-400 hover:text-brand-dark transition-colors">
                                    <Copy size={12}/>
                                </button>
                            </div>
                            <p className="text-xs text-gray-700 italic leading-relaxed">{aiCommentary}</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <div className="flex items-center space-x-2 text-gray-700">
                        <PenTool size={18} />
                        <span className="font-bold">Scratchpad</span>
                    </div>
                    <button 
                        onClick={handleSave}
                        className="flex items-center space-x-2 px-4 py-2 bg-brand-gold text-brand-dark rounded-lg text-sm font-bold hover:bg-yellow-500 transition-all shadow-sm active:scale-95"
                    >
                        <Save size={16} />
                        <span>Save All</span>
                    </button>
                </div>
                <textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="flex-1 w-full p-6 outline-none resize-none font-mono text-sm leading-relaxed text-gray-800 bg-white"
                    placeholder="Type notes here during calls..."
                />
            </div>
        </div>
    );
};