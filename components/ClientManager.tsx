import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
    Users, Search, Plus, Trash2, X, Loader2, Mic, Square, Edit2, CheckSquare, History, Settings, ChevronRight, Filter as FilterIcon
} from 'lucide-react';
import { Client, ChecklistItem, DealStage, CommandIntent } from '../types';
import { loadFromStorage, saveToStorage, StorageKeys } from '../services/storageService';
import { transcribeAudio, parseNaturalLanguageCommand } from '../services/geminiService';
import { useToast } from './Toast';
import { ClientCard } from './ClientCard';
import { ClientFilters } from './ClientFilters';
import { ClientDetail } from './ClientDetail';

const INITIAL_CLIENTS: Client[] = [];

const DEFAULT_DEAL_STAGES: DealStage[] = [
    { name: 'Lead', color: '#64748B' }, // Slate
    { name: 'Pre-Approval', color: '#3B82F6' }, // Blue
    { name: 'Underwriting', color: '#A855F7' }, // Purple
    { name: 'Clear to Close', color: '#22C55E' }, // Green
    { name: 'Closed', color: '#CD1337' } // Brand Red
];

const COLOR_PALETTE = [
    '#64748B', '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E', '#10B981', '#06B6D4', 
    '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899', '#CD1337', '#F4B23E'
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

    // Voice Command State
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessingVoice, setIsProcessingVoice] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);

    // Microphone cleanup ref
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

    const getStageColor = useCallback((status: string) => {
        return dealStages.find(s => s.name === status)?.color || '#64748B';
    }, [dealStages]);

    // Fuzzy Matching Algorithm
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
            if (name[i] === q[j]) j++;
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
    const toggleSelection = useCallback((id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    }, []);

    const handleSelectClient = useCallback((client: Client) => {
        if (selectedIds.size > 0) {
            toggleSelection(client.id);
            return;
        }
        setSelectedClient(client);
        setIsEditing(false);
        const newRecents = [client.id, ...recentClientIds.filter(id => id !== client.id)].slice(0, 5);
        setRecentClientIds(newRecents);
        saveToStorage(StorageKeys.RECENT_IDS, newRecents);
    }, [selectedIds, recentClientIds, toggleSelection]);

    const selectAllFiltered = () => {
        const ids = filteredClients.map(c => c.id);
        setSelectedIds(new Set(ids));
    };

    const clearSelection = () => {
        setSelectedIds(new Set());
    };

    const executeBulkStatusUpdate = () => {
        if (!bulkTargetStatus) return;
        const updatedClients = clients.map(c => selectedIds.has(c.id) ? { ...c, status: bulkTargetStatus } : c);
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
            if (selectedClient && selectedIds.has(selectedClient.id)) setSelectedClient(null);
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
            if (selectedClient?.id === id) setSelectedClient(null);
            setRecentClientIds(recentClientIds.filter(rid => rid !== id));
            showToast('Client deleted', 'info');
        }
    };

    // Stage Management Handlers
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

    const moveStage = (index: number, direction: 'up' | 'down') => {
        const newStages = [...dealStages];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex >= 0 && targetIndex < newStages.length) {
            [newStages[index], newStages[targetIndex]] = [newStages[targetIndex], newStages[index]];
            setDealStages(newStages);
        }
    };

    // -- Voice Command Logic --
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
                if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
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
                                const transcript = await transcribeAudio(base64Audio, 'audio/webm');
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
                {/* Header (Dynamic: Normal or Bulk Mode) */}
                {selectedIds.size > 0 ? (
                    <div className="p-4 border-b border-gray-200 bg-brand-dark text-white sticky top-0 z-10 animate-fade-in safe-top">
                        <div className="flex justify-between items-center h-[88px]">
                            <div className="flex items-center space-x-3">
                                <button onClick={clearSelection} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                    <X size={20} />
                                </button>
                                <div>
                                    <span className="font-bold text-lg">{selectedIds.size} Selected</span>
                                    <button 
                                        onClick={selectAllFiltered}
                                        className="block text-xs text-brand-gold hover:underline mt-0.5"
                                    >
                                        Select All {filteredClients.length}
                                    </button>
                                </div>
                            </div>
                            <div className="flex space-x-2">
                                <button onClick={() => setShowBulkStatusModal(true)} className="p-2 hover:bg-white/10 rounded-lg transition-colors flex flex-col items-center">
                                    <Edit2 size={18} />
                                    <span className="text-[10px] mt-1">Status</span>
                                </button>
                                <button onClick={() => setShowBulkTaskModal(true)} className="p-2 hover:bg-white/10 rounded-lg transition-colors flex flex-col items-center">
                                    <CheckSquare size={18} />
                                    <span className="text-[10px] mt-1">Task</span>
                                </button>
                                <button onClick={executeBulkDelete} className="p-2 hover:bg-red-500/20 rounded-lg transition-colors flex flex-col items-center text-red-300 hover:text-red-100">
                                    <Trash2 size={18} />
                                    <span className="text-[10px] mt-1">Delete</span>
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-4 border-b border-gray-200 bg-white sticky top-0 z-10 safe-top">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-brand-dark">Clients</h2>
                            <div className="flex space-x-2">
                                <button 
                                    onClick={handleVoiceCommand}
                                    disabled={isProcessingVoice}
                                    className={`p-2 rounded-full transition-all duration-200 border shadow-sm ${
                                        isRecording ? 'bg-red-500 border-red-600 text-white shadow-red-500/30 ring-4 ring-red-100' : isProcessingVoice ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-wait' : 'bg-white border-gray-200 text-gray-600 hover:text-brand-dark hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    {isProcessingVoice ? <Loader2 size={18} className="animate-spin" /> : isRecording ? <Square size={18} fill="currentColor" /> : <Mic size={18} />}
                                </button>
                                <button onClick={() => setIsManageStagesOpen(true)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
                                    <Settings size={18} />
                                </button>
                                <button onClick={handleCreateClient} className="p-2 bg-brand-red text-white rounded-full hover:bg-red-700 transition-colors shadow-sm">
                                    <Plus size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="relative flex space-x-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                <input 
                                    type="text"
                                    placeholder="Search name, address..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-gray-50 text-gray-900 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-red outline-none transition-colors"
                                />
                            </div>
                            <button onClick={() => setIsFilterOpen(!isFilterOpen)} className={`p-2 rounded-lg border ${isFilterOpen ? 'bg-brand-red text-white border-brand-red' : 'bg-white text-gray-500 border-gray-200'}`}>
                                <FilterIcon size={18} />
                            </button>
                        </div>
                        <ClientFilters 
                            isOpen={isFilterOpen}
                            statusFilter={statusFilter}
                            setStatusFilter={setStatusFilter}
                            loanAmountFilter={loanAmountFilter}
                            setLoanAmountFilter={setLoanAmountFilter}
                            dateFilter={dateFilter}
                            setDateFilter={setDateFilter}
                            dealStages={dealStages}
                        />
                    </div>
                )}

                {/* Recents Bar */}
                {selectedIds.size === 0 && showRecents && recentClients.length > 0 && (
                    <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between animate-slide-up shrink-0">
                        <div className="flex items-center space-x-3 overflow-x-auto scrollbar-hide">
                            <History size={14} className="text-gray-400 shrink-0" />
                            {recentClients.map(client => (
                                <button key={client.id} onClick={() => handleSelectClient(client)} className="whitespace-nowrap px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-600 hover:text-brand-red hover:border-brand-red transition-colors">
                                    {client.name}
                                </button>
                            ))}
                        </div>
                        <button onClick={handleClearRecents} className="text-[10px] text-gray-400 hover:text-red-500 ml-2">Clear</button>
                    </div>
                )}

                {/* Client List */}
                <div className="flex-1 overflow-y-auto">
                    {filteredClients.length > 0 ? (
                        filteredClients.map((client) => (
                            <ClientCard 
                                key={client.id}
                                client={client}
                                isSelected={selectedClient?.id === client.id}
                                isBulkSelectionActive={selectedIds.size > 0}
                                isBulkSelected={selectedIds.has(client.id)}
                                stageColor={getStageColor(client.status)}
                                onSelect={handleSelectClient}
                                onToggleBulkSelect={toggleSelection}
                            />
                        ))
                    ) : (
                        <div className="p-8 text-center text-gray-500">
                            {searchQuery ? 'No clients match your search.' : 'No clients found. Add one to get started.'}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel: Detail View */}
            {selectedClient ? (
                <ClientDetail 
                    key={selectedClient.id} // Re-mounts on client change for fresh AI state
                    client={selectedClient}
                    isEditing={isEditing}
                    setIsEditing={setIsEditing}
                    onUpdate={handleUpdateClient}
                    onDelete={handleDeleteClient}
                    onClose={() => setSelectedClient(null)}
                    dealStages={dealStages}
                    getStageColor={getStageColor}
                />
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/50 text-gray-400">
                    <Users size={64} className="mb-4 opacity-20" />
                    <p className="text-lg font-medium">Select a client to view details</p>
                    <p className="text-sm">or click + to add a new relationship</p>
                </div>
            )}

            {/* Stage Manager Modal */}
            {isManageStagesOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-up">
                        <div className="bg-brand-dark text-white p-4 flex justify-between items-center">
                            <h3 className="font-bold">Manage Deal Stages</h3>
                            <button onClick={() => setIsManageStagesOpen(false)} className="text-gray-400 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="p-4 max-h-[60vh] overflow-y-auto">
                            <div className="space-y-2 mb-4">
                                {dealStages.map((stage, index) => (
                                    <div key={stage.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 group">
                                        <div className="flex items-center space-x-3">
                                            <div className="flex flex-col space-y-1">
                                                <button onClick={() => moveStage(index, 'up')} disabled={index === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-30"><ChevronRight size={14} className="-rotate-90"/></button>
                                                <button onClick={() => moveStage(index, 'down')} disabled={index === dealStages.length-1} className="text-gray-400 hover:text-gray-600 disabled:opacity-30"><ChevronRight size={14} className="rotate-90"/></button>
                                            </div>
                                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: stage.color }}></div>
                                            <span className="font-medium text-sm text-gray-900">{stage.name}</span>
                                        </div>
                                        <button onClick={() => removeStage(stage.name)} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center space-x-2 border-t pt-4">
                                <input placeholder="New Stage Name" value={newStageName} onChange={(e) => setNewStageName(e.target.value)} className="flex-1 p-2 border border-gray-300 rounded text-sm outline-none focus:border-brand-red text-gray-900"/>
                                <div className="flex space-x-1">
                                    {COLOR_PALETTE.slice(0, 5).map(c => (
                                        <button key={c} onClick={() => setNewStageColor(c)} className={`w-6 h-6 rounded-full border-2 ${newStageColor === c ? 'border-brand-dark' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                                    ))}
                                </div>
                                <button onClick={addStage} disabled={!newStageName} className="p-2 bg-brand-red text-white rounded hover:bg-red-700 disabled:opacity-50"><Plus size={20}/></button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Status Modal */}
            {showBulkStatusModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full animate-scale-up">
                        <h3 className="font-bold text-lg mb-4 text-brand-dark">Bulk Update Status</h3>
                        <p className="text-sm text-gray-500 mb-4">Move {selectedIds.size} selected clients to:</p>
                        <select value={bulkTargetStatus} onChange={(e) => setBulkTargetStatus(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg mb-6 text-gray-900">
                            <option value="">Select Stage...</option>
                            {dealStages.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                        </select>
                        <div className="flex justify-end space-x-2">
                            <button onClick={() => setShowBulkStatusModal(false)} className="px-4 py-2 text-gray-600 font-medium">Cancel</button>
                            <button onClick={executeBulkStatusUpdate} disabled={!bulkTargetStatus} className="px-4 py-2 bg-brand-red text-white rounded-lg font-bold">Update</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Task Modal */}
            {showBulkTaskModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full animate-scale-up">
                        <h3 className="font-bold text-lg mb-4 text-brand-dark">Bulk Add Task</h3>
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Task</label>
                                <input value={bulkTaskLabel} onChange={(e) => setBulkTaskLabel(e.target.value)} placeholder="e.g. Send Holiday Card" className="w-full p-2 border border-gray-300 rounded-lg text-gray-900" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Due Date (Optional)</label>
                                <input type="date" value={bulkTaskDate} onChange={(e) => setBulkTaskDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg text-gray-900" />
                            </div>
                        </div>
                        <div className="flex justify-end space-x-2">
                            <button onClick={() => setShowBulkTaskModal(false)} className="px-4 py-2 text-gray-600 font-medium">Cancel</button>
                            <button onClick={executeBulkAddTask} disabled={!bulkTaskLabel} className="px-4 py-2 bg-brand-red text-white rounded-lg font-bold">Add Tasks</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};