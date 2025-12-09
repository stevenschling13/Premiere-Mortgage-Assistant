
import React, { useState, useMemo, useEffect, useRef, useDeferredValue } from 'react';
import { 
    Users, Search, Plus, Filter, Edit2, Trash2, X, Sparkles, Loader2, 
    Settings, CheckSquare, Square, Check, Clock, Crown, Radar, XCircle, 
    Briefcase, Headphones, Pause, Command, LayoutGrid, List
} from 'lucide-react';
import { Client, ChecklistItem, DealStage, CommandIntent, SavedClientView, Opportunity } from '../types';
import { 
    loadFromStorage, saveToStorage, StorageKeys, 
    transcribeAudio, parseNaturalLanguageCommand, generateMorningMemo, 
    fetchDailyMarketPulse, generateAudioBriefing, scanPipelineOpportunities 
} from '../services';
import { useToast } from './Toast';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ClientDetailView } from './ClientDetailView';
import { INITIAL_CLIENTS, DEFAULT_DEAL_STAGES, COLOR_PALETTE } from '../constants';

// Lead Scoring Logic
const calculateLeadScore = (client: Client, stageWeight: number) => {
    let score = 0;
    score += Math.min(40, (client.loanAmount / 3000000) * 40);
    score += stageWeight * 0.3; 
    if (client.email) score += 5;
    if (client.phone) score += 5;
    if (client.propertyAddress) score += 5;
    const today = new Date();
    const lastAction = new Date(client.nextActionDate);
    const diffDays = (today.getTime() - lastAction.getTime()) / (1000 * 3600 * 24);
    if (diffDays < 3) score += 15;
    else if (diffDays < 7) score += 10;
    else if (diffDays < 14) score += 5;
    return Math.min(100, Math.round(score));
};

interface ClientManagerProps {
    initialSelectedClient?: Client | null;
    onSelectionCleared?: () => void;
}

export const ClientManager: React.FC<ClientManagerProps> = ({ initialSelectedClient, onSelectionCleared }) => {
    const { showToast } = useToast();
    
    // -- Data State --
    const [clients, setClients] = useState<Client[]>(() => {
        const saved = loadFromStorage(StorageKeys.CLIENTS, INITIAL_CLIENTS);
        return Array.isArray(saved) ? saved : INITIAL_CLIENTS;
    });
    
    const [dealStages, setDealStages] = useState<DealStage[]>(() => {
        const saved = loadFromStorage(StorageKeys.DEAL_STAGES, null);
        return Array.isArray(saved) ? saved : DEFAULT_DEAL_STAGES;
    });

    // -- UI State --
    const [selectedClient, setSelectedClient] = useState<Client | null>(initialSelectedClient || null);
    const [searchQuery, setSearchQuery] = useState('');
    const deferredSearchQuery = useDeferredValue(searchQuery);
    const [viewMode, setViewMode] = useState<'LIST' | 'BOARD'>('LIST');
    
    // Handle external selection
    useEffect(() => {
        if (initialSelectedClient) {
            const freshClient = clients.find(c => c.id === initialSelectedClient.id) || initialSelectedClient;
            setSelectedClient(freshClient);
        }
    }, [initialSelectedClient, clients]);

    // -- Dashboard Widgets State --
    const todayStr = new Date().toISOString().split('T')[0];
    const memoKey = `morning_memo_${todayStr}`;
    const [morningMemo, setMorningMemo] = useState<string | null>(() => loadFromStorage(memoKey, null));
    const [loadingMemo, setLoadingMemo] = useState(false);
    const [showMemo, setShowMemo] = useState(true);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [isLoadingAudio, setIsLoadingAudio] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [sentryOpportunities, setSentryOpportunities] = useState<Opportunity[]>([]);
    const [isScanningPipeline, setIsScanningPipeline] = useState(false);
    const [showSentry, setShowSentry] = useState(false);

    // -- Filter State --
    const [statusFilter, setStatusFilter] = useState<string>('All');
    const [loanAmountFilter, setLoanAmountFilter] = useState<string>('All');
    const [dateFilter, setDateFilter] = useState<string>('All');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isManageStagesOpen, setIsManageStagesOpen] = useState(false);
    const [newStageName, setNewStageName] = useState('');
    const [newStageColor, setNewStageColor] = useState(COLOR_PALETTE[0]);

    // -- Bulk Actions State --
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [draggedClientId, setDraggedClientId] = useState<string | null>(null);

    // -- Effects --
    useEffect(() => {
        saveToStorage(StorageKeys.CLIENTS, clients);
    }, [clients]);

    useEffect(() => {
        saveToStorage(StorageKeys.DEAL_STAGES, dealStages);
    }, [dealStages]);

    // -- Computed --
    const getStageColor = (status: string) => dealStages.find(s => s.name === status)?.color || '#64748B';
    
    const getStageProgress = (status: string) => {
        const index = dealStages.findIndex(s => s.name === status);
        if (index === -1) return 10;
        return Math.min(100, Math.max(10, ((index + 1) / dealStages.length) * 100));
    };

    const urgentClients = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        return clients.filter(c => c.nextActionDate <= today && c.status !== 'Closed').slice(0, 5);
    }, [clients]);

    const filteredClients = useMemo(() => {
        const query = deferredSearchQuery.trim().toLowerCase();
        let results = clients.filter(c => {
            if (statusFilter !== 'All' && c.status !== statusFilter) return false;
            if (loanAmountFilter !== 'All') {
                const amount = c.loanAmount;
                if (loanAmountFilter === '<1M' && amount >= 1000000) return false;
                if (loanAmountFilter === '1M-2.5M' && (amount < 1000000 || amount > 2500000)) return false;
                if (loanAmountFilter === '>2.5M' && amount <= 2500000) return false;
            }
            if (dateFilter !== 'All') {
                const today = new Date().toISOString().split('T')[0];
                if (dateFilter === 'Today' && c.nextActionDate !== today) return false;
                if (dateFilter === 'Overdue' && c.nextActionDate >= today) return false;
                if (dateFilter === 'Upcoming') {
                    const nextWeek = new Date();
                    nextWeek.setDate(nextWeek.getDate() + 7);
                    if (c.nextActionDate < today || c.nextActionDate > nextWeek.toISOString().split('T')[0]) return false;
                }
            }
            if (!query) return true;
            return c.name.toLowerCase().includes(query) || 
                   c.email.toLowerCase().includes(query) || 
                   c.propertyAddress.toLowerCase().includes(query);
        });

        // Sort by Lead Score Descending
        results.sort((a, b) => {
            const scoreA = calculateLeadScore(a, getStageProgress(a.status));
            const scoreB = calculateLeadScore(b, getStageProgress(b.status));
            return scoreB - scoreA;
        });

        return results;
    }, [clients, deferredSearchQuery, statusFilter, loanAmountFilter, dateFilter]);

    // -- Handlers --

    const handleSelectClient = (client: Client) => {
        if (selectedIds.size > 0 && viewMode === 'LIST') {
            toggleSelection(client.id);
            return;
        }
        setSelectedClient(client);
    };

    const handleUpdateClient = (updatedClient: Client) => {
        setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
        setSelectedClient(updatedClient);
    };

    const handleCreateClient = () => {
        const newClient: Client = {
            id: Date.now().toString(),
            name: 'New Client',
            email: '',
            phone: '',
            loanAmount: 0,
            propertyAddress: '',
            status: dealStages[0]?.name || 'Lead',
            nextActionDate: new Date().toISOString().split('T')[0],
            notes: '',
            checklist: [],
            emailHistory: []
        };
        setClients(prev => [newClient, ...prev]);
        handleSelectClient(newClient);
    };

    const handleDeleteClient = (id: string) => {
        if (confirm('Are you sure you want to delete this client?')) {
            setClients(prev => prev.filter(c => c.id !== id));
            if (selectedClient?.id === id) {
                setSelectedClient(null);
                if (onSelectionCleared) onSelectionCleared();
            }
            showToast('Client deleted', 'info');
        }
    };

    const handleScanPipeline = async () => {
        setIsScanningPipeline(true);
        setShowSentry(true);
        try {
            const marketData = await fetchDailyMarketPulse();
            const opportunities = await scanPipelineOpportunities(clients, marketData.indices);
            setSentryOpportunities(opportunities);
        } catch (e) {
            console.error(e);
            showToast("Pipeline Scan Failed", "error");
        } finally {
            setIsScanningPipeline(false);
        }
    };

    const handleGenerateMorningMemo = async (forceRefresh = false) => {
        if (!forceRefresh && morningMemo) return;
        setLoadingMemo(true);
        setShowMemo(true);
        if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); }
        setIsPlayingAudio(false);
        try {
            const marketData = await fetchDailyMarketPulse();
            const memo = await generateMorningMemo(urgentClients, marketData);
            setMorningMemo(memo ?? null);
            if (memo) {
                saveToStorage(memoKey, memo);
            }
        } catch (e) {
            showToast("Failed to generate executive brief", "error");
        } finally {
            setLoadingMemo(false);
        }
    };

    const handlePlayBriefing = async () => {
        if (isPlayingAudio && audioRef.current) { audioRef.current.pause(); setIsPlayingAudio(false); return; }
        if (audioUrl && audioRef.current) { audioRef.current.play(); setIsPlayingAudio(true); return; }
        if (!morningMemo) return;
        setIsLoadingAudio(true);
        try {
            const base64Audio = await generateAudioBriefing(morningMemo);
            const binaryString = atob(base64Audio);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) { bytes[i] = binaryString.charCodeAt(i); }
            const blob = new Blob([bytes], { type: 'audio/mp3' });
            const url = URL.createObjectURL(blob);
            setAudioUrl(url);
            setTimeout(() => { if (audioRef.current) { audioRef.current.src = url; audioRef.current.play(); setIsPlayingAudio(true); } }, 50);
        } catch (e) {
            showToast("Failed to generate audio", "error");
        } finally {
            setIsLoadingAudio(false);
        }
    };

    const toggleSelection = (id: string, e?: React.MouseEvent | React.KeyboardEvent) => {
        if (e) e.stopPropagation();
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
            return newSet;
        });
    };

    const executeBulkDelete = () => {
        if(confirm(`Delete ${selectedIds.size} clients?`)) {
            setClients(prev => prev.filter(c => !selectedIds.has(c.id)));
            if (selectedClient && selectedIds.has(selectedClient.id)) setSelectedClient(null);
            showToast(`${selectedIds.size} clients deleted`, 'info');
            setSelectedIds(new Set());
        }
    };

    // --- Drag and Drop Handlers ---
    const handleDragStart = (e: React.DragEvent, clientId: string) => {
        setDraggedClientId(clientId);
        e.dataTransfer.effectAllowed = 'move';
        // Transparent drag image or default
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetStageName: string) => {
        e.preventDefault();
        if (draggedClientId) {
            const client = clients.find(c => c.id === draggedClientId);
            if (client && client.status !== targetStageName) {
                const updatedClient = { ...client, status: targetStageName };
                handleUpdateClient(updatedClient);
                showToast(`Moved to ${targetStageName}`, 'success');
            }
            setDraggedClientId(null);
        }
    };

    return (
        <div className="flex h-full bg-white relative">
            <audio ref={audioRef} onEnded={() => setIsPlayingAudio(false)} className="hidden" />

            {/* Left Panel: List/Board */}
            <div className={`flex-col border-r border-gray-200 w-full ${selectedClient ? 'hidden md:flex md:w-[400px]' : 'flex'} shrink-0 transition-all duration-300`}>
                
                {/* Dashboard Widget Header */}
                <div className="flex flex-col bg-white sticky top-0 z-10 shadow-sm">
                    {/* Widget Content */}
                    <div className="p-4 bg-brand-dark text-white safe-top relative">
                        {/* Quick Command Hint */}
                        <div className="absolute top-2 right-2 text-[10px] text-white/30 hidden md:flex items-center gap-1">
                            <Command size={10} /> + K
                        </div>

                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-lg font-bold flex items-center gap-2"><Briefcase size={18} className="text-brand-gold" /> Dashboard</h2>
                                <div className="text-xs text-gray-300 mt-1 flex items-center">
                                    <span className={`w-2 h-2 rounded-full mr-2 ${urgentClients.length > 0 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></span>
                                    {urgentClients.length} Urgent Tasks
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handleScanPipeline} disabled={isScanningPipeline} className="text-xs bg-brand-gold/20 hover:bg-brand-gold/30 text-brand-gold px-3 py-1.5 rounded-lg flex items-center transition-all border border-brand-gold/20 disabled:opacity-50">
                                    {isScanningPipeline ? <Loader2 size={12} className="animate-spin mr-1"/> : <Radar size={12} className="mr-1"/>} Pipeline Scan
                                </button>
                                <button onClick={() => handleGenerateMorningMemo(true)} disabled={loadingMemo} className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg flex items-center transition-all border border-white/10 disabled:opacity-50">
                                    {loadingMemo ? <Loader2 size={12} className="animate-spin mr-1"/> : <Sparkles size={12} className="text-gray-300 mr-1"/>} {morningMemo ? "Refresh" : "Executive Brief"}
                                </button>
                            </div>
                        </div>
                        {/* Scan Results */}
                        {showSentry && sentryOpportunities.length > 0 && (
                            <div className="mt-3 bg-white/10 rounded-lg border border-white/10 overflow-hidden animate-slide-up relative">
                                <button onClick={() => setShowSentry(false)} className="absolute top-2 right-2 text-gray-400 hover:text-white"><XCircle size={14}/></button>
                                <div className="p-3">
                                    <h4 className="text-[10px] font-bold text-brand-gold uppercase tracking-wider mb-2 flex items-center"><Radar size={10} className="mr-1"/> Pipeline Opportunities</h4>
                                    <div className="space-y-2">{sentryOpportunities.map((opp, idx) => (
                                        <div key={idx} className="bg-brand-dark/50 p-2 rounded border border-white/5 flex items-start cursor-pointer hover:bg-white/5 transition-colors" onClick={() => { const client = clients.find(c => c.id === opp.clientId); if (client) handleSelectClient(client); }}>
                                            <div className={`w-1 h-full rounded-full mr-2 ${opp.priority === 'HIGH' ? 'bg-red-500' : 'bg-blue-400'} shrink-0 mt-1`}></div>
                                            <div><div className="flex justify-between items-center w-full"><span className="text-xs font-bold text-white">{opp.clientName}</span><span className="text-[9px] bg-white/10 px-1 rounded text-gray-300">{opp.trigger}</span></div><p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{opp.action}</p></div>
                                        </div>
                                    ))}</div>
                                </div>
                            </div>
                        )}
                        {/* Memo Display */}
                        {morningMemo && showMemo && !showSentry && (
                            <div className="mt-3 p-3 bg-white/10 rounded-lg border border-white/10 animate-slide-up relative">
                                <div className="flex justify-end absolute top-2 right-2 space-x-1">
                                    <button onClick={handlePlayBriefing} disabled={isLoadingAudio} className="text-gray-400 hover:text-brand-gold transition-colors">{isLoadingAudio ? <Loader2 size={14} className="animate-spin" /> : isPlayingAudio ? <Pause size={14} className="text-brand-gold" /> : <Headphones size={14} />}</button>
                                    <button onClick={() => setShowMemo(false)} className="text-gray-400 hover:text-white"><XCircle size={14} /></button>
                                </div>
                                <div className="text-xs leading-relaxed text-gray-200 pr-6"><MarkdownRenderer content={morningMemo} /></div>
                            </div>
                        )}
                    </div>

                    {/* Filter Bar & View Toggle */}
                    <div className="p-3 border-b border-gray-200 bg-gray-50 flex space-x-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                            <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-red outline-none" />
                        </div>
                        <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg">
                            <button onClick={() => setViewMode('LIST')} className={`p-1.5 rounded transition-all ${viewMode === 'LIST' ? 'bg-white shadow' : 'text-gray-500'}`} title="List View"><List size={16}/></button>
                            <button onClick={() => setViewMode('BOARD')} className={`p-1.5 rounded transition-all ${viewMode === 'BOARD' ? 'bg-white shadow' : 'text-gray-500'}`} title="Board View"><LayoutGrid size={16}/></button>
                        </div>
                        <div className="flex space-x-1">
                            <button onClick={handleCreateClient} className="p-2 bg-brand-red text-white rounded-lg hover:bg-red-700 shadow-sm transition-colors"><Plus size={20} /></button>
                            <button onClick={() => setIsFilterOpen(!isFilterOpen)} className={`p-2 rounded-lg border transition-all ${isFilterOpen ? 'bg-brand-dark text-brand-gold border-brand-dark' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-100'}`}><Filter size={18} /></button>
                        </div>
                    </div>
                    {/* Expandable Filter Panel */}
                    {isFilterOpen && (
                        <div className="p-4 bg-gray-50 border-b border-gray-200 text-sm space-y-4 animate-fade-in relative z-20">
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none"><option value="All">All Statuses</option>{dealStages.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}</select></div>
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label><select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none"><option value="All">Any Date</option><option value="Today">Today</option><option value="Upcoming">Next 7 Days</option></select></div>
                            </div>
                            <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                                <button onClick={() => setIsManageStagesOpen(true)} className="text-xs text-brand-red font-medium hover:underline flex items-center"><Settings size={12} className="mr-1"/> Manage Stages</button>
                                <button onClick={() => setIsFilterOpen(false)} className="text-xs text-gray-500 hover:text-gray-800">Close</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Client List / Board */}
                <div className="flex-1 overflow-y-auto bg-gray-50 h-full">
                    {filteredClients.length === 0 ? <div className="p-8 text-center text-gray-500 text-sm">No clients found.</div> : (
                        viewMode === 'LIST' ? (
                            // List View
                            <div>
                                {filteredClients.map(client => {
                                    const stageProgress = getStageProgress(client.status);
                                    const leadScore = calculateLeadScore(client, stageProgress);
                                    // Temperature visual
                                    let tempColor = 'text-blue-400'; 
                                    let tempIcon = <span className="text-blue-200">❄️</span>;
                                    if (leadScore > 75) { tempColor = 'text-red-500'; tempIcon = <span className="text-red-500 animate-pulse">🔥</span>; }
                                    else if (leadScore > 40) { tempColor = 'text-orange-400'; tempIcon = <span className="text-orange-400">🌤️</span>; }

                                    return (
                                        <div key={client.id} role="button" tabIndex={0} onClick={() => handleSelectClient(client)} className={`relative bg-white border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-all group ${selectedClient?.id === client.id ? 'bg-red-50/50 border-l-4 border-l-brand-red' : 'border-l-4 border-l-transparent'}`}>
                                            <div className="p-4 pb-6">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className={`font-bold text-sm ${selectedClient?.id === client.id ? 'text-brand-red' : 'text-gray-800'}`}>{client.name}</h3>
                                                        {client.loanAmount > 2500000 && <Crown size={12} className="text-brand-gold fill-brand-gold" />}
                                                        <div className="flex items-center text-[10px] bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200" title={`Opportunity Score: ${leadScore}/100`}>
                                                            {tempIcon} <span className={`ml-1 font-bold ${tempColor}`}>{leadScore}</span>
                                                        </div>
                                                    </div>
                                                    <span className="text-[10px] text-gray-400">{new Date(client.nextActionDate).toLocaleDateString(undefined, {month:'numeric', day:'numeric'})}</span>
                                                </div>
                                                <div className="flex justify-between items-end">
                                                    <div className="flex items-center gap-2 text-xs text-gray-600 mb-1 font-medium">
                                                        <span>${(client.loanAmount/1000000).toFixed(2)}M</span><span className="w-1 h-1 bg-gray-300 rounded-full"></span><span style={{color: getStageColor(client.status)}}>{client.status}</span>
                                                    </div>
                                                    <button onClick={(e) => toggleSelection(client.id, e)} className="p-2 -mr-2 cursor-pointer z-10 hover:bg-black/5 rounded-full text-gray-300 hover:text-brand-dark transition-colors">
                                                        {selectedIds.has(client.id) ? <CheckSquare size={18} className="text-brand-red" /> : <Square size={18} />}
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100"><div className="h-full bg-gradient-to-r from-brand-dark to-brand-red transition-all duration-500 opacity-80" style={{ width: `${stageProgress}%` }}/></div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            // Kanban Board View
                            <div className="flex h-full overflow-x-auto p-4 space-x-4">
                                {dealStages.map(stage => (
                                    <div 
                                        key={stage.name} 
                                        className="w-64 flex-shrink-0 flex flex-col bg-gray-100/50 rounded-xl"
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, stage.name)}
                                    >
                                        <div className="p-3 font-bold text-xs text-gray-500 uppercase flex justify-between items-center sticky top-0 bg-gray-100/50 backdrop-blur-sm rounded-t-xl z-10">
                                            <div className="flex items-center">
                                                <div className="w-2 h-2 rounded-full mr-2" style={{backgroundColor: stage.color}}></div>
                                                {stage.name}
                                            </div>
                                            <span className="bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">
                                                {filteredClients.filter(c => c.status === stage.name).length}
                                            </span>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                            {filteredClients.filter(c => c.status === stage.name).map(client => {
                                                const leadScore = calculateLeadScore(client, getStageProgress(client.status));
                                                return (
                                                    <div 
                                                        key={client.id}
                                                        draggable
                                                        onDragStart={(e) => handleDragStart(e, client.id)}
                                                        onClick={() => handleSelectClient(client)}
                                                        className={`bg-white p-3 rounded-lg border border-gray-200 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${
                                                            selectedClient?.id === client.id ? 'ring-2 ring-brand-red border-transparent' : ''
                                                        }`}
                                                    >
                                                        <div className="flex justify-between items-start mb-2">
                                                            <h4 className="font-bold text-sm text-gray-800 truncate">{client.name}</h4>
                                                            {leadScore > 75 && <span className="text-[10px] animate-pulse">🔥</span>}
                                                        </div>
                                                        <div className="flex justify-between items-end">
                                                            <div className="text-xs font-mono text-gray-600 font-bold bg-gray-50 px-1.5 py-0.5 rounded">
                                                                ${(client.loanAmount/1000).toFixed(0)}k
                                                            </div>
                                                            <div className={`text-[10px] ${new Date(client.nextActionDate) <= new Date() ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                                                                {new Date(client.nextActionDate).toLocaleDateString(undefined, {month:'numeric', day:'numeric'})}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* Right Panel: Detail View */}
            <div className={`flex-1 flex-col bg-gray-50 h-full overflow-hidden transition-all duration-300 ${selectedClient ? 'flex fixed inset-0 z-[60] md:static md:z-auto' : 'hidden md:flex'}`}>
                {selectedClient ? (
                    <ClientDetailView 
                        client={selectedClient} 
                        dealStages={dealStages}
                        onUpdate={handleUpdateClient}
                        onDelete={handleDeleteClient}
                        onClose={() => {
                            setSelectedClient(null);
                            if (onSelectionCleared) onSelectionCleared();
                        }}
                    />
                ) : (
                    <div className="hidden md:flex flex-col items-center justify-center h-full text-gray-400 bg-gray-50/50">
                        <div className="bg-gray-100 p-6 rounded-full mb-4"><Users size={48} className="text-gray-300"/></div>
                        <p className="text-lg font-medium text-gray-500">Select a client to view details</p>
                        <p className="text-xs text-gray-400 mt-2 flex items-center">
                            Press <kbd className="mx-1 px-1 bg-gray-200 rounded border border-gray-300 font-mono text-[10px]">Cmd</kbd> + <kbd className="mx-1 px-1 bg-gray-200 rounded border border-gray-300 font-mono text-[10px]">K</kbd> to search
                        </p>
                    </div>
                )}
            </div>

            {/* Manage Stages Modal */}
            {isManageStagesOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={() => setIsManageStagesOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-lg text-brand-dark">Manage Deal Stages</h3><button onClick={() => setIsManageStagesOpen(false)} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} className="text-gray-500"/></button></div>
                        <div className="space-y-2 mb-6 max-h-[300px] overflow-y-auto">{dealStages.map(stage => (<div key={stage.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 group"><div className="flex items-center space-x-3"><div className="w-4 h-4 rounded-full border border-gray-200" style={{backgroundColor: stage.color}}></div><span className="font-medium text-sm text-gray-700">{stage.name}</span></div><button onClick={() => setDealStages(dealStages.filter(s => s.name !== stage.name))} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" disabled={dealStages.length <= 1}><Trash2 size={16}/></button></div>))}</div>
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200"><label className="block text-xs font-bold text-gray-500 uppercase mb-2">Add New Stage</label><div className="flex gap-2 mb-3"><input value={newStageName} onChange={(e) => setNewStageName(e.target.value)} placeholder="Stage Name" className="flex-1 p-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-gold"/><div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1">{COLOR_PALETTE.slice(0, 5).map(color => (<button key={color} onClick={() => setNewStageColor(color)} className={`w-6 h-full rounded transition-transform ${newStageColor === color ? 'scale-110 ring-2 ring-offset-1 ring-gray-400' : ''}`} style={{backgroundColor: color}}/>))}</div></div><button onClick={() => { if (newStageName && !dealStages.find(s => s.name === newStageName)) { setDealStages([...dealStages, { name: newStageName, color: newStageColor }]); setNewStageName(''); } }} disabled={!newStageName.trim()} className="w-full bg-brand-dark text-white py-2 rounded-lg text-sm font-bold hover:bg-gray-800 disabled:opacity-50 transition-colors">Add Stage</button></div>
                    </div>
                </div>
            )}

            {/* Bulk Action Modals */}
            {selectedIds.size > 0 && viewMode === 'LIST' && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-brand-dark text-white px-6 py-3 rounded-full shadow-2xl flex items-center space-x-4 animate-slide-up">
                    <span className="font-bold text-sm">{selectedIds.size} Selected</span>
                    <div className="h-4 w-px bg-white/20"></div>
                    <button onClick={executeBulkDelete} className="flex items-center space-x-2 hover:text-red-300 transition-colors"><Trash2 size={16}/><span className="text-xs font-bold">Delete</span></button>
                    <button onClick={() => toggleSelection('')} className="p-1 hover:bg-white/10 rounded-full"><X size={14}/></button>
                </div>
            )}
        </div>
    );
};
