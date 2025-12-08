import React, { useState, useMemo, useEffect, useRef, useDeferredValue } from 'react';
import { 
    Users, Search, Plus, Calendar, 
    Filter, History, CheckSquare, 
    ArrowUpRight, Edit2, Trash2, X, Sparkles, Loader2, Settings, Copy, Mic, Square, Check, ChevronLeft, DollarSign, FileText, Bookmark, Save, Zap, Wand2, Send, Mail
} from 'lucide-react';
import { Client, ChecklistItem, DealStage, CommandIntent, SavedClientView, EmailLog } from '../types';
import { loadFromStorage, saveToStorage, StorageKeys } from '../services/storageService';
import { generateEmailDraft, generateSubjectLines, transcribeAudio, parseNaturalLanguageCommand, generateClientSummary, estimatePropertyDetails } from '../services/geminiService';
import { useToast } from './Toast';
import { MarkdownRenderer } from './MarkdownRenderer';

const INITIAL_CLIENTS: Client[] = [
    {
        id: 'seed-john-doe',
        name: 'John Doe',
        loanAmount: 1200000,
        status: 'Lead',
        nextActionDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
        email: 'john.doe@example.com',
        phone: '555-123-4567',
        propertyAddress: '',
        notes: 'New lead added via request.',
        checklist: [
            {
                id: 'task-seed-1',
                label: 'Follow up with lender',
                checked: false,
                reminderDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]
            }
        ],
        emailHistory: []
    }
];

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
    const [clients, setClients] = useState<Client[]>(() => {
        const saved = loadFromStorage(StorageKeys.CLIENTS, INITIAL_CLIENTS);
        return Array.isArray(saved) ? saved : INITIAL_CLIENTS;
    });
    
    const [searchQuery, setSearchQuery] = useState('');
    // Defer the search query to keep typing responsive
    const deferredSearchQuery = useDeferredValue(searchQuery);

    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [recentClientIds, setRecentClientIds] = useState<string[]>(() => {
        const saved = loadFromStorage(StorageKeys.RECENT_IDS, []);
        return Array.isArray(saved) ? saved : [];
    });
    const [showRecents, setShowRecents] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    
    // New Task State
    const [newTaskLabel, setNewTaskLabel] = useState('');
    const [newTaskDate, setNewTaskDate] = useState('');
    const [checklistSearchQuery, setChecklistSearchQuery] = useState('');
    
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
        if (Array.isArray(saved) && saved.length > 0 && typeof saved[0] === 'string') {
            return saved.map((s: string, idx: number) => ({
                name: s,
                color: DEFAULT_DEAL_STAGES[idx % DEFAULT_DEAL_STAGES.length]?.color || '#64748B'
            }));
        }
        return Array.isArray(saved) ? saved : DEFAULT_DEAL_STAGES;
    });
    const [isManageStagesOpen, setIsManageStagesOpen] = useState(false);
    const [newStageName, setNewStageName] = useState('');
    const [newStageColor, setNewStageColor] = useState(COLOR_PALETTE[0]);

    // Filter State
    const [statusFilter, setStatusFilter] = useState<string>('All');
    const [loanAmountFilter, setLoanAmountFilter] = useState<string>('All');
    const [dateFilter, setDateFilter] = useState<string>('All');
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    // Saved Views State
    const [savedViews, setSavedViews] = useState<SavedClientView[]>(() => 
        loadFromStorage(StorageKeys.SAVED_VIEWS, [])
    );
    const [isSavingView, setIsSavingView] = useState(false);
    const [newViewName, setNewViewName] = useState('');

    // AI Features State
    const [emailDraftTopic, setEmailDraftTopic] = useState('');
    const [isDrafting, setIsDrafting] = useState(false);
    const [currentDraft, setCurrentDraft] = useState('');
    const [suggestedSubjects, setSuggestedSubjects] = useState<string[]>([]);
    const [isGeneratingSubjects, setIsGeneratingSubjects] = useState(false);
    const [clientSummary, setClientSummary] = useState('');
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [isEstimatingValue, setIsEstimatingValue] = useState(false);

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

    useEffect(() => {
        saveToStorage(StorageKeys.SAVED_VIEWS, savedViews);
    }, [savedViews]);

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
        const query = deferredSearchQuery.trim();
        
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
    }, [clients, deferredSearchQuery, statusFilter, loanAmountFilter, dateFilter]);

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
        setClientSummary(client.lastSummary || '');
        setNewTaskLabel('');
        setNewTaskDate('');
        setChecklistSearchQuery('');
        
        const newRecents = [client.id, ...recentClientIds.filter(id => id !== client.id)].slice(0, 5);
        setRecentClientIds(newRecents);
        saveToStorage(StorageKeys.RECENT_IDS, newRecents);
    };

    const toggleSelection = (id: string, e?: React.MouseEvent | React.KeyboardEvent) => {
        if (e) {
            e.stopPropagation();
        }
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const selectAllFiltered = () => {
        const ids = filteredClients.map(c => c.id);
        setSelectedIds(new Set(ids));
    };

    const clearSelection = () => {
        setSelectedIds(new Set());
    };

    // View Management Handlers
    const handleSaveView = () => {
        if (!newViewName.trim()) {
            showToast('Please enter a name for the view', 'error');
            return;
        }
        const newView: SavedClientView = {
            id: Date.now().toString(),
            name: newViewName,
            filters: {
                status: statusFilter,
                loanAmount: loanAmountFilter,
                date: dateFilter,
                searchQuery: searchQuery
            }
        };
        setSavedViews(prev => [...prev, newView]);
        setNewViewName('');
        setIsSavingView(false);
        showToast('Filter view saved', 'success');
    };

    const handleLoadView = (view: SavedClientView) => {
        setStatusFilter(view.filters.status);
        setLoanAmountFilter(view.filters.loanAmount);
        setDateFilter(view.filters.date);
        setSearchQuery(view.filters.searchQuery);
        showToast(`Loaded view: ${view.name}`, 'info');
    };

    const handleDeleteView = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSavedViews(prev => prev.filter(v => v.id !== id));
        showToast('View deleted', 'info');
    };

    const executeBulkStatusUpdate = () => {
        if (!bulkTargetStatus) {
            showToast('Please select a status to update to.', 'error');
            return;
        }
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
        if (!bulkTaskLabel) {
            showToast('Please enter a task description.', 'error');
            return;
        }
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
            setClients(prev => prev.filter(c => !selectedIds.has(c.id)));
            setRecentClientIds(prev => prev.filter(id => !selectedIds.has(id)));
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
        setClients(prev => [newClient, ...prev]);
        handleSelectClient(newClient);
        setIsEditing(true);
    };

    const handleUpdateClient = (updatedClient: Client) => {
        setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
        setSelectedClient(updatedClient);
    };

    const handleAddTask = () => {
        if (!newTaskLabel.trim() || !selectedClient) return;
        
        const newItem: ChecklistItem = { 
            id: Date.now().toString(), 
            label: newTaskLabel, 
            checked: false, 
            reminderDate: newTaskDate || undefined
        };

        handleUpdateClient({
            ...selectedClient, 
            checklist: [...selectedClient.checklist, newItem]
        });
        
        setNewTaskLabel('');
        setNewTaskDate('');
    };
    
    const handleDeleteTask = (itemId: string) => {
        if (!selectedClient) return;
        const updatedChecklist = selectedClient.checklist.filter(item => item.id !== itemId);
        handleUpdateClient({ ...selectedClient, checklist: updatedChecklist });
    };
    
    const handleToggleTask = (itemId: string, current: boolean) => {
        if (!selectedClient) return;
        const updatedChecklist = selectedClient.checklist.map(item => 
            item.id === itemId ? { ...item, checked: !current } : item
        );
        handleUpdateClient({ ...selectedClient, checklist: updatedChecklist });
    };

    const addQuickTask = (label: string, daysOffset: number) => {
        if (!selectedClient) return;
        
        const date = new Date();
        if (daysOffset > 0) {
            date.setDate(date.getDate() + daysOffset);
        }
        
        const reminderDate = daysOffset > 0 ? date.toISOString().split('T')[0] : undefined;
        
        const newItem: ChecklistItem = {
            id: Date.now().toString() + Math.random().toString().slice(2),
            label: label,
            checked: false,
            reminderDate: reminderDate
        };

        handleUpdateClient({
            ...selectedClient,
            checklist: [...selectedClient.checklist, newItem]
        });
        showToast('Quick task added', 'success');
    };

    const handleDeleteClient = (id: string) => {
        // Use functional updates for state consistency
        if (confirm('Are you sure you want to delete this client?')) {
            setClients(prev => prev.filter(c => c.id !== id));
            if (selectedClient?.id === id) {
                setSelectedClient(null);
            }
            setRecentClientIds(prev => prev.filter(rid => rid !== id));
            showToast('Client deleted', 'info');
        }
    };

    const handleGenerateEmail = async () => {
        if (!selectedClient || !emailDraftTopic) {
            showToast('Please enter a topic for the email.', 'error');
            return;
        }
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
    
    const handleLogEmail = () => {
        if (!selectedClient || !currentDraft) return;
        
        const newLog: EmailLog = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            subject: suggestedSubjects[0] || emailDraftTopic || "Draft Log",
            body: currentDraft
        };
        
        handleUpdateClient({
            ...selectedClient,
            emailHistory: [newLog, ...(selectedClient.emailHistory || [])]
        });
        
        setCurrentDraft('');
        setEmailDraftTopic('');
        setSuggestedSubjects([]);
        showToast('Communication logged to history', 'success');
    };

    const handleDeleteEmailLog = (logId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!selectedClient || !selectedClient.emailHistory) return;
        
        if (confirm('Delete this record?')) {
            handleUpdateClient({
                ...selectedClient,
                emailHistory: selectedClient.emailHistory.filter(log => log.id !== logId)
            });
            showToast('Record deleted', 'info');
        }
    };

    const handleGenerateSubjects = async () => {
        if (!selectedClient || !emailDraftTopic) {
            showToast('Please enter a topic first.', 'error');
            return;
        }
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

    const handleGenerateSummary = async () => {
        if (!selectedClient) return;
        setIsSummarizing(true);
        try {
            const summary = await generateClientSummary(selectedClient);
            const updatedClient = { ...selectedClient, lastSummary: summary };
            setClientSummary(summary || "No summary available.");
            handleUpdateClient(updatedClient);
        } catch (error) {
            showToast("Failed to generate summary", 'error');
        } finally {
            setIsSummarizing(false);
        }
    };
    
    const handleEstimateValue = async () => {
        if (!selectedClient || !selectedClient.propertyAddress) {
            showToast('Please enter a property address first.', 'error');
            return;
        }
        setIsEstimatingValue(true);
        try {
            const result = await estimatePropertyDetails(selectedClient.propertyAddress);
            if (result.estimatedValue > 0) {
                handleUpdateClient({
                    ...selectedClient,
                    estimatedPropertyValue: result.estimatedValue
                });
                showToast(`Value estimated: $${result.estimatedValue.toLocaleString()}`, 'success');
            } else {
                showToast('Could not find a reliable estimate.', 'info');
            }
        } catch (error) {
            showToast('Error estimating property value', 'error');
        } finally {
            setIsEstimatingValue(false);
        }
    };

    const addStage = () => {
        if (newStageName && !dealStages.find(s => s.name === newStageName)) {
            setDealStages([...dealStages, { name: newStageName, color: newStageColor }]);
            setNewStageName('');
            setNewStageColor(COLOR_PALETTE[0]);
            showToast(`Stage "${newStageName}" added`, 'success');
        }
    };

    const removeStage = (stageName: string) => {
        if (confirm(`Remove "${stageName}" stage? Clients with this status will keep their current label until manually updated.`)) {
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
    
    // LTV Calculation Helper
    const calculateLTV = () => {
        if (!selectedClient?.loanAmount || !selectedClient?.estimatedPropertyValue) return null;
        return (selectedClient.loanAmount / selectedClient.estimatedPropertyValue) * 100;
    };
    
    const ltv = calculateLTV();

    return (
        <div className="flex h-full bg-white relative">
            {/* Left Panel: List */}
            <div className={`flex-col border-r border-gray-200 w-full md:w-[400px] shrink-0 transition-all duration-300 ${selectedClient ? 'hidden md:flex' : 'flex'}`}>
                
                {/* Header */}
                {selectedIds.size > 0 ? (
                    <div className="p-4 border-b border-gray-200 bg-brand-dark text-white sticky top-0 z-10 animate-fade-in safe-top">
                        <div className="flex justify-between items-center h-[88px]">
                            <div className="flex items-center space-x-3">
                                <button onClick={clearSelection} className="p-2 hover:bg-white/10 rounded-full transition-colors" aria-label="Clear Selection">
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
                                <button 
                                    onClick={handleVoiceCommand} 
                                    disabled={isProcessingVoice} 
                                    className={`p-2 rounded-full transition-all border shadow-sm ${isRecording ? 'bg-red-500 text-white' : 'bg-white text-gray-600'}`} 
                                    aria-label="Voice Command"
                                >
                                    {isProcessingVoice ? <Loader2 size={18} className="animate-spin" /> : isRecording ? <Square size={18} fill="currentColor" /> : <Mic size={18} />}
                                </button>
                                <button onClick={() => setIsManageStagesOpen(true)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full" aria-label="Manage Deal Stages" title="Manage Deal Stages"><Settings size={18} /></button>
                                <button onClick={handleCreateClient} className="p-2 bg-brand-red text-white rounded-full hover:bg-red-700 shadow-sm" aria-label="Add Client"><Plus size={20} /></button>
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
                                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-red outline-none" 
                                />
                            </div>
                            <button 
                                onClick={() => setIsFilterOpen(!isFilterOpen)} 
                                className={`p-2 rounded-lg border transition-all ${isFilterOpen ? 'bg-brand-dark text-brand-gold border-brand-dark' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`} 
                                aria-label="Filter Clients"
                            >
                                <Filter size={18} />
                            </button>
                        </div>
                        {isFilterOpen && (
                            <>
                            {/* Backdrop to close filters */}
                            <div className="fixed inset-0 z-10" onClick={() => setIsFilterOpen(false)}></div>
                            <div className="mt-3 p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm space-y-4 animate-fade-in shadow-sm relative z-20">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-brand-gold">
                                            <option value="All">All Statuses</option>
                                            {dealStages.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Loan Volume</label>
                                        <select value={loanAmountFilter} onChange={(e) => setLoanAmountFilter(e.target.value)} className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-brand-gold">
                                            <option value="All">Any Amount</option>
                                            <option value="<1M">Under $1M</option>
                                            <option value="1M-2.5M">$1M - $2.5M</option>
                                            <option value=">2.5M">Over $2.5M</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Next Action</label>
                                        <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-brand-gold">
                                            <option value="All">Any Date</option>
                                            <option value="Today">Today</option>
                                            <option value="Upcoming">Next 7 Days</option>
                                            <option value="Overdue">Overdue</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div className="border-t border-gray-200 pt-3">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="text-xs font-bold text-gray-700 uppercase flex items-center">
                                            <Bookmark size={12} className="mr-1.5"/> Saved Views
                                        </h4>
                                        {!isSavingView && (
                                            <button 
                                                onClick={() => setIsSavingView(true)} 
                                                className="text-[10px] bg-white border border-gray-200 hover:border-brand-gold px-2 py-1 rounded text-gray-600 flex items-center transition-all"
                                            >
                                                <Save size={10} className="mr-1"/> Save Current
                                            </button>
                                        )}
                                    </div>

                                    {isSavingView && (
                                        <div className="flex gap-2 mb-3 bg-white p-2 rounded-lg border border-brand-gold/30 shadow-sm animate-fade-in">
                                            <input 
                                                autoFocus
                                                placeholder="View Name..." 
                                                value={newViewName}
                                                onChange={(e) => setNewViewName(e.target.value)}
                                                className="flex-1 text-xs outline-none bg-transparent"
                                                onKeyDown={(e) => e.key === 'Enter' && handleSaveView()}
                                            />
                                            <button onClick={handleSaveView} disabled={!newViewName.trim()} className="text-brand-dark hover:text-green-600 disabled:opacity-50">
                                                <Check size={14}/>
                                            </button>
                                            <button onClick={() => {setIsSavingView(false); setNewViewName('');}} className="text-gray-400 hover:text-red-500">
                                                <X size={14}/>
                                            </button>
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-2">
                                        {savedViews.length > 0 ? (
                                            savedViews.map(view => (
                                                <div 
                                                    key={view.id} 
                                                    onClick={() => handleLoadView(view)}
                                                    className="group flex items-center pl-2 pr-1 py-1 rounded-md bg-gray-100 border border-transparent hover:bg-white hover:border-brand-dark hover:shadow-sm cursor-pointer transition-all"
                                                >
                                                    <span className="text-xs text-gray-700 group-hover:text-brand-dark font-medium mr-1">{view.name}</span>
                                                    <button 
                                                        onClick={(e) => handleDeleteView(view.id, e)}
                                                        className="p-1 text-gray-400 hover:text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <Trash2 size={10}/>
                                                    </button>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-xs text-gray-400 italic">No saved views yet.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            </>
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
                                role="button"
                                tabIndex={0}
                                onClick={(e) => handleSelectClient(client)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        handleSelectClient(client);
                                    }
                                }}
                                className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors group ${selectedClient?.id === client.id ? 'bg-red-50 border-l-4 border-l-brand-red' : 'border-l-4 border-l-transparent'}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className={`font-bold text-sm ${selectedClient?.id === client.id ? 'text-brand-red' : 'text-gray-800'}`}>{client.name}</h3>
                                    <span 
                                        className="text-[10px] px-2 py-0.5 rounded-full font-bold border transition-colors" 
                                        style={{ 
                                            backgroundColor: `${getStageColor(client.status)}20`, 
                                            color: getStageColor(client.status),
                                            borderColor: `${getStageColor(client.status)}40`
                                        }}
                                    >
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
                                    <button 
                                        onClick={(e) => toggleSelection(client.id, e)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.stopPropagation();
                                                // Default button behavior handles click logic
                                            }
                                        }}
                                        className="p-2 -mr-2 cursor-pointer z-10 hover:bg-black/5 rounded-full"
                                        role="checkbox"
                                        aria-checked={selectedIds.has(client.id)}
                                        aria-label={`Select ${client.name}`}
                                    >
                                        {selectedIds.has(client.id) ? <CheckSquare size={16} className="text-brand-red" /> : <Square size={16} className="text-gray-300" />}
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Right Panel: Details (Mobile Full Screen Overlay, Desktop Side Panel) */}
            <div className={`flex-1 flex-col bg-gray-50 h-full overflow-hidden transition-all duration-300 ${selectedClient ? 'flex fixed inset-0 z-[60] md:static md:z-auto' : 'hidden md:flex'}`}>
                {selectedClient ? (
                    <div className="flex flex-col h-full bg-white md:bg-gray-50">
                        {/* Detail Header */}
                        <div className="bg-white border-b border-gray-200 p-4 safe-top shadow-sm">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <button onClick={() => setSelectedClient(null)} className="md:hidden mr-3 p-2 text-gray-500 hover:bg-gray-100 rounded-full" aria-label="Back">
                                        <ChevronLeft size={24}/>
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
                                            <div className="relative group">
                                                <select 
                                                    value={selectedClient.status}
                                                    onChange={(e) => handleUpdateClient({...selectedClient, status: e.target.value})}
                                                    style={{ 
                                                        backgroundColor: `${getStageColor(selectedClient.status)}20`, 
                                                        color: getStageColor(selectedClient.status),
                                                        borderColor: `${getStageColor(selectedClient.status)}40`
                                                    }}
                                                    className="text-xs font-bold border rounded-full px-3 py-1 pr-7 outline-none cursor-pointer appearance-none transition-all hover:brightness-95"
                                                >
                                                    {dealStages.map(stage => <option key={stage.name} value={stage.name}>{stage.name}</option>)}
                                                    {/* Fallback for statuses not in the list */}
                                                    {!dealStages.find(s => s.name === selectedClient.status) && (
                                                        <option value={selectedClient.status}>{selectedClient.status}</option>
                                                    )}
                                                </select>
                                                <div className="absolute right-2.5 top-1/2 transform -translate-y-1/2 pointer-events-none">
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ color: getStageColor(selectedClient.status) }}>
                                                        <path d="M6 9l6 6 6-6" />
                                                    </svg>
                                                </div>
                                            </div>
                                            <span className="text-gray-300">|</span>
                                            <span className="text-xs font-bold text-gray-700 flex items-center bg-gray-100 px-2 py-0.5 rounded">
                                                <DollarSign size={10} className="mr-1"/>
                                                {selectedClient.loanAmount.toLocaleString()}
                                            </span>
                                            <span className="text-gray-300">|</span>
                                            <span className="text-xs text-gray-500">{selectedClient.email || 'No email'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex space-x-2">
                                    <button 
                                        onClick={handleVoiceCommand} 
                                        disabled={isProcessingVoice} 
                                        className={`p-2 rounded-full transition-all border shadow-sm ${
                                            isRecording 
                                            ? 'bg-red-500 text-white border-red-500 animate-pulse' 
                                            : 'text-gray-400 hover:bg-gray-100 border-transparent'
                                        }`} 
                                        aria-label="Voice Command"
                                        title="Voice Command: Add Note, Task, or Update Status"
                                    >
                                        {isProcessingVoice ? (
                                            <Loader2 size={18} className="animate-spin" />
                                        ) : isRecording ? (
                                            <Square size={18} fill="currentColor" />
                                        ) : (
                                            <Mic size={18} />
                                        )}
                                    </button>
                                    <button onClick={() => setIsEditing(!isEditing)} className={`p-2 rounded-full ${isEditing ? 'bg-brand-red text-white' : 'text-gray-400 hover:bg-gray-100'}`} aria-label="Edit Client"><Edit2 size={18}/></button>
                                    <button 
                                        onClick={() => handleDeleteClient(selectedClient.id)} 
                                        className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors" 
                                        aria-label="Delete Client"
                                    >
                                        <Trash2 size={20}/>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Detail Content */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            
                            {/* Executive Brief Card */}
                            <div className="bg-gradient-to-r from-brand-dark to-slate-800 rounded-xl shadow-lg border border-gray-700 p-5 text-white">
                                <div className="flex justify-between items-start mb-3">
                                    <h3 className="font-bold flex items-center text-brand-gold"><Sparkles size={16} className="mr-2"/> Executive Brief</h3>
                                    <button 
                                        onClick={handleGenerateSummary}
                                        disabled={isSummarizing}
                                        className="text-[10px] bg-white/10 hover:bg-white/20 px-2 py-1 rounded transition-colors disabled:opacity-50 flex items-center"
                                    >
                                        {isSummarizing ? <Loader2 size={10} className="animate-spin mr-1"/> : (clientSummary ? "Refresh Brief" : "Generate Brief")}
                                    </button>
                                </div>
                                <div className="bg-white/5 rounded-lg p-3 min-h-[60px]">
                                    {isSummarizing ? (
                                        <div className="flex items-center justify-center h-full text-xs text-gray-400 animate-pulse">
                                            Analyzing deal structure...
                                        </div>
                                    ) : clientSummary ? (
                                        <div className="text-sm text-gray-200 leading-relaxed">
                                            <MarkdownRenderer content={clientSummary} />
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-500 italic text-center">Click 'Generate Brief' for an AI summary of this client.</p>
                                    )}
                                </div>
                            </div>

                            {/* Loan Info */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                                <h3 className="font-bold text-gray-800 mb-4 flex items-center"><ArrowUpRight size={16} className="mr-2 text-brand-red"/> Loan Scenario</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Property Address</label>
                                        <div className="flex space-x-2">
                                            <input 
                                                value={selectedClient.propertyAddress} 
                                                onChange={(e) => handleUpdateClient({...selectedClient, propertyAddress: e.target.value})}
                                                className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded text-sm outline-none focus:border-brand-gold"
                                                placeholder="Enter full address to enable valuation..."
                                            />
                                            <button 
                                                onClick={handleEstimateValue}
                                                disabled={isEstimatingValue || !selectedClient.propertyAddress}
                                                className="bg-brand-gold text-brand-dark p-2 rounded hover:bg-yellow-500 disabled:opacity-50 transition-colors shadow-sm"
                                                title="Get AI Valuation Estimate"
                                                aria-label="Estimate Property Value"
                                            >
                                                {isEstimatingValue ? <Loader2 size={16} className="animate-spin"/> : <Wand2 size={16}/>}
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Loan Amount</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-gray-400 text-xs">$</span>
                                            <input 
                                                type="number" 
                                                value={selectedClient.loanAmount} 
                                                onChange={(e) => handleUpdateClient({...selectedClient, loanAmount: parseFloat(e.target.value) || 0})}
                                                className="w-full pl-6 p-2 bg-gray-50 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-brand-red outline-none"
                                            />
                                        </div>
                                        {/* LTV Display */}
                                        {selectedClient.estimatedPropertyValue && ltv !== null && (
                                            <div className="mt-2 flex items-center justify-between text-xs bg-gray-50 p-2 rounded border border-gray-100">
                                                <div className="text-gray-500">
                                                    Est. Value: <span className="font-semibold text-gray-700">${selectedClient.estimatedPropertyValue.toLocaleString()}</span>
                                                </div>
                                                <div className={`font-bold px-2 py-0.5 rounded ${
                                                    ltv > 90 ? 'bg-red-100 text-red-700' :
                                                    ltv > 80 ? 'bg-yellow-100 text-yellow-700' :
                                                    'bg-green-100 text-green-700'
                                                }`}>
                                                    LTV: {ltv.toFixed(1)}%
                                                </div>
                                            </div>
                                        )}
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
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Notes</label>
                                        <textarea 
                                            value={selectedClient.notes} 
                                            onChange={(e) => handleUpdateClient({...selectedClient, notes: e.target.value})}
                                            className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-sm min-h-[80px]"
                                            placeholder="Add notes..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Checklist */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                                <h3 className="font-bold text-gray-800 mb-4 flex items-center"><CheckSquare size={16} className="mr-2 text-brand-gold"/> Task Checklist</h3>
                                
                                {/* Checklist Search */}
                                <div className="relative mb-3">
                                    <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
                                    <input 
                                        type="text" 
                                        placeholder="Filter tasks..." 
                                        value={checklistSearchQuery}
                                        onChange={(e) => setChecklistSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-brand-gold outline-none transition-all"
                                    />
                                </div>

                                <div className="space-y-2 mb-4">
                                    {selectedClient.checklist
                                        .filter(item => item.label.toLowerCase().includes(checklistSearchQuery.toLowerCase()))
                                        .map(item => (
                                        <div key={item.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded group relative">
                                            <button 
                                                onClick={() => handleToggleTask(item.id, item.checked)} 
                                                className={`p-1 rounded transition-colors ${item.checked ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                            >
                                                {item.checked ? <Check size={14}/> : <div className="w-3.5 h-3.5"/>}
                                            </button>
                                            <span className={`flex-1 text-sm ${item.checked ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                                                {item.label}
                                            </span>
                                            {item.reminderDate && (
                                                <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                                                    {item.reminderDate}
                                                </span>
                                            )}
                                            <button 
                                                onClick={() => handleDeleteTask(item.id)}
                                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                                            >
                                                <X size={14}/>
                                            </button>
                                        </div>
                                    ))}
                                    {selectedClient.checklist.length === 0 && (
                                        <p className="text-xs text-gray-400 italic text-center py-2">No tasks yet.</p>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <input 
                                        value={newTaskLabel}
                                        onChange={(e) => setNewTaskLabel(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                                        className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded text-sm outline-none focus:border-brand-gold"
                                        placeholder="Add new task..."
                                    />
                                    <input 
                                        type="date"
                                        value={newTaskDate}
                                        onChange={(e) => setNewTaskDate(e.target.value)}
                                        className="w-32 p-2 bg-gray-50 border border-gray-200 rounded text-sm outline-none focus:border-brand-gold"
                                    />
                                    <button 
                                        onClick={handleAddTask}
                                        disabled={!newTaskLabel.trim()}
                                        className="p-2 bg-brand-dark text-white rounded hover:bg-gray-800 disabled:opacity-50"
                                    >
                                        <Plus size={16}/>
                                    </button>
                                </div>
                                <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2 overflow-x-auto scrollbar-hide">
                                    <button onClick={() => addQuickTask("Send Rate Update", 0)} className="whitespace-nowrap px-3 py-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full text-[10px] text-gray-600">Rate Update</button>
                                    <button onClick={() => addQuickTask("Collect Documents", 1)} className="whitespace-nowrap px-3 py-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full text-[10px] text-gray-600">Docs Follow-up</button>
                                    <button onClick={() => addQuickTask("Lock Rate", 0)} className="whitespace-nowrap px-3 py-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full text-[10px] text-gray-600">Lock Rate</button>
                                </div>
                            </div>

                            {/* Email History */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                                <h3 className="font-bold text-gray-800 mb-4 flex items-center"><History size={16} className="mr-2 text-blue-500"/> Communication Log</h3>
                                <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2">
                                    {selectedClient.emailHistory && selectedClient.emailHistory.length > 0 ? (
                                        selectedClient.emailHistory.map(log => (
                                            <div key={log.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm group relative">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="font-bold text-gray-700 truncate max-w-[70%]">{log.subject}</span>
                                                    <span className="text-[10px] text-gray-400 whitespace-nowrap">{new Date(log.date).toLocaleDateString()}</span>
                                                </div>
                                                <p className="text-xs text-gray-600 line-clamp-2">{log.body}</p>
                                                 <button 
                                                    onClick={(e) => handleDeleteEmailLog(log.id, e)}
                                                    className="absolute top-2 right-2 p-1 bg-white border border-gray-200 rounded-full text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                                    title="Delete Log"
                                                >
                                                    <Trash2 size={10}/>
                                                </button>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-xs text-gray-400 italic text-center">No recorded history.</p>
                                    )}
                                </div>
                            </div>

                            {/* Email Drafter */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                                <h3 className="font-bold text-gray-800 mb-4 flex items-center"><Mail size={16} className="mr-2 text-brand-red"/> AI Concierge Draft</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Topic / Goal</label>
                                        <div className="flex gap-2">
                                            <input 
                                                value={emailDraftTopic} 
                                                onChange={(e) => setEmailDraftTopic(e.target.value)}
                                                className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded text-sm outline-none focus:border-brand-red"
                                                placeholder="e.g. Rate Lock Alert"
                                            />
                                            <button 
                                                onClick={handleGenerateEmail}
                                                disabled={isDrafting || !emailDraftTopic}
                                                className="bg-brand-dark text-white px-4 py-2 rounded text-sm hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center"
                                            >
                                                {isDrafting ? <Loader2 size={16} className="animate-spin"/> : <Zap size={16}/>}
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {currentDraft && (
                                        <div className="animate-fade-in space-y-3">
                                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                                <div className="flex justify-between items-center mb-2">
                                                    <div className="flex gap-2">
                                                        {isGeneratingSubjects ? (
                                                            <Loader2 size={14} className="animate-spin text-gray-400"/>
                                                        ) : (
                                                            <button onClick={handleGenerateSubjects} className="text-[10px] text-blue-600 hover:underline">Suggest Subjects</button>
                                                        )}
                                                    </div>
                                                    <button onClick={() => {navigator.clipboard.writeText(currentDraft); showToast('Copied draft', 'info')}} className="text-gray-400 hover:text-brand-dark"><Copy size={14}/></button>
                                                </div>
                                                
                                                {suggestedSubjects.length > 0 && (
                                                    <div className="mb-3 space-y-1">
                                                        {suggestedSubjects.map((sub, idx) => (
                                                            <div key={idx} onClick={() => {navigator.clipboard.writeText(sub); showToast('Subject copied', 'info')}} className="text-xs p-1.5 bg-white border border-gray-200 rounded cursor-pointer hover:border-brand-gold text-gray-700 truncate">
                                                                {sub}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <textarea 
                                                    value={currentDraft}
                                                    onChange={(e) => setCurrentDraft(e.target.value)}
                                                    className="w-full bg-transparent border-none outline-none text-sm text-gray-700 h-32 resize-none leading-relaxed"
                                                />
                                            </div>
                                            <button 
                                                onClick={handleLogEmail}
                                                className="w-full py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-xs font-bold border border-green-200 transition-colors flex items-center justify-center"
                                            >
                                                <Save size={14} className="mr-2"/> Log to History
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="hidden md:flex flex-col items-center justify-center h-full text-gray-400 bg-gray-50/50">
                        <div className="bg-gray-100 p-6 rounded-full mb-4">
                            <Users size={48} className="text-gray-300"/>
                        </div>
                        <p className="text-lg font-medium text-gray-500">Select a client to view details</p>
                        <p className="text-sm mt-2 max-w-xs text-center">Use voice commands or the list on the left to navigate your pipeline.</p>
                    </div>
                )}
            </div>

            {/* Manage Stages Modal */}
            {isManageStagesOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={() => setIsManageStagesOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg text-brand-dark">Manage Deal Stages</h3>
                            <button onClick={() => setIsManageStagesOpen(false)} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} className="text-gray-500"/></button>
                        </div>
                        
                        <div className="space-y-2 mb-6 max-h-[300px] overflow-y-auto">
                            {dealStages.map(stage => (
                                <div key={stage.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 group">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-4 h-4 rounded-full border border-gray-200" style={{backgroundColor: stage.color}}></div>
                                        <span className="font-medium text-sm text-gray-700">{stage.name}</span>
                                    </div>
                                    <button 
                                        onClick={() => removeStage(stage.name)} 
                                        className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        disabled={dealStages.length <= 1}
                                    >
                                        <Trash2 size={16}/>
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Add New Stage</label>
                            <div className="flex gap-2 mb-3">
                                <input 
                                    value={newStageName}
                                    onChange={(e) => setNewStageName(e.target.value)}
                                    placeholder="Stage Name"
                                    className="flex-1 p-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-gold"
                                />
                                <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1">
                                    {COLOR_PALETTE.slice(0, 5).map(color => (
                                        <button 
                                            key={color}
                                            onClick={() => setNewStageColor(color)}
                                            className={`w-6 h-full rounded transition-transform ${newStageColor === color ? 'scale-110 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                                            style={{backgroundColor: color}}
                                        />
                                    ))}
                                </div>
                            </div>
                            <button 
                                onClick={addStage}
                                disabled={!newStageName.trim()}
                                className="w-full bg-brand-dark text-white py-2 rounded-lg text-sm font-bold hover:bg-gray-800 disabled:opacity-50 transition-colors"
                            >
                                Add Stage
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Status Modal */}
            {showBulkStatusModal && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={() => setShowBulkStatusModal(false)}>
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                        <h3 className="font-bold text-lg mb-4">Bulk Update Status</h3>
                        <p className="text-sm text-gray-500 mb-4">Move {selectedIds.size} clients to:</p>
                        <select 
                            value={bulkTargetStatus}
                            onChange={(e) => setBulkTargetStatus(e.target.value)}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none mb-6"
                        >
                            <option value="">Select Stage...</option>
                            {dealStages.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                        </select>
                        <div className="flex gap-3">
                            <button onClick={() => setShowBulkStatusModal(false)} className="flex-1 py-2 text-gray-600 hover:bg-gray-50 rounded-lg">Cancel</button>
                            <button onClick={executeBulkStatusUpdate} className="flex-1 py-2 bg-brand-dark text-white rounded-lg hover:bg-gray-800 font-bold">Update</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Task Modal */}
            {showBulkTaskModal && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={() => setShowBulkTaskModal(false)}>
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                        <h3 className="font-bold text-lg mb-4">Bulk Add Task</h3>
                        <p className="text-sm text-gray-500 mb-4">Add checklist item to {selectedIds.size} clients:</p>
                        <input 
                            value={bulkTaskLabel}
                            onChange={(e) => setBulkTaskLabel(e.target.value)}
                            placeholder="Task description..."
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none mb-3"
                        />
                        <input 
                            type="date"
                            value={bulkTaskDate}
                            onChange={(e) => setBulkTaskDate(e.target.value)}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none mb-6"
                        />
                        <div className="flex gap-3">
                            <button onClick={() => setShowBulkTaskModal(false)} className="flex-1 py-2 text-gray-600 hover:bg-gray-50 rounded-lg">Cancel</button>
                            <button onClick={executeBulkAddTask} className="flex-1 py-2 bg-brand-dark text-white rounded-lg hover:bg-gray-800 font-bold">Add Task</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};