
import React, { useState } from 'react';
import { BookOpen, Mic, Copy, MessageSquare, Search, FileText, Bookmark, GraduationCap, ChevronRight, Wand2, Loader2, PlayCircle, Plus, Edit, Trash, X } from 'lucide-react';
import { SalesScript, MortgageTerm } from '../types';
import { INITIAL_SCRIPTS, MORTGAGE_TERMS, AGENCY_GUIDELINES } from '../constants';
import { useToast } from './Toast';
import { generateObjectionScript } from '../services';

type Tab = 'SCRIPTS' | 'GUIDELINES' | 'ENCYCLOPEDIA';

export const KnowledgeBase: React.FC = () => {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<Tab>('SCRIPTS');
    const [scripts, setScripts] = useState<SalesScript[]>(INITIAL_SCRIPTS);
    const [searchQuery, setSearchQuery] = useState('');
    
    // AI State
    const [newObjection, setNewObjection] = useState('');
    const [isGeneratingScript, setIsGeneratingScript] = useState(false);

    // Manual Management State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentScript, setCurrentScript] = useState<Partial<SalesScript>>({
        title: '',
        category: 'Objection',
        content: '',
        tags: []
    });

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        showToast('Script copied to clipboard', 'info');
    };

    const handleGenerateScript = async () => {
        if (!newObjection.trim()) return;
        setIsGeneratingScript(true);
        try {
            const script = await generateObjectionScript(newObjection);
            setScripts(prev => [script, ...prev]);
            setNewObjection('');
            showToast('New script added to playbook', 'success');
        } catch (e) {
            console.error(e);
            showToast('Failed to generate script', 'error');
        } finally {
            setIsGeneratingScript(false);
        }
    };

    // Manual Handlers
    const handleOpenAdd = () => {
        setCurrentScript({
            title: '',
            category: 'Objection',
            content: '',
            tags: []
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (script: SalesScript) => {
        setCurrentScript({ ...script });
        setIsModalOpen(true);
    };

    const handleSaveScript = () => {
        if(!currentScript.title || !currentScript.content) {
            showToast('Title and content are required', 'error');
            return;
        }
        
        if (currentScript.id) {
            setScripts(prev => prev.map(s => s.id === currentScript.id ? currentScript as SalesScript : s));
            showToast('Entry updated', 'success');
        } else {
            const newScript = { ...currentScript, id: Date.now().toString(), tags: currentScript.tags || [] } as SalesScript;
            setScripts(prev => [newScript, ...prev]);
            showToast('Entry added manually', 'success');
        }
        setIsModalOpen(false);
    };

    const handleDeleteScript = (id: string) => {
        if(confirm('Delete this entry?')) {
            setScripts(prev => prev.filter(s => s.id !== id));
            showToast('Entry deleted', 'info');
        }
    };

    const filteredScripts = scripts.filter(s => 
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        s.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const filteredTerms = MORTGAGE_TERMS.filter(t => 
        t.term.toLowerCase().includes(searchQuery.toLowerCase()) || 
        t.definition.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in pb-20 md:pb-8 h-full flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4 shrink-0">
                <div>
                    <h2 className="text-3xl font-bold text-brand-dark tracking-tight flex items-center">
                        <GraduationCap className="mr-3 text-brand-gold" size={32}/>
                        Knowledge & Strategy Center
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Master the market with scripts, guidelines, and technical insights.</p>
                </div>
                
                <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm w-full md:w-auto overflow-x-auto">
                    {(['SCRIPTS', 'GUIDELINES', 'ENCYCLOPEDIA'] as Tab[]).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                activeTab === tab ? 'bg-brand-dark text-white shadow' : 'text-gray-500 hover:bg-gray-50'
                            }`}
                        >
                            {tab === 'SCRIPTS' && 'Playbook & Scripts'}
                            {tab === 'GUIDELINES' && 'Underwriting Guidelines'}
                            {tab === 'ENCYCLOPEDIA' && 'Market Encyclopedia'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
                {activeTab === 'SCRIPTS' && (
                    <div className="flex flex-col h-full animate-fade-in">
                        {/* Generator Bar */}
                        <div className="bg-brand-dark p-6 rounded-xl shadow-lg mb-6 shrink-0 text-white">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-bold flex items-center text-brand-gold">
                                    <Wand2 size={18} className="mr-2"/> AI Objection Crusher
                                </h3>
                                <button onClick={handleOpenAdd} className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center">
                                    <Plus size={14} className="mr-1"/> Add Manual Entry
                                </button>
                            </div>
                            <div className="flex gap-2">
                                <input 
                                    value={newObjection}
                                    onChange={(e) => setNewObjection(e.target.value)}
                                    placeholder='Enter objection (e.g. "Closing costs are too high")'
                                    className="flex-1 p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 outline-none focus:border-brand-gold transition-colors text-sm"
                                    onKeyDown={(e) => e.key === 'Enter' && handleGenerateScript()}
                                />
                                <button 
                                    onClick={handleGenerateScript}
                                    disabled={isGeneratingScript || !newObjection}
                                    className="bg-brand-gold text-brand-dark px-6 py-3 rounded-lg font-bold text-sm hover:bg-yellow-500 transition-colors disabled:opacity-50 flex items-center"
                                >
                                    {isGeneratingScript ? <Loader2 size={16} className="animate-spin"/> : "Generate Script"}
                                </button>
                            </div>
                        </div>

                        {/* Search & List */}
                        <div className="flex-1 overflow-y-auto bg-gray-50 rounded-xl border border-gray-200 p-4">
                            <div className="sticky top-0 bg-gray-50 pb-4 z-10">
                                <div className="relative">
                                    <Search className="absolute left-3 top-3 text-gray-400" size={16} />
                                    <input 
                                        type="text" 
                                        placeholder="Search playbook..." 
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 p-2.5 bg-white border border-gray-200 rounded-lg outline-none focus:border-brand-red text-sm"
                                    />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {filteredScripts.map(script => (
                                    <div key={script.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow group relative">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${
                                                    script.category === 'Objection' ? 'bg-red-100 text-red-700' :
                                                    script.category === 'Closing' ? 'bg-green-100 text-green-700' :
                                                    'bg-blue-100 text-blue-700'
                                                }`}>{script.category}</span>
                                                <h4 className="font-bold text-gray-900 mt-2 text-lg">{script.title}</h4>
                                            </div>
                                            <div className="flex space-x-1">
                                                <button onClick={() => handleCopy(script.content)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500" title="Copy Script">
                                                    <Copy size={16}/>
                                                </button>
                                                {/* Edit Controls - Always visible or on hover */}
                                                <button onClick={() => handleOpenEdit(script)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 hover:text-brand-dark" title="Edit Script">
                                                    <Edit size={16}/>
                                                </button>
                                                <button onClick={() => handleDeleteScript(script.id)} className="p-2 hover:bg-red-50 rounded-full text-gray-400 hover:text-red-500" title="Delete Script">
                                                    <Trash size={16}/>
                                                </button>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm text-gray-700 leading-relaxed font-medium">
                                            "{script.content}"
                                        </div>
                                        <div className="mt-3 flex gap-2">
                                            {script.tags.map(tag => (
                                                <span key={tag} className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">#{tag}</span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'GUIDELINES' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in overflow-y-auto p-1">
                        {(Object.entries(AGENCY_GUIDELINES)).map(([key, data]) => (
                            <div key={key} className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden hover:shadow-lg transition-shadow">
                                <div className="p-4 bg-gray-50 border-b border-gray-200">
                                    <h3 className="font-bold text-brand-dark text-lg">{key}</h3>
                                    <p className="text-xs text-gray-500">{data.name}</p>
                                </div>
                                <div className="p-5 flex-1 space-y-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Standard DTI</label>
                                        <div className="text-2xl font-bold text-green-600">{data.standardDTI}%</div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Max Hard Stop</label>
                                        <div className="text-2xl font-bold text-red-500">{data.maxDTI}%</div>
                                    </div>
                                    <div className="pt-2 border-t border-gray-100">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Max LTV</label>
                                        <div className="text-sm font-medium">{data.maxLTV}%</div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Reserves</label>
                                        <div className="text-sm font-medium text-gray-700">{data.reserves}</div>
                                    </div>
                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-xs text-blue-800 leading-snug">
                                        <span className="font-bold mr-1">Note:</span>{data.notes}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'ENCYCLOPEDIA' && (
                    <div className="flex flex-col h-full animate-fade-in">
                        <div className="mb-6 relative">
                            <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
                            <input 
                                type="text" 
                                placeholder="Search definitions (e.g. LLPA, DSCR)..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-gold text-lg shadow-sm"
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredTerms.length > 0 ? filteredTerms.map((term, idx) => (
                                <div key={idx} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:border-brand-gold/50 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-lg text-brand-dark">{term.term}</h4>
                                        <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded uppercase tracking-wide">{term.category}</span>
                                    </div>
                                    <p className="text-sm text-gray-600 leading-relaxed mb-3">{term.definition}</p>
                                    {term.example && (
                                        <div className="bg-brand-light p-3 rounded-lg border border-brand-dark/5 text-xs text-brand-dark/80 italic">
                                            <span className="font-bold not-italic mr-1">Ex:</span> {term.example}
                                        </div>
                                    )}
                                </div>
                            )) : (
                                <div className="col-span-full flex flex-col items-center justify-center text-gray-400 py-12">
                                    <BookOpen size={48} className="mb-4 opacity-20"/>
                                    <p>No terms found.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Manual Script Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg text-gray-900">{currentScript.id ? 'Edit Script' : 'Add New Script'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} className="text-gray-500"/></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title</label>
                                <input 
                                    value={currentScript.title} 
                                    onChange={e => setCurrentScript({...currentScript, title: e.target.value})} 
                                    placeholder="e.g. Rate Lock Pitch" 
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-gold" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
                                <select 
                                    value={currentScript.category} 
                                    onChange={e => setCurrentScript({...currentScript, category: e.target.value as any})}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none"
                                >
                                    <option value="Objection">Objection Handling</option>
                                    <option value="Closing">Closing / Sales</option>
                                    <option value="Update">Status Update</option>
                                    <option value="Prospecting">Prospecting</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Script Content</label>
                                <textarea 
                                    value={currentScript.content} 
                                    onChange={e => setCurrentScript({...currentScript, content: e.target.value})} 
                                    placeholder="Type your script here..." 
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none h-32 resize-none" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tags (comma separated)</label>
                                <input 
                                    value={currentScript.tags?.join(', ')} 
                                    onChange={e => setCurrentScript({...currentScript, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)})} 
                                    placeholder="rates, lock, urgent" 
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none" 
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-gray-500 font-medium hover:bg-gray-50 rounded-lg">Cancel</button>
                                <button onClick={handleSaveScript} className="flex-1 py-3 bg-brand-dark text-white font-bold rounded-lg hover:bg-gray-800 shadow-lg">Save Script</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
