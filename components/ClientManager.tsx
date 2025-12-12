import React, { useState, useMemo, useEffect, useRef, useDeferredValue, Suspense, useCallback, memo } from 'react';
import { 
    Users, Search, Plus, Filter, Settings, Trash2, X, Sparkles, Loader2, 
    CheckSquare, Square, Radar, XCircle, Briefcase, Headphones, Pause, Check, MoreHorizontal
} from 'lucide-react';
import { FixedSizeList as List, areEqual } from 'react-window';
import { Client, DealStage, Opportunity } from '../types';
import { loadFromStorage, saveToStorage, StorageKeys } from '../services/storageService';
import { 
    streamMorningMemo, fetchDailyMarketPulse, generateAudioBriefing, 
    scanPipelineOpportunities 
} from '../services/geminiService';
import { useToast } from './Toast';
import { MarkdownRenderer } from './MarkdownRenderer';
import { INITIAL_CLIENTS, DEFAULT_DEAL_STAGES, COLOR_PALETTE } from '../constants';
import { Skeleton } from './Skeleton';
import { CreateClientModal } from '../features/clients/components/CreateClientModal';

// Performance: Define import factory for prefetching
const clientDetailViewPromise = () => import('./ClientDetailView');
const ClientDetailView = React.lazy(() => clientDetailViewPromise().then(module => ({ default: module.ClientDetailView })));

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

// --- Container Size Hook for Virtualization ---
const useContainerSize = (ref: React.RefObject<HTMLDivElement | null>) => {
    const [size, setSize] = useState({ width: 0, height: 0 });
    useEffect(() => {
        if (!ref.current) return;
        const observer = new ResizeObserver((entries) => {
            const { width, height } = entries[0].contentRect;
            setSize({ width, height });
        });
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, [ref]);
    return size;
};

// --- SUB-COMPONENT: Memoized List Item (Premium Card Design) ---
interface ClientListItemProps {
    client: Client;
    isSelected: boolean;
    isMultiSelected: boolean;
    onSelect: (client: Client) => void;
    onToggle: (id: string, e: React.MouseEvent) => void;
    onPrefetch: () => void;
    stageColor: string;
    stageProgress: number;
    style?: React.CSSProperties;
}

const ClientListItem = memo(({ client, isSelected, isMultiSelected, onSelect, onToggle, onPrefetch, stageColor, stageProgress, style }: ClientListItemProps) => {
    const leadScore = useMemo(() => calculateLeadScore(client, stageProgress), [client, stageProgress]);
    const initials = useMemo(() => client.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(), [client.name]);
    
    let scoreColor = 'bg-gray-100 text-gray-600'; 
    if (leadScore > 75) scoreColor = 'bg-red-100 text-red-700 font-bold';
    else if (leadScore > 50) scoreColor = 'bg-orange-100 text-orange-700 font-bold';

    // Formatting currency shorthand
    const loanDisplay = client.loanAmount >= 1000000 
        ? `$${(client.loanAmount/1000000).toFixed(2)}M`
        : `$${(client.loanAmount/1000).toFixed(0)}k`;

    return (
        <div style={style} className="w-full box-border px-2 md:px-0 py-1">
            <div 
                role="button" 
                tabIndex={0} 
                onClick={() => onSelect(client)} 
                onMouseEnter={onPrefetch}
                className={`
                    relative h-full flex flex-col justify-between
                    bg-white rounded-xl md:rounded-none md:border-b border-gray-100
                    shadow-sm md:shadow-none border md:border-0 border-gray-200/60
                    hover:bg-gray-50 cursor-pointer transition-all duration-200 group overflow-hidden
                    ${isSelected ? 'ring-2 ring-brand-red ring-inset bg-red-50/20' : ''}
                `}
            >
                <div className="p-3 flex items-center gap-3 h-full">
                    {/* Avatar / Status Indicator */}
                    <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0 transition-transform group-hover:scale-105" 
                        style={{ backgroundColor: stageColor }}
                    >
                        {initials}
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center h-full space-y-0.5">
                        <div className="flex justify-between items-center">
                            <h3 className={`font-bold text-sm truncate ${isSelected ? 'text-brand-red' : 'text-gray-900'}`}>{client.name}</h3>
                            <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">
                                {new Date(client.nextActionDate).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                            </span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span className="font-semibold text-gray-700">{loanDisplay}</span>
                                <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                <span className="truncate max-w-[80px] md:max-w-[120px]">{client.status}</span>
                            </div>
                            
                            {/* Score Badge */}
                            <div className={`text-[10px] px-1.5 py-0.5 rounded-md ${scoreColor} min-w-[24px] text-center`}>
                                {leadScore}
                            </div>
                        </div>
                    </div>

                    {/* Selection Control (Mobile Friendly Hit Area) */}
                    <div 
                        className="shrink-0 h-10 w-8 flex items-center justify-center -mr-1 cursor-pointer"
                        onClick={(e) => onToggle(client.id, e)}
                    >
                        {isMultiSelected ? (
                            <div className="bg-brand-dark text-white rounded-full p-0.5 animate-scale-up">
                                <Check size={14} strokeWidth={3}/>
                            </div>
                        ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-gray-200 group-hover:border-gray-300 transition-colors"></div>
                        )}
                    </div>
                </div>

                {/* Subtle Progress Bar at Bottom */}
                <div className="absolute bottom-0 left-14 right-4 h-0.5 bg-gray-100/50 rounded-full overflow-hidden">
                    <div className="h-full transition-all duration-700 ease-out opacity-60" style={{ width: `${stageProgress}%`, backgroundColor: stageColor }}/>
                </div>
            </div>
        </div>
    );
});

const ClientRow = memo(({ index, style, data }: any) => {
    const { clients, selectedClientId, selectedIds, onSelect, onToggle, onPrefetch, getStageColor, getStageProgress } = data;
    const client = clients[index];
    
    return (
        <ClientListItem 
            style={style}
            client={client}
            isSelected={selectedClientId === client.id}
            isMultiSelected={selectedIds.has(client.id)}
            onSelect={onSelect}
            onToggle={onToggle}
            onPrefetch={onPrefetch}
            stageColor={getStageColor(client.status)}
            stageProgress={getStageProgress(client.status)}
        />
    );
}, areEqual);

// --- SUB-COMPONENT: Pipeline Results (Memoized) ---
const PipelineResults = memo(({ 
    showSentry, 
    isScanningPipeline, 
    sentryOpportunities, 
    setShowSentry, 
    onSelectOpportunity 
}: {
    showSentry: boolean;
    isScanningPipeline: boolean;
    sentryOpportunities: Opportunity[];
    setShowSentry: (show: boolean) => void;
    onSelectOpportunity: (id: string) => void;
}) => {
    if (!showSentry) return null;

    return (
        <div className="mt-3 bg-white/10 rounded-xl border border-white/10 overflow-hidden animate-slide-up relative backdrop-blur-sm">
            <button onClick={() => setShowSentry(false)} className="absolute top-2 right-2 text-white/50 hover:text-white transition-colors"><XCircle size={16}/></button>
            <div className="p-4">
                <h4 className="text-[10px] font-bold text-brand-gold uppercase tracking-wider mb-3 flex items-center">
                    {isScanningPipeline ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Radar size={12} className="mr-1.5"/>}
                    Pipeline Intelligence
                </h4>
                {isScanningPipeline ? (
                    <div className="space-y-3">
                         <div className="bg-brand-dark/40 p-3 rounded-lg border border-white/5 flex items-start">
                             <Skeleton className="w-1 h-8 rounded-full mr-3 bg-white/10" />
                             <div className="w-full">
                                 <div className="flex justify-between items-center w-full mb-1.5">
                                     <Skeleton className="h-3 w-24 bg-white/10" />
                                     <Skeleton className="h-3 w-12 bg-white/10" />
                                 </div>
                                 <Skeleton className="h-2 w-3/4 bg-white/10" />
                             </div>
                        </div>
                    </div>
                ) : sentryOpportunities.length > 0 ? (
                    <div className="space-y-2">
                        {sentryOpportunities.map((opp, idx) => (
                            <div key={idx} className="bg-brand-dark/40 p-3 rounded-lg border border-white/5 flex items-start cursor-pointer hover:bg-white/10 transition-colors group" onClick={() => onSelectOpportunity(opp.clientId)}>
                                <div className={`w-1 h-8 rounded-full mr-3 ${opp.priority === 'HIGH' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-blue-400'} shrink-0 mt-0.5`}></div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center w-full mb-0.5">
                                        <span className="text-xs font-bold text-white truncate">{opp.clientName}</span>
                                        <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-gray-300 whitespace-nowrap">{opp.trigger}</span>
                                    </div>
                                    <p className="text-[10px] text-gray-400 leading-tight truncate group-hover:text-gray-300 transition-colors">{opp.action}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-[10px] text-gray-400 italic text-center py-2">No urgent opportunities detected.</div>
                )}
            </div>
        </div>
    );
});

// --- SUB-COMPONENT: Memo Display (Memoized) ---
const MemoDisplay = memo(({ 
    morningMemo, 
    showMemo, 
    loadingMemo, 
    setShowMemo, 
    onPlayBriefing, 
    isPlayingAudio, 
    isLoadingAudio 
}: {
    morningMemo: string | null;
    showMemo: boolean;
    loadingMemo: boolean;
    setShowMemo: (show: boolean) => void;
    onPlayBriefing: () => void;
    isPlayingAudio: boolean;
    isLoadingAudio: boolean;
}) => {
    if ((!morningMemo && !loadingMemo) || !showMemo) return null;

    return (
         <div className="mt-3 p-4 bg-white/5 rounded-xl border border-white/10 animate-slide-up relative backdrop-blur-sm group">
            <div className="flex justify-end absolute top-3 right-3 space-x-2">
                <button 
                    onClick={onPlayBriefing} 
                    disabled={isLoadingAudio || loadingMemo} 
                    className={`p-1.5 rounded-full transition-all ${isPlayingAudio ? 'bg-brand-gold text-brand-dark' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                >
                    {isLoadingAudio ? <Loader2 size={14} className="animate-spin" /> : isPlayingAudio ? <Pause size={14} fill="currentColor" /> : <Headphones size={14} />}
                </button>
                <button onClick={() => setShowMemo(false)} className="text-gray-400 hover:text-white p-1.5 hover:bg-white/10 rounded-full transition-colors"><X size={14} /></button>
            </div>
            
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center">
                <Sparkles size={10} className="mr-1.5 text-brand-gold"/> Executive Brief
            </h4>

            <div className="text-xs leading-relaxed text-gray-300 pr-8">
                {loadingMemo && !morningMemo ? (
                    <div className="space-y-2.5">
                        <Skeleton className="h-2 w-full bg-white/10" />
                        <Skeleton className="h-2 w-[90%] bg-white/10" />
                        <Skeleton className="h-2 w-[95%] bg-white/10" />
                    </div>
                ) : (
                    <>
                        <div className="max-h-24 overflow-y-auto custom-scrollbar">
                            <MarkdownRenderer content={morningMemo || ''} />
                        </div>
                        {loadingMemo && <span className="inline-block w-1.5 h-3 bg-brand-gold ml-1 animate-pulse align-middle"></span>}
                    </>
                )}
            </div>
        </div>
    );
});

// --- SUB-COMPONENT: Dashboard Header (Memoized) ---
const DashboardHeader = memo(({ 
    urgentCount, 
    onScan, 
    isScanning, 
    onBrief, 
    isBriefing 
}: {
    urgentCount: number;
    onScan: () => void;
    isScanning: boolean;
    onBrief: () => void;
    isBriefing: boolean;
}) => (
    <div className="flex justify-between items-center mb-1">
        <div className="flex items-center">
            <div className="bg-brand-red w-1.5 h-1.5 rounded-full mr-2 animate-pulse shadow-[0_0_8px_rgba(205,19,55,0.8)]"></div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Private Bank Dashboard</h2>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={onScan} 
                disabled={isScanning} 
                className="text-[10px] bg-brand-gold/10 hover:bg-brand-gold/20 text-brand-gold px-2.5 py-1.5 rounded-full flex items-center transition-all border border-brand-gold/20 disabled:opacity-50 font-medium"
            >
                {isScanning ? <Loader2 size={10} className="animate-spin mr-1"/> : <Radar size={10} className="mr-1"/>} 
                {isScanning ? "Scanning" : "Scan"}
            </button>
            <button 
                onClick={onBrief} 
                disabled={isBriefing} 
                className="text-[10px] bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 rounded-full flex items-center transition-all border border-white/10 disabled:opacity-50 font-medium"
            >
                {isBriefing ? <Loader2 size={10} className="animate-spin mr-1"/> : <Sparkles size={10} className="mr-1 opacity-80"/>} 
                {isBriefing ? "Thinking" : "Brief"}
            </button>
        </div>
    </div>
));

// --- SUB-COMPONENT: Dashboard Widgets (Main Container) ---
interface DashboardWidgetsProps {
    urgentClients: Client[];
    onScanPipeline: () => void;
    isScanningPipeline: boolean;
    sentryOpportunities: Opportunity[];
    onSelectOpportunity: (id: string) => void;
    showSentry: boolean;
    setShowSentry: (show: boolean) => void;
    onGenerateMemo: (force: boolean) => Promise<void>;
    morningMemo: string | null;
    loadingMemo: boolean;
    clients: Client[];
}

const DashboardWidgets = memo(({ 
    urgentClients, 
    onScanPipeline, 
    isScanningPipeline, 
    sentryOpportunities, 
    onSelectOpportunity,
    showSentry,
    setShowSentry,
    onGenerateMemo,
    morningMemo,
    loadingMemo,
}: DashboardWidgetsProps) => {
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [isLoadingAudio, setIsLoadingAudio] = useState(false);
    const [showMemo, setShowMemo] = useState(true);
    
    // Audio refs local to this component
    const audioCtxRef = useRef<AudioContext | null>(null);
    const sourceRef = useRef<AudioBufferSourceNode | null>(null);
    const { showToast } = useToast();

    // Cleanup audio
    useEffect(() => {
        return () => {
            if (audioCtxRef.current) {
                audioCtxRef.current.close().catch(console.error);
            }
        };
    }, []);

    // Stabilized handler for playing audio
    const handlePlayBriefing = useCallback(async () => {
        if (isPlayingAudio) {
            if (sourceRef.current) {
                sourceRef.current.stop();
                sourceRef.current = null;
            }
            setIsPlayingAudio(false);
            return;
        }

        if (!morningMemo) return;
        setIsLoadingAudio(true);
        
        try {
            const base64Audio = await generateAudioBriefing(morningMemo);
            const binaryString = atob(base64Audio);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            }
            const ctx = audioCtxRef.current;
            const int16Data = new Int16Array(bytes.buffer);
            const float32Data = new Float32Array(int16Data.length);
            for (let i = 0; i < int16Data.length; i++) {
                float32Data[i] = int16Data[i] / 32768.0;
            }

            const buffer = ctx.createBuffer(1, float32Data.length, 24000);
            buffer.copyToChannel(float32Data, 0);

            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            
            source.onended = () => {
                setIsPlayingAudio(false);
                sourceRef.current = null;
            };

            sourceRef.current = source;
            source.start();
            setIsPlayingAudio(true);

        } catch (e) {
            console.error(e);
            showToast("Failed to play audio briefing", "error");
        } finally {
            setIsLoadingAudio(false);
        }
    }, [isPlayingAudio, morningMemo, showToast]);

    // Stabilized handler for memo button
    const handleMemoClick = useCallback(async () => {
        setShowMemo(true);
        // Stop any current playback if regenerating
        if (sourceRef.current) {
            sourceRef.current.stop();
            setIsPlayingAudio(false);
        }
        await onGenerateMemo(true);
    }, [onGenerateMemo]);

    return (
        <div className="flex flex-col bg-brand-dark/95 shadow-lg shrink-0 relative z-30">
            <div className="p-4 safe-top">
                <DashboardHeader 
                    urgentCount={urgentClients.length}
                    onScan={onScanPipeline}
                    isScanning={isScanningPipeline}
                    onBrief={handleMemoClick}
                    isBriefing={loadingMemo}
                />
                
                {/* Isolated Pipeline Results */}
                <PipelineResults 
                    showSentry={showSentry}
                    isScanningPipeline={isScanningPipeline}
                    sentryOpportunities={sentryOpportunities}
                    setShowSentry={setShowSentry}
                    onSelectOpportunity={onSelectOpportunity}
                />

                {/* Isolated Memo Display */}
                {!showSentry && (
                    <MemoDisplay 
                        morningMemo={morningMemo}
                        showMemo={showMemo}
                        loadingMemo={loadingMemo}
                        setShowMemo={setShowMemo}
                        onPlayBriefing={handlePlayBriefing}
                        isPlayingAudio={isPlayingAudio}
                        isLoadingAudio={isLoadingAudio}
                    />
                )}
            </div>
        </div>
    );
});

// --- SUB-COMPONENT: Filter Toolbar (Memoized) ---
const FilterToolbar = memo(({
    searchQuery,
    onSearchChange,
    onAddClient,
    isFilterOpen,
    onToggleFilter,
    statusFilter,
    setStatusFilter,
    dateFilter,
    setDateFilter,
    dealStages,
    onManageStages,
    onCloseFilters
}: any) => (
    <div className="flex flex-col shrink-0 bg-white/95 backdrop-blur-md shadow-sm z-20 sticky top-0">
        <div className="p-3 border-b border-gray-100 flex space-x-3 items-center">
            <div className="relative flex-1 group">
                <Search className="absolute left-3 top-2.5 text-gray-400 group-focus-within:text-brand-red transition-colors" size={16} />
                <input 
                    type="text" 
                    placeholder="Search clients..." 
                    value={searchQuery} 
                    onChange={(e) => onSearchChange(e.target.value)} 
                    // MOBILE OPTIMIZATION: text-base on mobile prevents iOS zoom, text-sm on desktop
                    className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-base md:text-sm focus:ring-2 focus:ring-brand-red/10 focus:border-brand-red outline-none transition-all" 
                />
            </div>
            <div className="flex space-x-2">
                <button 
                    onClick={onAddClient} 
                    className="p-2.5 bg-brand-red text-white rounded-xl hover:bg-red-700 shadow-md hover:shadow-lg transition-all active:scale-95"
                    aria-label="Add Client"
                >
                    <Plus size={20} />
                </button>
                <button 
                    onClick={onToggleFilter} 
                    className={`p-2.5 rounded-xl border transition-all active:scale-95 ${isFilterOpen ? 'bg-brand-dark text-brand-gold border-brand-dark shadow-inner' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                >
                    <Filter size={18} />
                </button>
            </div>
        </div>
        {isFilterOpen && (
            <div className="p-4 bg-gray-50/50 border-b border-gray-200 text-sm space-y-4 animate-slide-up relative z-10 backdrop-blur-sm">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Status</label>
                        <div className="relative">
                            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full p-2.5 bg-white border border-gray-200 rounded-lg outline-none appearance-none text-gray-700 font-medium shadow-sm">
                                <option value="All">All Statuses</option>
                                {dealStages.map((s:any) => <option key={s.name} value={s.name}>{s.name}</option>)}
                            </select>
                            <MoreHorizontal className="absolute right-3 top-3 text-gray-400 pointer-events-none" size={14}/>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Date</label>
                        <div className="relative">
                            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-full p-2.5 bg-white border border-gray-200 rounded-lg outline-none appearance-none text-gray-700 font-medium shadow-sm">
                                <option value="All">Any Date</option>
                                <option value="Today">Today</option>
                                <option value="Upcoming">Next 7 Days</option>
                            </select>
                            <MoreHorizontal className="absolute right-3 top-3 text-gray-400 pointer-events-none" size={14}/>
                        </div>
                    </div>
                </div>
                <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                    <button onClick={onManageStages} className="text-xs text-brand-dark font-bold hover:text-brand-red flex items-center bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
                        <Settings size={12} className="mr-1.5"/> Manage Stages
                    </button>
                    <button onClick={onCloseFilters} className="text-xs font-medium text-gray-500 hover:text-gray-800">Dismiss</button>
                </div>
            </div>
        )}
    </div>
));


export const ClientManager: React.FC = () => {
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
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const deferredSearchQuery = useDeferredValue(searchQuery);
    const containerRef = useRef<HTMLDivElement>(null);
    const { width: listWidth, height: listHeight } = useContainerSize(containerRef);
    
    // -- Dashboard Widgets State --
    const todayStr = new Date().toISOString().split('T')[0];
    const memoKey = `morning_memo_${todayStr}`;
    const [morningMemo, setMorningMemo] = useState<string | null>(() => loadFromStorage(memoKey, null));
    const [loadingMemo, setLoadingMemo] = useState(false);
    
    // Use ref to track memo content for callback stability without triggering re-creation
    const morningMemoRef = useRef<string | null>(morningMemo);
    useEffect(() => { morningMemoRef.current = morningMemo; }, [morningMemo]);
    
    const [sentryOpportunities, setSentryOpportunities] = useState<Opportunity[]>([]);
    const [isScanningPipeline, setIsScanningPipeline] = useState(false);
    const [showSentry, setShowSentry] = useState(false);

    // -- Filter State --
    const [statusFilter, setStatusFilter] = useState<string>('All');
    const [dateFilter, setDateFilter] = useState<string>('All');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isManageStagesOpen, setIsManageStagesOpen] = useState(false);
    const [newStageName, setNewStageName] = useState('');
    const [newStageColor, setNewStageColor] = useState(COLOR_PALETTE[0]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // -- Bulk Actions State --
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // -- Effects --
    useEffect(() => {
        saveToStorage(StorageKeys.CLIENTS, clients);
    }, [clients]);

    useEffect(() => {
        saveToStorage(StorageKeys.DEAL_STAGES, dealStages);
    }, [dealStages]);

    // -- Computed --
    const getStageColor = useCallback((status: string) => dealStages.find(s => s.name === status)?.color || '#64748B', [dealStages]);
    
    const getStageProgress = useCallback((status: string) => {
        const index = dealStages.findIndex(s => s.name === status);
        if (index === -1) return 10;
        return Math.min(100, Math.max(10, ((index + 1) / dealStages.length) * 100));
    }, [dealStages]);

    const urgentClients = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        return clients.filter(c => c.nextActionDate <= today && c.status !== 'Closed').slice(0, 5);
    }, [clients]);

    const filteredClients = useMemo(() => {
        const query = deferredSearchQuery.trim().toLowerCase();
        let results = clients.filter(c => {
            if (statusFilter !== 'All' && c.status !== statusFilter) return false;
            
            if (dateFilter !== 'All') {
                const today = new Date().toISOString().split('T')[0];
                if (dateFilter === 'Today' && c.nextActionDate !== today) return false;
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
        results.sort((a, b) => new Date(b.nextActionDate).getTime() - new Date(a.nextActionDate).getTime());

        return results;
    }, [clients, deferredSearchQuery, statusFilter, dateFilter]);

    // -- Handlers --
    const toggleSelection = useCallback((id: string, e?: React.MouseEvent | React.KeyboardEvent) => {
        if (e) e.stopPropagation();
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
            return newSet;
        });
    }, []);

    const handleSelectClient = useCallback((client: Client) => {
        setSelectedIds(prev => {
            if (prev.size > 0) {
                 const newSet = new Set(prev);
                 if (newSet.has(client.id)) newSet.delete(client.id); else newSet.add(client.id);
                 return newSet;
            }
            setSelectedClient(client);
            return prev;
        });
    }, []);

    // Stabilized Handlers to prevent ClientDetailView re-renders
    const handleUpdateClient = useCallback((updatedClient: Client) => {
        setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
        setSelectedClient(updatedClient);
    }, []);

    const handleCreateClient = useCallback((newClient: Client) => {
        setClients(prev => [newClient, ...prev]);
        setSelectedClient(newClient);
        showToast('Client created', 'success');
    }, [showToast]);

    const handleDeleteClient = useCallback((id: string) => {
        if (confirm('Are you sure you want to delete this client?')) {
            setClients(prev => prev.filter(c => c.id !== id));
            setSelectedClient(prev => prev?.id === id ? null : prev);
            showToast('Client deleted', 'info');
        }
    }, [showToast]);

    const handleCloseDetail = useCallback(() => {
        setSelectedClient(null);
    }, []);

    const handleScanPipeline = useCallback(async () => {
        setIsScanningPipeline(true);
        setShowSentry(true);
        setSentryOpportunities([]); // Clear previous
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
    }, [clients, showToast]);

    const handleGenerateMorningMemo = useCallback(async (forceRefresh = false) => {
        // Use ref to check existence without adding morningMemo to dep array
        if (!forceRefresh && morningMemoRef.current) return;
        setLoadingMemo(true);
        setMorningMemo(''); // Clear previous
        
        try {
            const marketData = await fetchDailyMarketPulse();
            const stream = streamMorningMemo(urgentClients, marketData);
            let fullText = '';
            for await (const chunk of stream) {
                fullText += chunk;
                setMorningMemo(prev => (prev || '') + chunk);
            }
            saveToStorage(memoKey, fullText);
        } catch (e) {
            showToast("Failed to generate executive brief", "error");
        } finally {
            setLoadingMemo(false);
        }
    }, [urgentClients, memoKey, showToast]);

    const handleSelectOpportunity = useCallback((clientId: string) => {
        const client = clients.find(c => c.id === clientId);
        if (client) handleSelectClient(client);
    }, [clients, handleSelectClient]);

    const executeBulkDelete = useCallback(() => {
        if(confirm(`Delete ${selectedIds.size} clients?`)) {
            setClients(prev => prev.filter(c => !selectedIds.has(c.id)));
            setSelectedClient(prev => prev && selectedIds.has(prev.id) ? null : prev);
            showToast(`${selectedIds.size} clients deleted`, 'info');
            setSelectedIds(new Set());
        }
    }, [selectedIds, showToast]);

    // -- Prefetch Handler --
    const prefetchDetailView = useCallback(() => {
        clientDetailViewPromise(); 
    }, []);
    
    // -- Stage Manager Logic --
    const handleAddStage = () => {
        if (newStageName && !dealStages.find(s => s.name === newStageName)) {
            setDealStages(prev => [...prev, { name: newStageName, color: newStageColor }]);
            setNewStageName('');
        }
    };

    const handleDeleteStage = (name: string) => {
        if (dealStages.length <= 3) { showToast('Must keep at least 3 stages', 'error'); return; }
        setDealStages(prev => prev.filter(s => s.name !== name));
    };

    // -- Memoized Item Data for Virtual List --
    const itemData = useMemo(() => ({
        clients: filteredClients,
        selectedClientId: selectedClient?.id,
        selectedIds: selectedIds,
        onSelect: handleSelectClient,
        onToggle: toggleSelection,
        onPrefetch: prefetchDetailView,
        getStageColor: getStageColor,
        getStageProgress: getStageProgress
    }), [filteredClients, selectedClient?.id, selectedIds, handleSelectClient, toggleSelection, prefetchDetailView, getStageColor, getStageProgress]);

    return (
        <div className="flex h-full bg-gray-50/50 relative overflow-hidden">
            {/* Left Panel: List */}
            <div className={`flex-col border-r border-gray-200 w-full md:w-[400px] shrink-0 transition-all duration-300 flex z-10 bg-white`}>
                
                <DashboardWidgets 
                    urgentClients={urgentClients}
                    clients={clients}
                    morningMemo={morningMemo}
                    loadingMemo={loadingMemo}
                    onGenerateMemo={handleGenerateMorningMemo}
                    isScanningPipeline={isScanningPipeline}
                    onScanPipeline={handleScanPipeline}
                    showSentry={showSentry}
                    setShowSentry={setShowSentry}
                    sentryOpportunities={sentryOpportunities}
                    onSelectOpportunity={handleSelectOpportunity}
                />

                <FilterToolbar
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    onAddClient={() => setIsCreateModalOpen(true)}
                    isFilterOpen={isFilterOpen}
                    onToggleFilter={() => setIsFilterOpen(!isFilterOpen)}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    dateFilter={dateFilter}
                    setDateFilter={setDateFilter}
                    dealStages={dealStages}
                    onManageStages={() => setIsManageStagesOpen(!isManageStagesOpen)}
                    onCloseFilters={() => setIsFilterOpen(false)}
                />

                {isManageStagesOpen && (
                    <div className="p-4 bg-gray-50 border-b border-gray-200 animate-slide-up">
                        <div className="flex justify-between items-center mb-2">
                             <h4 className="font-bold text-xs uppercase text-gray-500">Pipeline Stages</h4>
                             <button onClick={() => setIsManageStagesOpen(false)}><X size={14}/></button>
                        </div>
                        <div className="flex space-x-2 mb-3">
                             <input value={newStageName} onChange={(e) => setNewStageName(e.target.value)} placeholder="New Stage Name" className="flex-1 p-2 border rounded text-xs"/>
                             <input type="color" value={newStageColor} onChange={(e) => setNewStageColor(e.target.value)} className="w-8 h-full p-0 border-0 rounded cursor-pointer"/>
                             <button onClick={handleAddStage} disabled={!newStageName} className="bg-brand-dark text-white p-2 rounded disabled:opacity-50"><Plus size={14}/></button>
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                             {dealStages.map(stage => (
                                 <div key={stage.name} className="flex justify-between items-center p-2 bg-white border rounded text-xs">
                                     <div className="flex items-center"><div className="w-3 h-3 rounded-full mr-2" style={{backgroundColor: stage.color}}></div>{stage.name}</div>
                                     <button onClick={() => handleDeleteStage(stage.name)} className="text-gray-400 hover:text-red-500"><Trash2 size={12}/></button>
                                 </div>
                             ))}
                        </div>
                    </div>
                )}
                
                {selectedIds.size > 0 && (
                    <div className="bg-brand-dark text-white p-3 flex justify-between items-center text-xs px-4 animate-slide-up shadow-md z-10">
                        <div className="flex items-center font-bold">
                            <CheckSquare size={14} className="mr-2"/>
                            {selectedIds.size} Selected
                        </div>
                        <div className="flex space-x-4">
                            <button onClick={executeBulkDelete} className="hover:text-red-300 font-bold transition-colors">Delete Selected</button>
                            <button onClick={() => setSelectedIds(new Set())} className="hover:text-gray-300 transition-colors">Cancel</button>
                        </div>
                    </div>
                )}

                {/* Virtualized Client List */}
                <div className="flex-1 overflow-hidden" ref={containerRef}>
                    {listHeight > 0 && (
                        <List
                            height={listHeight}
                            itemCount={filteredClients.length}
                            itemSize={100} 
                            width={listWidth}
                            itemData={itemData}
                            className="custom-scrollbar pt-2"
                        >
                            {ClientRow}
                        </List>
                    )}
                    {filteredClients.length === 0 && (
                        <div className="p-12 text-center text-gray-400 text-sm flex flex-col items-center">
                            <Users size={48} className="mb-4 opacity-10"/>
                            <p className="font-medium">No clients found.</p>
                            <p className="text-xs mt-1 opacity-60">Adjust filters or add a new client.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel: Detail View (Lazy Loaded) */}
            <div className={`flex-1 flex flex-col h-full bg-gray-50 overflow-hidden absolute md:relative inset-0 z-40 md:z-0 transform transition-transform duration-300 shadow-2xl md:shadow-none ${selectedClient ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
                {selectedClient ? (
                    <Suspense fallback={<div className="flex h-full items-center justify-center bg-white"><Loader2 size={32} className="animate-spin text-brand-red"/></div>}>
                        <ClientDetailView
                            client={selectedClient}
                            dealStages={dealStages}
                            onUpdate={handleUpdateClient}
                            onDelete={handleDeleteClient}
                            onClose={handleCloseDetail}
                        />
                    </Suspense>
                ) : (
                    <div className="hidden md:flex flex-col items-center justify-center h-full text-gray-300 bg-gray-50/50">
                        <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mb-6 shadow-sm">
                            <Users size={48} className="text-gray-300" />
                        </div>
                        <p className="text-xl font-bold text-gray-400">Select a client</p>
                        <p className="text-sm mt-2 max-w-xs text-center text-gray-400">Manage loans, draft emails, and track deal stages.</p>
                    </div>
                )}
            </div>
            <CreateClientModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onCreate={handleCreateClient}
                defaultStatus={dealStages[0]?.name || 'Lead'}
            />
        </div>
    );
};