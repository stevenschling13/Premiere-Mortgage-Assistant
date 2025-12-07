import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
    Users, Search, Plus, Phone, Mail, MapPin, Calendar, 
    ChevronRight, Filter, History, CheckSquare, 
    ArrowUpRight, Edit2, Trash2, X, Send, Sparkles, Loader2, MoreHorizontal, Settings, GripVertical, Copy, Mic, Square, Check, Layers, ChevronLeft, DollarSign 
} from 'lucide-react';
import { Client, ChecklistItem, EmailLog, ToastType, CommandIntent, DealStage } from '../types';
import { loadFromStorage, saveToStorage, StorageKeys } from '../services/storageService';
import { generateEmailDraft, generateSubjectLines, transcribeAudio, parseNaturalLanguageCommand } from '../services/geminiService';
import { useToast } from './Toast';

const INITIAL_CLIENTS: Client[] = [];

const DEFAULT_DEAL_STAGES: DealStage[] = [
    { name: 'Lead', color: '#64748B' }, // Slate
    { name: 'Pre-Approval', color: '#3B82F6' }, // Blue
    { name: 'Underwriting', color: '#A855F7' }, // Purple
    { name: 'Clear to Close', color: '#22C55E' }, // Green
    { name: 'Closed', color: '#CD1337' } // Brand Red
];

const COLOR_PALETTE = [
    '#64748B', '#EF4444', '#F97316', '#F59E0B', '#84CC16', 
    '#22C55E', '#10B981', '#06B6D4', '#3B82F6', '#6366F1', 
    '#8B5CF6', '#A855F7', '#D946EF', '#EC4899', '#CD1337', '#F4B23E'
];

export const ClientManager: React.FC = () => {
    const { showToast } = useToast();
    
    // -- State --
    const [clients, setClients] = useState<Client[]>(() => loadFromStorage(StorageKeys.CLIENTS, INITIAL_CLIENTS));
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [recentClientIds, setRecentClientIds] = useState<string[]>(() => loadFromStorage(StorageKeys.RECENT_IDS, []));
    const [showRecents, setShowRecents] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    
    // Bulk Actions State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
    const [showBulkTaskModal, setShowBulkTaskModal] = useState(false);
    const [bulkTargetStatus, setBulkTargetStatus] = useState('');
    const [bulkTaskLabel, setBulkTaskLabel] = useState('');
    const [bulkTaskDate, setBulkTaskDate] = useState('');

    // Deal Stage Management
    const [dealStages, setDealStages] = useState<DealStage[]>(() => {
        const saved = loadFromStorage(StorageKeys.DEAL_STAGES, null);
        if (!saved) return DEFAULT_DEAL_STAGES;
        if (saved.length > 0 && typeof saved[0] === 'string') {
            return saved.map((s: string, idx: number) => ({
                name: s,
                color: DEFAULT_DEAL_STAGES[idx % DEFAULT_DEAL_STAGES.length]?.color || '#64748B'
            }));
        }
        return saved;
    });
    const [isManageStagesOpen, setIsManageStagesOpen] = useState(false);
    const [newStageName, setNewStageName] = useState('');
    const [newStageColor, setNewStageColor] = useState(COLOR_PALETTE[0]);

    // Filter State
    const [statusFilter, setStatusFilter] = useState<string>('All');
    const [loanAmountFilter, setLoanAmountFilter] = useState<string>('All');
    const [dateFilter, setDateFilter] = useState<string>('All');
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    // AI Email State
    const [emailDraftTopic, setEmailDraftTopic] = useState('');
    const [isDrafting, setIsDrafting] = useState(false);
    const [currentDraft, setCurrentDraft] = useState('');
    const [suggestedSubjects, setSuggestedSubjects] = useState<string[]>([]);
    const [isGeneratingSubjects, setIsGeneratingSubjects] = useState(false);

    // Voice Command State
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessingVoice, setIsProcessingVoice] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const mountedRef = useRef(true);

    // -- Effects --
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    useEffect(() => {
        saveToStorage(StorageKeys.CLIENTS, clients);
    }, [clients]);

    useEffect(() => {
        saveToStorage(StorageKeys.DEAL_STAGES, dealStages);
    }, [dealStages]);

    // -- Computed --
    const recentClients = useMemo(() => {
        return recentClientIds
            .map(id => clients.find(c => c.id === id))
            .filter((c): c is Client => !!c);
    }, [recentClientIds, clients]);

    const getStageColor = (status: string) => {
        return dealStages.find(s => s.name === status)?.color || '#64748B';
    };

    const calculateMatchScore = (client: Client, query: string): number => {
        if (!query) return 0;
        const q = query.toLowerCase();
        const name = client.name.toLowerCase();
        const address = client.propertyAddress.toLowerCase();
        const notes = client.notes.toLowerCase();

        if (name === q) return 100;
        if (name.startsWith(q)) return 80;
        if (name.includes(q)) return 60;
        
        let i = 0, j = 0;
        while (i < name.length && j < q.length) {
            if (name[i] === q[j]) {
                j++;
            }
            i++;
        }
        if (j === q.length) return 40;
        if (address.includes(q)) return 30;
        if (notes.includes(q)) return 20;

        return 0;
    };

    const filteredClients = useMemo(() => {
        const query = searchQuery.trim();
        
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
            return calculateMatchScore(c, query) > 0;
        });

        if (query) {
            results.sort((a, b) => calculateMatchScore(b, query) - calculateMatchScore(a, query));
        } else {
            results.sort((a, b) => a.nextActionDate.localeCompare(b.nextActionDate));
        }

        return results;
    }, [clients, searchQuery, statusFilter, loanAmountFilter, dateFilter]);

    // -- Handlers --

    const handleSelectClient = (client: Client) => {
        if (selectedIds.size > 0) {
            toggleSelection(client.id);
            return;
        }

        setSelectedClient(client);
        setIsEditing(false);
        setCurrentDraft('');
        setSuggestedSubjects([]);
        
        const newRecents = [client.id, ...recentClientIds.filter(id => id !== client.id)].slice(0, 5);
        setRecentClientIds(newRecents);
        saveToStorage(StorageKeys.RECENT_IDS, newRecents);
    };

    const toggleSelection = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const selectAllFiltered = () => {
        const ids = filteredClients.map(c => c.id);
        setSelectedIds(new Set(ids));
    };

    const clearSelection = () => {
        setSelectedIds(new Set());
    };

    const executeBulkStatusUpdate = () => {
        if (!bulkTargetStatus) return;
        const updatedClients = clients.map(c => {
            if (selectedIds.has(c.id)) {
                return { ...c, status: bulkTargetStatus };
            }
            return c;
        });
        setClients(updatedClients);
        showToast(`Updated ${selectedIds.size} clients to ${bulkTargetStatus}`, 'success');
        clearSelection();
        setShowBulkStatusModal(false);
        setBulkTargetStatus('');
    };

    const executeBulkAddTask = () => {
        if (!bulkTaskLabel) return;
        const updatedClients = clients.map(c => {
            if (selectedIds.has(c.id)) {
                 const newItem: ChecklistItem = {
                    id: Date.now() + Math.random().toString(),
                    label: bulkTaskLabel,
                    checked: false,
                    reminderDate: bulkTaskDate || undefined
                };
                return { ...c, checklist: [...c.checklist, newItem] };
            }
            return c;
        });
        setClients(updatedClients);
        showToast(`Added task to ${selectedIds.size} clients`, 'success');
        clearSelection();
        setShowBulkTaskModal(false);
        setBulkTaskLabel('');
        setBulkTaskDate('');
    };

    const executeBulkDelete = () => {
        if(confirm(`Delete ${selectedIds.size} clients? This action cannot be undone.`)) {
            setClients(clients.filter(c => !selectedIds.has(c.id)));
            setRecentClientIds(recentClientIds.filter(id => !selectedIds.has(id)));
            if (selectedClient && selectedIds.has(selectedClient.id)) {
                setSelectedClient(null);
            }
            showToast(`${selectedIds.size} clients deleted`, 'info');
            clearSelection();
        }
    };

    const handleClearRecents = () => {
        setRecentClientIds([]);
        saveToStorage(StorageKeys.RECENT_IDS, []);
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
        setClients([newClient, ...clients]);
        handleSelectClient(newClient);
        setIsEditing(true);
    };

    const handleUpdateClient = (updatedClient: Client) => {
        setClients(clients.map(c => c.id === updatedClient.id ? updatedClient : c));
        setSelectedClient(updatedClient);
    };

    const handleDeleteClient = (id: string) => {
        if (confirm('Are you sure you want to delete this client?')) {
            setClients(clients.filter(c => c.id !== id));
            if (selectedClient?.id === id) {
                setSelectedClient(null);
            }
            setRecentClientIds(recentClientIds.filter(rid => rid !== id));
            showToast('Client deleted', 'info');
        }
    };

    const handleGenerateEmail = async () => {
        if (!selectedClient || !emailDraftTopic) return;
        setIsDrafting(true);
        try {
            const draft = await generateEmailDraft(selectedClient, emailDraftTopic, 'Standard follow up');
            setCurrentDraft(draft || '');
        } catch (error) {
            showToast('Failed to generate email', 'error');
        } finally {
            setIsDrafting(false);
        }
    };

    const handleGenerateSubjects = async () => {
        if (!selectedClient || !emailDraftTopic) return;
        setIsGeneratingSubjects(true);
        try {
            const subjects = await generateSubjectLines(selectedClient, emailDraftTopic);
            setSuggestedSubjects(subjects);
        } catch (error) {
            showToast('Failed to generate subjects', 'error');
        } finally {
            setIsGeneratingSubjects(false);
        }
    };

    const addStage = () => {
        if (newStageName && !dealStages.find(s => s.name === newStageName)) {
            setDealStages([...dealStages, { name: newStageName, color: newStageColor }]);
            setNewStageName('');
            setNewStageColor(COLOR_PALETTE[0]);
        }
    };

    const removeStage = (stageName: string) => {
        if (confirm(`Remove "${stageName}" stage? Clients with this status will need to be updated.`)) {
            setDealStages(dealStages.filter(s => s.name !== stageName));
        }
    };

    const executeCommand = async (command: CommandIntent) => {
        const { action, payload, clientName } = command;

        const normalizeStatus = (status: string) => {
            const match = dealStages.find(s => s.name.toLowerCase() === status.toLowerCase());
            return match?.name || status;
        };

        if (action === 'CREATE_CLIENT') {
            const newClient: Client = {
                id: Date.now().toString(),
                name: payload.name || 'New Client',
                email: payload.email || '',
                phone: payload.phone || '',
                loanAmount: payload.loanAmount || 0,
                propertyAddress: '', 
                status: payload.status ? normalizeStatus(payload.status) : (dealStages[0]?.name || 'Lead'),
                nextActionDate: payload.date || new Date().toISOString().split('T')[0],
                notes: payload.note || '',
                checklist: payload.taskLabel ? [{ id: Date.now().toString(), label: payload.taskLabel, checked: false }] : [],
                emailHistory: []
            };
            setClients(prev => [newClient, ...prev]);
            handleSelectClient(newClient);
            setIsEditing(true);
            showToast('Draft client created from voice', 'success');
            return;
        }

        let targetClient = selectedClient;

        if (clientName) {
            const candidates = clients.map(c => ({
                 client: c,
                 score: calculateMatchScore(c, clientName)
            })).filter(c => c.score > 0);
            candidates.sort((a, b) => b.score - a.score);
            if (candidates.length > 0 && candidates[0].score >= 30) {
                targetClient = candidates[0].client;
            } else {
                targetClient = null;
            }
        }
        
        if (!targetClient) {
             showToast(clientName ? `Client "${clientName}" not found` : 'No client selected', 'error');
             return;
        }

        const updated = { ...targetClient! };
        let hasUpdates = false;

        if (payload.name) { updated.name = payload.name; hasUpdates = true; }
        if (payload.loanAmount) { updated.loanAmount = payload.loanAmount; hasUpdates = true; }
        if (payload.email) { updated.email = payload.email; hasUpdates = true; }
        if (payload.phone) { updated.phone = payload.phone; hasUpdates = true; }
        if (payload.status) { updated.status = normalizeStatus(payload.status); hasUpdates = true; }
        if (payload.date) { updated.nextActionDate = payload.date; hasUpdates = true; }

        if (action === 'ADD_NOTE' || payload.note) {
             if (payload.note) {
                const timestamp = new Date().toLocaleTimeString();
                const newNote = `[Voice ${timestamp}]: ${payload.note}`;
                updated.notes = updated.notes ? `${updated.notes}\n\n${newNote}` : newNote;
                hasUpdates = true;
             }
        }

        if (action === 'ADD_TASK' || payload.taskLabel) {
            if (payload.taskLabel) {
                updated.checklist = [...updated.checklist, {
                    id: Date.now().toString(),
                    label: payload.taskLabel,
                    checked: false,
                    reminderDate: payload.date
                }];
                hasUpdates = true;
            }
        }

        if (hasUpdates) {
            handleUpdateClient(updated);
            showToast(`Updated ${updated.name}`, 'success');
        } else {
            showToast('Command understood, but no changes needed.', 'info');
        }
    };

    const handleVoiceCommand = async () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
            setIsProcessingVoice(true);
        } else {
            try {
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                }
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                if (!mountedRef.current) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }
                streamRef.current = stream;
                const mediaRecorder = new MediaRecorder(stream);
                mediaRecorderRef.current = mediaRecorder;
                audioChunksRef.current = [];
                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) audioChunksRef.current.push(event.data);
                };
                mediaRecorder.onstop = async () => {
                    if (!mountedRef.current) return;
                    try {
                        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                        const reader = new FileReader();
                        reader.readAsDataURL(audioBlob);
                        reader.onloadend = async () => {
                            const base64Audio = (reader.result as string).split(',')[1];
                            try {
                                showToast('Transcribing audio...', 'info');
                                const transcript = await transcribeAudio(base64Audio);
                                showToast(`Heard: "${transcript}"`, 'info');
                                const command = await parseNaturalLanguageCommand(transcript, dealStages.map(s => s.name));
                                await executeCommand(command);
                            } catch (error) {
                                console.error(error);
                                showToast('Failed to process voice command', 'error');
                            } finally {
                                if (mountedRef.current) setIsProcessingVoice(false);
                                stream.getTracks().forEach(track => track.stop());
                                streamRef.current = null;
                            }
                        };
                    } catch (e) {
                        console.error(e);
                        if (mountedRef.current) setIsProcessingVoice(false);
                    }
                };
                mediaRecorder.start();
                setIsRecording(true);
            } catch (err) {
                console.error('Error accessing microphone:', err);
                showToast('Microphone access denied', 'error');
            }
        }
    };

    return (
        <div className="flex h-full bg-white relative">
            {/* Left Panel: List */}
            <div className={`flex flex-col border-r border-gray-200 w-full md:w-[400px] shrink-0 transition-all duration-300 ${selectedClient ? 'hidden md:flex' : 'flex'}`}>
                
                {/* Header */}
                {selectedIds.size > 0 ? (
                    <div className="p-4 border-b border-gray-200 bg-brand-dark text-white sticky top-0 z-10 animate-fade-in safe-top">
                        <div className="flex justify-between items-center h-[88px]">
                            <div className="flex items-center space-x-3">
                                <button onClick={clearSelection} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                    <X size={20} />
                                </button>
                                <div>
                                    <span className="font-bold text-lg">{selectedIds.size} Selected</span>
                                    <button onClick={selectAllFiltered} className="block text-xs text-brand-gold hover:underline mt-0.5">Select All {filteredClients.length}</button>
                                </div>
                            </div>
                            <div className="flex space-x-2">
                                <button onClick={() => setShowBulkStatusModal(true)} className="p-2 hover:bg-white/10 rounded-lg flex flex-col items-center"><Edit2 size={18} /><span className="text-[10px]">Status</span></button>
                                <button onClick={() => setShowBulkTaskModal(true)} className="p-2 hover:bg-white/10 rounded-lg flex flex-col items-center"><CheckSquare size={18} /><span className="text-[10px]">Task</span></button>
                                <button onClick={executeBulkDelete} className="p-2 hover:bg-red-500/20 rounded-lg flex flex-col items-center text-red-300"><Trash2 size={18} /><span className="text-[10px]">Delete</span></button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-4 border-b border-gray-200 bg-white sticky top-0 z-10 safe-top">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-brand-dark">Clients</h2>
                            <div className="flex space-x-2">
                                <button onClick={handleVoiceCommand} disabled={isProcessingVoice} className={`p-2 rounded-full transition-all border shadow-sm ${isRecording ? 'bg-red-500 text-white' : 'bg-white text-gray-600'}`}>
                                    {isProcessingVoice ? <Loader2 size={18} className="animate-spin" /> : isRecording ? <Square size={18} fill="currentColor" /> : <Mic size={18} />}
                                </button>
                                <button onClick={() => setIsManageStagesOpen(true)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"><Settings size={18} /></button>
                                <button onClick={handleCreateClient} className="p-2 bg-brand-red text-white rounded-full hover:bg-red-700 shadow-sm"><Plus size={20} /></button>
                            </div>
                        </div>
                        <div className="relative flex space-x-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                <input type="text" placeholder="Search name, address..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-red outline-none" />
                            </div>
                            <button onClick={() => setIsFilterOpen(!isFilterOpen)} className={`p-2 rounded-lg border ${isFilterOpen ? 'bg-brand-red text-white' : 'bg-white'}`}><Filter size={18} /></button>
                        </div>
                        {isFilterOpen && (
                            <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm space-y-3 animate-fade-in">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full p-2 bg-white border border-gray-300 rounded"><option value="All">All Statuses</option>{dealStages.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}</select>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Recents Bar */}
                {selectedIds.size === 0 && showRecents && recentClients.length > 0 && (
                    <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between animate-slide-up shrink-0">
                        <div className="flex items-center space-x-3 overflow-x-auto scrollbar-hide">
                            <History size={14} className="text-gray-400 shrink-0"/>
                            {recentClients.map(client => (
                                <button 
                                key={client.id}
                                onClick={() => handleSelectClient(client)}
                                className="text-xs bg-white border border-gray-200 hover:border-brand-red px-2 py-1 rounded-md text-gray-600 whitespace-nowrap transition-colors shadow-sm"
                                >
                                {client.name}
                                </button>
                            ))}
                        </div>
                        <button onClick={handleClearRecents} className="text-[10px] text-gray-400 hover:text-red-500 ml-2">Clear</button>
                    </div>
                )}

                {/* List */}
                <div className="flex-1 overflow-y-auto">
                    {filteredClients.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 text-sm">No clients found.</div>
                    ) : (
                        filteredClients.map(client => (
                            <div 
                                key={client.id}
                                onClick={(e) => handleSelectClient(client)}
                                className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors group ${selectedClient?.id === client.id ? 'bg-red-50 border-l-4 border-l-brand-red' : 'border-l-4 border-l-transparent'}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className={`font-bold text-sm ${selectedClient?.id === client.id ? 'text-brand-red' : 'text-gray-800'}`}>{client.name}</h3>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${getStageColor(client.status)}20`, color: getStageColor(client.status) }}>
                                        {client.status}
                                    </span>
                                </div>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-xs text-gray-500 flex items-center mb-1">
                                            <DollarSign size={10} className="mr-1"/> ${client.loanAmount.toLocaleString()}
                                        </p>
                                        <p className="text-xs text-gray-400 flex items-center">
                                            <Calendar size={10} className="mr-1"/> {new Date(client.nextActionDate).toLocaleDateString()}
                                        </p>
                                    </div>
                                    {selectedIds.size > 0 && (
                                        <div onClick={(e) => toggleSelection(client.id, e)} className="p-2">
                                            {selectedIds.has(client.id) ? <CheckSquare size={16} className="text-brand-red" /> : <Square size={16} className="text-gray-300" />}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Right Panel: Details */}
            <div className={`flex-1 flex flex-col bg-gray-50 h-full overflow-hidden transition-all duration-300 ${selectedClient ? 'flex fixed inset-0 z-20 md:static' : 'hidden md:flex'}`}>
                {selectedClient ? (
                    <div className="flex flex-col h-full bg-white md:bg-gray-50">
                        {/* Detail Header */}
                        <div className="bg-white border-b border-gray-200 p-4 safe-top">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <button onClick={() => setSelectedClient(null)} className="md:hidden mr-3 p-2 text-gray-500 hover:bg-gray-100 rounded-full">
                                        <ChevronLeft size={20}/>
                                    </button>
                                    <div>
                                        {isEditing ? (
                                            <input 
                                                value={selectedClient.name} 
                                                onChange={(e) => handleUpdateClient({...selectedClient, name: e.target.value})}
                                                className="font-bold text-xl text-gray-900 border-b border-gray-300 focus:border-brand-red outline-none" 
                                            />
                                        ) : (
                                            <h2 className="font-bold text-xl text-brand-dark">{selectedClient.name}</h2>
                                        )}
                                        <div className="flex items-center mt-1 space-x-2">
                                            <select 
                                                value={selectedClient.status}
                                                onChange={(e) => handleUpdateClient({...selectedClient, status: e.target.value})}
                                                className="text-xs font-medium bg-gray-100 border-none rounded px-2 py-1 text-gray-700 outline-none cursor-pointer"
                                            >
                                                {dealStages.map(stage => <option key={stage.name} value={stage.name}>{stage.name}</option>)}
                                            </select>
                                            <span className="text-gray-300">|</span>
                                            <span className="text-xs text-gray-500">{selectedClient.email || 'No email'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex space-x-2">
                                    <button onClick={() => setIsEditing(!isEditing)} className={`p-2 rounded-full ${isEditing ? 'bg-brand-red text-white' : 'text-gray-400 hover:bg-gray-100'}`}><Edit2 size={18}/></button>
                                    <button onClick={() => handleDeleteClient(selectedClient.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full"><Trash2 size={18}/></button>
                                </div>
                            </div>
                        </div>

                        {/* Detail Content */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* Loan Info */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                                <h3 className="font-bold text-gray-800 mb-4 flex items-center"><ArrowUpRight size={16} className="mr-2 text-brand-red"/> Loan Scenario</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Loan Amount</label>
                                        <input 
                                            type="number" 
                                            value={selectedClient.loanAmount} 
                                            onChange={(e) => handleUpdateClient({...selectedClient, loanAmount: parseFloat(e.target.value) || 0})}
                                            className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Next Action</label>
                                        <input 
                                            type="date" 
                                            value={selectedClient.nextActionDate} 
                                            onChange={(e) => handleUpdateClient({...selectedClient, nextActionDate: e.target.value})}
                                            className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-sm"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Property Address</label>
                                        <input 
                                            value={selectedClient.propertyAddress} 
                                            onChange={(e) => handleUpdateClient({...selectedClient, propertyAddress: e.target.value})}
                                            className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-sm"
                                            placeholder="Enter address"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Checklist */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                                <h3 className="font-bold text-gray-800 mb-4 flex items-center"><CheckSquare size={16} className="mr-2 text-brand-gold"/> Task Checklist</h3>
                                <div className="space-y-2 mb-4">
                                    {selectedClient.checklist.map(item => (
                                        <div key={item.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                                            <button 
                                                onClick={() => {
                                                    const updatedList = selectedClient.checklist.map(i => i.id === item.id ? {...i, checked: !i.checked} : i);
                                                    handleUpdateClient({...selectedClient, checklist: updatedList});
                                                }}
                                                className={`w-5 h-5 rounded border flex items-center justify-center ${item.checked ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'}`}
                                            >
                                                {item.checked && <Check size={12}/>}
                                            </button>
                                            <span className={`flex-1 text-sm ${item.checked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{item.label}</span>
                                            <button onClick={() => {
                                                handleUpdateClient({...selectedClient, checklist: selectedClient.checklist.filter(i => i.id !== item.id)})
                                            }} className="text-gray-300 hover:text-red-400"><X size={14}/></button>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex space-x-2">
                                    <input 
                                        id="newTaskInput"
                                        placeholder="Add new task..." 
                                        className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded text-sm outline-none"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const val = e.currentTarget.value;
                                                if (val) {
                                                    handleUpdateClient({
                                                        ...selectedClient, 
                                                        checklist: [...selectedClient.checklist, { id: Date.now().toString(), label: val, checked: false }]
                                                    });
                                                    e.currentTarget.value = '';
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            {/* AI Email Drafter */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                                <h3 className="font-bold text-gray-800 mb-4 flex items-center"><Sparkles size={16} className="mr-2 text-brand-red"/> AI Concierge Drafter</h3>
                                <div className="space-y-4">
                                    <input 
                                        placeholder="What is this email about? (e.g. Rate Lock, Pre-Approval)" 
                                        value={emailDraftTopic}
                                        onChange={(e) => setEmailDraftTopic(e.target.value)}
                                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-sm"
                                    />
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={handleGenerateEmail}
                                            disabled={isDrafting || !emailDraftTopic}
                                            className="flex-1 bg-brand-dark text-white py-2 rounded text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                                        >
                                            {isDrafting ? <Loader2 size={14} className="animate-spin mx-auto"/> : 'Draft Email'}
                                        </button>
                                        <button 
                                            onClick={handleGenerateSubjects}
                                            disabled={isGeneratingSubjects || !emailDraftTopic}
                                            className="px-4 border border-gray-300 text-gray-600 rounded text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            {isGeneratingSubjects ? <Loader2 size={14} className="animate-spin"/> : 'Subject Lines'}
                                        </button>
                                    </div>

                                    {suggestedSubjects.length > 0 && (
                                        <div className="bg-blue-50 p-3 rounded text-sm space-y-1">
                                            <p className="font-bold text-blue-800 text-xs uppercase mb-1">Subject Ideas:</p>
                                            {suggestedSubjects.map((sub, i) => (
                                                <div key={i} className="flex justify-between items-center group cursor-pointer" onClick={() => {navigator.clipboard.writeText(sub); showToast('Copied', 'info');}}>
                                                    <span className="text-blue-700">{sub}</span>
                                                    <Copy size={12} className="opacity-0 group-hover:opacity-50"/>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {currentDraft && (
                                        <div className="relative">
                                            <textarea 
                                                value={currentDraft}
                                                onChange={(e) => setCurrentDraft(e.target.value)}
                                                className="w-full h-40 p-3 bg-gray-50 border border-gray-200 rounded text-sm resize-none"
                                            />
                                            <button 
                                                onClick={() => {navigator.clipboard.writeText(currentDraft); showToast('Draft copied', 'success');}}
                                                className="absolute top-2 right-2 p-1 bg-white shadow rounded hover:text-brand-red"
                                            >
                                                <Copy size={14}/>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <Users size={48} className="mb-4 opacity-20" />
                        <p>Select a client to view details</p>
                    </div>
                )}
            </div>

            {/* Modals for Bulk Actions would go here (simplified for brevity) */}
            {showBulkStatusModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-sm">
                        <h3 className="font-bold mb-4">Bulk Update Status</h3>
                        <select className="w-full p-2 border rounded mb-4" value={bulkTargetStatus} onChange={(e) => setBulkTargetStatus(e.target.value)}>
                            <option value="">Select Status</option>
                            {dealStages.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                        </select>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowBulkStatusModal(false)} className="px-4 py-2 text-gray-500">Cancel</button>
                            <button onClick={executeBulkStatusUpdate} className="px-4 py-2 bg-brand-red text-white rounded">Update</button>
                        </div>
                    </div>
                </div>
            )}
             {showBulkTaskModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-sm">
                        <h3 className="font-bold mb-4">Bulk Add Task</h3>
                        <input className="w-full p-2 border rounded mb-2" placeholder="Task description" value={bulkTaskLabel} onChange={(e) => setBulkTaskLabel(e.target.value)} />
                        <input className="w-full p-2 border rounded mb-4" type="date" value={bulkTaskDate} onChange={(e) => setBulkTaskDate(e.target.value)} />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowBulkTaskModal(false)} className="px-4 py-2 text-gray-500">Cancel</button>
                            <button onClick={executeBulkAddTask} className="px-4 py-2 bg-brand-red text-white rounded">Add Task</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};