import React, { useState, useRef, useEffect, memo } from 'react';
import Users from 'lucide-react/icons/users';
import ArrowUpRight from 'lucide-react/icons/arrow-up-right';
import Edit2 from 'lucide-react/icons/edit-2';
import Trash2 from 'lucide-react/icons/trash-2';
import Sparkles from 'lucide-react/icons/sparkles';
import Loader2 from 'lucide-react/icons/loader-2';
import Copy from 'lucide-react/icons/copy';
import Square from 'lucide-react/icons/square';
import Mic from 'lucide-react/icons/mic';
import Check from 'lucide-react/icons/check';
import ChevronLeft from 'lucide-react/icons/chevron-left';
import DollarSign from 'lucide-react/icons/dollar-sign';
import Save from 'lucide-react/icons/save';
import Zap from 'lucide-react/icons/zap';
import Wand2 from 'lucide-react/icons/wand-2';
import Mail from 'lucide-react/icons/mail';
import Phone from 'lucide-react/icons/phone';
import UserPlus from 'lucide-react/icons/user-plus';
import Scale from 'lucide-react/icons/scale';
import CheckSquare from 'lucide-react/icons/check-square';
import History from 'lucide-react/icons/history';
import Gift from 'lucide-react/icons/gift';
import PenTool from 'lucide-react/icons/pen-tool';
import Camera from 'lucide-react/icons/camera';
import X from 'lucide-react/icons/x';
import Bell from 'lucide-react/icons/bell';
import CalendarIcon from 'lucide-react/icons/calendar';
import Percent from 'lucide-react/icons/percent';
import RefreshCcw from 'lucide-react/icons/refresh-ccw';
import Users from 'lucide-react/dist/esm/icons/users';
import ArrowUpRight from 'lucide-react/dist/esm/icons/arrow-up-right';
import Edit2 from 'lucide-react/dist/esm/icons/edit-2';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import Copy from 'lucide-react/dist/esm/icons/copy';
import Square from 'lucide-react/dist/esm/icons/square';
import Mic from 'lucide-react/dist/esm/icons/mic';
import Check from 'lucide-react/dist/esm/icons/check';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left';
import DollarSign from 'lucide-react/dist/esm/icons/dollar-sign';
import Save from 'lucide-react/dist/esm/icons/save';
import Zap from 'lucide-react/dist/esm/icons/zap';
import Wand2 from 'lucide-react/dist/esm/icons/wand-2';
import Mail from 'lucide-react/dist/esm/icons/mail';
import Phone from 'lucide-react/dist/esm/icons/phone';
import UserPlus from 'lucide-react/dist/esm/icons/user-plus';
import Scale from 'lucide-react/dist/esm/icons/scale';
import CheckSquare from 'lucide-react/dist/esm/icons/check-square';
import History from 'lucide-react/dist/esm/icons/history';
import Gift from 'lucide-react/dist/esm/icons/gift';
import PenTool from 'lucide-react/dist/esm/icons/pen-tool';
import Camera from 'lucide-react/dist/esm/icons/camera';
import X from 'lucide-react/dist/esm/icons/x';
import Bell from 'lucide-react/dist/esm/icons/bell';
import CalendarIcon from 'lucide-react/dist/esm/icons/calendar';
import Percent from 'lucide-react/dist/esm/icons/percent';
import RefreshCcw from 'lucide-react/dist/esm/icons/refresh-ccw';
import { Client, DealStage, ChecklistItem, EmailLog, DealStrategy, GiftSuggestion, CalendarEvent } from '../types';
import { useToast } from './Toast';
import { MarkdownRenderer } from './MarkdownRenderer';
import { loadFromStorage, saveToStorage, StorageKeys } from '../services/storageService';
import { Skeleton } from './Skeleton';

const loadClientWorkspaceService = () => import('../services/gemini/clientWorkspaceService');
const loadAssistantService = () => import('../services/gemini/assistantService');

interface ClientDetailViewProps {
    client: Client;
    dealStages: DealStage[];
    onUpdate: (client: Client) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
}

// Helper for buffered inputs to prevent re-renders on every keystroke
// MOBILE OPTIMIZATION: Uses text-base on mobile to prevent iOS zoom on focus, text-sm on desktop
const BufferedInput = ({ 
    value, 
    onCommit, 
    className, 
    placeholder, 
    type = "text" 
}: { 
    value: string | number, 
    onCommit: (val: any) => void, 
    className: string, 
    placeholder?: string,
    type?: string
}) => {
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const handleBlur = () => {
        if (localValue !== value) {
            onCommit(type === 'number' ? (parseFloat(localValue as string) || 0) : localValue);
        }
    };

    return (
        <input
            type={type}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleBlur}
            className={`${className} text-base md:text-sm`} 
            placeholder={placeholder}
        />
    );
};

const BufferedTextArea = ({ 
    value, 
    onCommit, 
    className, 
    placeholder 
}: { 
    value: string, 
    onCommit: (val: string) => void, 
    className: string, 
    placeholder?: string 
}) => {
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const handleBlur = () => {
        if (localValue !== value) {
            onCommit(localValue);
        }
    };

    return (
        <textarea
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleBlur}
            className={`${className} text-base md:text-sm`}
            placeholder={placeholder}
        />
    );
};

export const ClientDetailView: React.FC<ClientDetailViewProps> = memo(({ 
    client, dealStages, onUpdate, onDelete, onClose 
}) => {
    const { showToast } = useToast();
    
    // UI State
    const [isEditing, setIsEditing] = useState(false);

    // Feature State: Document Scanning
    const [isScanningDoc, setIsScanningDoc] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Feature State: AI Summary
    const [clientSummary, setClientSummary] = useState(client.lastSummary || '');
    const [isSummarizing, setIsSummarizing] = useState(false);

    // Feature State: Architect
    const [dealStrategies, setDealStrategies] = useState<DealStrategy[]>([]);
    const [isArchitecting, setIsArchitecting] = useState(false);
    const [showArchitect, setShowArchitect] = useState(false);

    // Feature State: Concierge
    const [showConcierge, setShowConcierge] = useState(false);
    const [giftSuggestions, setGiftSuggestions] = useState<GiftSuggestion[]>([]);
    const [isGeneratingGifts, setIsGeneratingGifts] = useState(false);

    // Feature State: Email
    const [emailDraftTopic, setEmailDraftTopic] = useState('');
    const [isDrafting, setIsDrafting] = useState(false);
    const [currentDraft, setCurrentDraft] = useState('');
    const [suggestedSubjects, setSuggestedSubjects] = useState<string[]>([]);
    const [isGeneratingSubjects, setIsGeneratingSubjects] = useState(false);
    const [isNotifyingPartner, setIsNotifyingPartner] = useState(false);

    // Feature State: Tasks
    const [newTaskLabel, setNewTaskLabel] = useState('');
    const [isGeneratingChecklist, setIsGeneratingChecklist] = useState(false);

    // Feature State: Valuation
    const [isEstimatingValue, setIsEstimatingValue] = useState(false);

    // Feature State: Notes
    const [isOrganizingNotes, setIsOrganizingNotes] = useState(false);

    // Feature State: Voice
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessingVoice, setIsProcessingVoice] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const getStageColor = (status: string) => {
        return dealStages.find(s => s.name === status)?.color || '#64748B';
    };

    const calculateLTV = () => {
        if (!client.loanAmount || !client.estimatedPropertyValue) return null;
        return (client.loanAmount / client.estimatedPropertyValue) * 100;
    };
    const ltv = calculateLTV();

    // --- Handlers ---

    const handleDocScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsScanningDoc(true);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = async () => {
            try {
                const base64Image = (reader.result as string).split(',')[1];
                const { extractClientDataFromImage } = await loadClientWorkspaceService();
                const extractedData = await extractClientDataFromImage(base64Image);
                
                onUpdate({
                    ...client,
                    name: extractedData.name || client.name,
                    email: extractedData.email || client.email,
                    phone: extractedData.phone || client.phone,
                    loanAmount: extractedData.loanAmount || client.loanAmount,
                    propertyAddress: extractedData.propertyAddress || client.propertyAddress,
                    currentRate: extractedData.currentRate || client.currentRate
                });
                showToast("✨ Client data updated from document", "success");
            } catch (error) {
                console.error(error);
                showToast("Failed to scan document", "error");
            } finally {
                setIsScanningDoc(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
    };

    const handleGenerateSummary = async () => {
        setIsSummarizing(true);
        try {
            const { generateClientSummary } = await loadClientWorkspaceService();
            const summary = await generateClientSummary(client);
            setClientSummary(summary || "No summary available.");
            onUpdate({ ...client, lastSummary: summary });
        } catch (error) {
            showToast("Failed to generate summary", 'error');
        } finally {
            setIsSummarizing(false);
        }
    };

    const handleRunArchitect = async () => {
        setIsArchitecting(true);
        setShowArchitect(true);
        try {
            const { generateDealArchitecture } = await loadClientWorkspaceService();
            const strategies = await generateDealArchitecture(client);
            setDealStrategies(strategies);
        } catch (e) {
            console.error(e);
            showToast("Deal Structuring Failed", "error");
        } finally {
            setIsArchitecting(false);
        }
    };

    const handleGenerateGifts = async () => {
        setIsGeneratingGifts(true);
        try {
            const { generateGiftSuggestions } = await loadClientWorkspaceService();
            const gifts = await generateGiftSuggestions(client);
            setGiftSuggestions(gifts);
        } catch (e) {
            console.error(e);
            showToast("Failed to generate gift ideas", "error");
        } finally {
            setIsGeneratingGifts(false);
        }
    };

    const handleEstimateValue = async () => {
        if (!client.propertyAddress) {
            showToast('Please enter a property address first.', 'error');
            return;
        }
        setIsEstimatingValue(true);
        try {
            const { estimatePropertyDetails } = await loadClientWorkspaceService();
            const result = await estimatePropertyDetails(client.propertyAddress);
            if (result.estimatedValue > 0) {
                onUpdate({
                    ...client,
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

    const handleSmartChecklist = async () => {
        setIsGeneratingChecklist(true);
        try {
            const { generateSmartChecklist } = await loadClientWorkspaceService();
            const suggestions = await generateSmartChecklist(client);
            if (suggestions.length > 0) {
                const newItems: ChecklistItem[] = suggestions.map(label => ({
                    id: Date.now() + Math.random().toString(),
                    label,
                    checked: false
                }));
                onUpdate({
                    ...client,
                    checklist: [...client.checklist, ...newItems]
                });
                showToast(`Added ${suggestions.length} smart tasks`, 'success');
            } else {
                showToast('No new tasks suggested', 'info');
            }
        } catch (e) {
            console.error(e);
            showToast('Failed to generate checklist', 'error');
        } finally {
            setIsGeneratingChecklist(false);
        }
    };

    const handleAddTask = () => {
        if (!newTaskLabel.trim()) return;
        const newItem: ChecklistItem = { 
            id: Date.now().toString(), 
            label: newTaskLabel, 
            checked: false
        };
        onUpdate({ ...client, checklist: [...client.checklist, newItem] });
        setNewTaskLabel('');
    };

    const handleToggleTask = (itemId: string, current: boolean) => {
        const updatedChecklist = client.checklist.map(item => 
            item.id === itemId ? { ...item, checked: !current } : item
        );
        onUpdate({ ...client, checklist: updatedChecklist });
    };

    const handleDeleteTask = (itemId: string) => {
        const updatedChecklist = client.checklist.filter(item => item.id !== itemId);
        onUpdate({ ...client, checklist: updatedChecklist });
    };

    const addQuickTask = (label: string, daysOffset: number) => {
        const date = new Date();
        if (daysOffset > 0) date.setDate(date.getDate() + daysOffset);
        const reminderDate = daysOffset > 0 ? date.toISOString().split('T')[0] : undefined;
        
        const newItem: ChecklistItem = {
            id: Date.now().toString() + Math.random().toString().slice(2),
            label: label,
            checked: false,
            reminderDate: reminderDate
        };
        onUpdate({ ...client, checklist: [...client.checklist, newItem] });
        showToast('Quick task added', 'success');
    };

    const handleSetReminder = () => {
        if (!client.nextActionDate) {
            showToast('Please select a date first', 'error');
            return;
        }

        // 1. Add to Checklist
        const newItem: ChecklistItem = {
            id: Date.now().toString(),
            label: `Follow up: ${client.name}`,
            checked: false,
            reminderDate: client.nextActionDate
        };
        const updatedChecklist = [newItem, ...client.checklist];

        // 2. Add to Calendar (Sync)
        try {
            const events = loadFromStorage<CalendarEvent[]>(StorageKeys.CALENDAR_EVENTS, []);
            const newEvent: CalendarEvent = {
                id: `reminder-${Date.now()}`,
                title: `Follow up: ${client.name}`,
                start: `${client.nextActionDate}T09:00:00`, // Default to 9am
                end: `${client.nextActionDate}T09:30:00`,
                type: 'TASK',
                clientId: client.id,
                notes: `Automated reminder from Client Detail. Status: ${client.status}`
            };
            saveToStorage(StorageKeys.CALENDAR_EVENTS, [...events, newEvent]);
            showToast('Reminder added to Calendar & Tasks', 'success');
        } catch (e) {
            console.error("Failed to sync to calendar", e);
            showToast('Added to Tasks (Calendar Sync Failed)', 'warning');
        }

        onUpdate({ ...client, checklist: updatedChecklist });
    };

    const handleOrganizeNotes = async () => {
        if (!client.notes || client.notes.trim().length === 0) return;
        setIsOrganizingNotes(true);
        try {
            const { organizeScratchpadNotes } = await loadClientWorkspaceService();
            const organized = await organizeScratchpadNotes(client.notes);
            if (organized) {
                onUpdate({ ...client, notes: organized });
                showToast('Notes organized successfully', 'success');
            }
        } catch (e) {
            showToast('Failed to organize notes', 'error');
        } finally {
            setIsOrganizingNotes(false);
        }
    };

    // Email Handlers
    const handleGenerateEmail = async () => {
        if (!emailDraftTopic) {
            showToast('Please enter a topic.', 'error');
            return;
        }
        setIsDrafting(true);
        try {
            const { generateEmailDraft } = await loadClientWorkspaceService();
            const draft = await generateEmailDraft(client, emailDraftTopic, 'Standard follow up');
            setCurrentDraft(draft || '');
        } catch (error) {
            showToast('Failed to generate email', 'error');
        } finally {
            setIsDrafting(false);
        }
    };

    const handleGeneratePartnerUpdate = async () => {
        if (!client.referralSource) {
            showToast('Please add a referral source first.', 'error');
            return;
        }
        setIsNotifyingPartner(true);
        try {
            const { generatePartnerUpdate } = await loadClientWorkspaceService();
            const draft = await generatePartnerUpdate(client, client.referralSource);
            setCurrentDraft(draft || '');
            setEmailDraftTopic('Partner Status Update');
            showToast('Partner update drafted', 'success');
        } catch (error) {
            showToast('Failed to generate update', 'error');
        } finally {
            setIsNotifyingPartner(false);
        }
    };

    const handleLogEmail = () => {
        if (!currentDraft) return;
        const newLog: EmailLog = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            subject: suggestedSubjects[0] || emailDraftTopic || "Draft Log",
            body: currentDraft
        };
        onUpdate({
            ...client,
            emailHistory: [newLog, ...(client.emailHistory || [])]
        });
        setCurrentDraft('');
        setEmailDraftTopic('');
        setSuggestedSubjects([]);
        showToast('Communication logged to history', 'success');
    };

    const handleGenerateSubjects = async () => {
        if (!emailDraftTopic) return;
        setIsGeneratingSubjects(true);
        try {
            const { generateSubjectLines } = await loadClientWorkspaceService();
            const subjects = await generateSubjectLines(client, emailDraftTopic);
            setSuggestedSubjects(subjects);
        } catch (error) {
            showToast('Failed to generate subjects', 'error');
        } finally {
            setIsGeneratingSubjects(false);
        }
    };

    const handleDeleteEmailLog = (logId: string) => {
        if (confirm('Delete this record?')) {
            onUpdate({
                ...client,
                emailHistory: client.emailHistory.filter(log => log.id !== logId)
            });
            showToast('Record deleted', 'info');
        }
    };

    // Voice Command Handler
    const handleVoiceCommand = async () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
            setIsProcessingVoice(true);
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const mediaRecorder = new MediaRecorder(stream);
                mediaRecorderRef.current = mediaRecorder;
                audioChunksRef.current = [];
                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) audioChunksRef.current.push(event.data);
                };
                mediaRecorder.onstop = async () => {
                    try {
                        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                        const reader = new FileReader();
                        reader.readAsDataURL(audioBlob);
                        reader.onloadend = async () => {
                            const base64Audio = (reader.result as string).split(',')[1];
                            try {
                                showToast('Transcribing...', 'info');
                                const { transcribeAudio } = await loadClientWorkspaceService();
                                const { parseNaturalLanguageCommand } = await loadAssistantService();
                                const transcript = await transcribeAudio(base64Audio);
                                const command = await parseNaturalLanguageCommand(transcript, dealStages.map(s => s.name));
                                
                                const payload = command.payload;
                                const updated = { ...client };
                                let hasUpdates = false;

                                if (payload.name) { updated.name = payload.name; hasUpdates = true; }
                                if (payload.loanAmount) { updated.loanAmount = payload.loanAmount; hasUpdates = true; }
                                if (payload.email) { updated.email = payload.email; hasUpdates = true; }
                                if (payload.phone) { updated.phone = payload.phone; hasUpdates = true; }
                                if (payload.status) { updated.status = payload.status!; hasUpdates = true; }
                                if (payload.date) { updated.nextActionDate = payload.date; hasUpdates = true; }
                                if (payload.rate) { updated.currentRate = payload.rate; hasUpdates = true; }

                                if (command.action === 'ADD_NOTE' || payload.note) {
                                    if (payload.note) {
                                        const newNote = `[Voice]: ${payload.note}`;
                                        updated.notes = updated.notes ? `${updated.notes}\n\n${newNote}` : newNote;
                                        hasUpdates = true;
                                    }
                                }
                                if (command.action === 'ADD_TASK' || payload.taskLabel) {
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
                                    onUpdate(updated);
                                    showToast('Client updated via voice', 'success');
                                } else {
                                    showToast('Command understood but no relevant changes detected', 'info');
                                }

                            } catch (error) {
                                console.error(error);
                                showToast('Failed to process voice command', 'error');
                            } finally {
                                setIsProcessingVoice(false);
                                stream.getTracks().forEach(track => track.stop());
                            }
                        };
                    } catch (e) {
                        setIsProcessingVoice(false);
                    }
                };
                mediaRecorder.start();
                setIsRecording(true);
            } catch (err) {
                showToast('Microphone access denied', 'error');
            }
        }
    };

    return (
        <div className="flex flex-col h-full bg-white md:bg-gray-50">
            {/* Hidden Inputs */}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleDocScan} />

            {/* Header - Sticky for better mobile context */}
            <div className="bg-white/95 backdrop-blur-sm border-b border-gray-200 p-4 safe-top shadow-sm sticky top-0 z-20 transition-all">
                <div className="flex items-center justify-between">
                    <div className="flex flex-1 items-center overflow-hidden">
                        <button onClick={onClose} className="md:hidden mr-2 p-2 text-gray-500 hover:bg-gray-100 rounded-full shrink-0" aria-label="Back">
                            <ChevronLeft size={24}/>
                        </button>
                        <div className="flex-1 min-w-0">
                            {isEditing ? (
                                <div className="flex items-center gap-3">
                                    <BufferedInput 
                                        value={client.name} 
                                        onCommit={(val) => onUpdate({...client, name: val})}
                                        className="font-bold text-xl text-gray-900 border-b border-gray-300 focus:border-brand-red outline-none bg-transparent w-full" 
                                    />
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isScanningDoc}
                                        className="text-xs bg-brand-light text-brand-dark border border-brand-dark/10 px-2 py-1 rounded flex items-center hover:bg-brand-dark/5 transition-colors disabled:opacity-50 whitespace-nowrap"
                                        title="Auto-fill from image"
                                    >
                                        {isScanningDoc ? <Loader2 size={12} className="animate-spin mr-1"/> : <Camera size={12} className="mr-1"/>}
                                        {isScanningDoc ? "Scanning..." : "Scan"}
                                    </button>
                                </div>
                            ) : (
                                <h2 className="font-bold text-lg md:text-xl text-brand-dark truncate">{client.name}</h2>
                            )}
                            <div className="flex flex-wrap items-center mt-2 gap-2 text-xs text-gray-500">
                                <div className="relative group shrink-0">
                                    <select 
                                        value={client.status}
                                        onChange={(e) => onUpdate({...client, status: e.target.value})}
                                        style={{ 
                                            backgroundColor: `${getStageColor(client.status)}20`, 
                                            color: getStageColor(client.status),
                                            borderColor: `${getStageColor(client.status)}40`
                                        }}
                                        className="font-bold border rounded-full px-2 py-0.5 pr-6 outline-none cursor-pointer appearance-none transition-all hover:brightness-95 text-base md:text-xs"
                                    >
                                        {dealStages.map(stage => <option key={stage.name} value={stage.name}>{stage.name}</option>)}
                                        {!dealStages.find(s => s.name === client.status) && (
                                            <option value={client.status}>{client.status}</option>
                                        )}
                                    </select>
                                </div>
                                <span className="font-bold text-gray-700 flex items-center bg-gray-100 px-2 py-0.5 rounded shrink-0">
                                    <DollarSign size={10} className="mr-1"/>
                                    {client.loanAmount.toLocaleString()}
                                </span>
                                <span className="truncate max-w-[150px]">{client.email}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex space-x-1 shrink-0 ml-2">
                        <button 
                            onClick={handleVoiceCommand} 
                            disabled={isProcessingVoice} 
                            className={`p-2 rounded-full transition-all border shadow-sm ${
                                isRecording 
                                ? 'bg-red-500 text-white border-red-500 animate-pulse' 
                                : 'text-gray-400 hover:bg-gray-100 border-transparent'
                            }`} 
                            title="Voice Command"
                        >
                            {isProcessingVoice ? <Loader2 size={18} className="animate-spin" /> : isRecording ? <Square size={18} fill="currentColor" /> : <Mic size={18} />}
                        </button>
                        <button onClick={() => setIsEditing(!isEditing)} className={`p-2 rounded-full ${isEditing ? 'bg-brand-red text-white' : 'text-gray-400 hover:bg-gray-100'}`} aria-label="Edit Client"><Edit2 size={18}/></button>
                        <button onClick={() => onDelete(client.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors" aria-label="Delete Client"><Trash2 size={20}/></button>
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 md:pb-8 safe-bottom">
                
                {/* Situation Report / Activity Summary */}
                <div className="bg-gradient-to-r from-brand-dark to-slate-800 rounded-xl shadow-lg border border-gray-700 p-5 text-white">
                    <div className="flex justify-between items-start mb-3">
                        <h3 className="font-bold flex items-center text-brand-gold">
                            <Sparkles size={16} className="mr-2"/> Status & Activity Summary
                        </h3>
                        <button 
                            onClick={handleGenerateSummary}
                            disabled={isSummarizing}
                            className="text-[10px] bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-all disabled:opacity-50 flex items-center border border-white/10 font-medium"
                        >
                            {isSummarizing ? <Loader2 size={12} className="animate-spin mr-1.5"/> : <RefreshCcw size={12} className="mr-1.5"/>}
                            {clientSummary ? "Update Summary" : "Generate Summary"}
                        </button>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4 min-h-[80px] border border-white/10">
                        {isSummarizing ? (
                             <div className="space-y-3">
                                <Skeleton className="h-3 w-3/4 bg-white/10" />
                                <Skeleton className="h-3 w-full bg-white/10" />
                                <Skeleton className="h-3 w-[90%] bg-white/10" />
                                <Skeleton className="h-3 w-[60%] bg-white/10" />
                            </div>
                        ) : clientSummary ? (
                            <div className="text-sm text-gray-200 leading-relaxed prose prose-invert max-w-none">
                                <MarkdownRenderer content={clientSummary} />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center text-gray-500 py-4">
                                <Sparkles size={24} className="mb-2 opacity-20"/>
                                <p className="text-xs italic text-center">
                                    Click 'Generate Summary' for an AI analysis of client notes, history, and status.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Client Relations (Concierge) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 overflow-hidden">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-800 flex items-center">
                            <Gift size={16} className="mr-2 text-rose-500"/> Client Relations
                        </h3>
                        <button 
                            onClick={() => {
                                setShowConcierge(!showConcierge);
                                if (!showConcierge && giftSuggestions.length === 0) handleGenerateGifts();
                            }}
                            disabled={isGeneratingGifts}
                            className={`text-[10px] px-3 py-1.5 rounded-full flex items-center transition-colors disabled:opacity-50 font-bold ${showConcierge ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-white hover:bg-gray-50 border border-gray-200 text-gray-600'}`}
                        >
                            {isGeneratingGifts ? <Loader2 size={10} className="animate-spin mr-1"/> : <Wand2 size={10} className="mr-1"/>}
                            {showConcierge ? "Close" : "Closing Gifts"}
                        </button>
                    </div>
                    {showConcierge && (
                        <div className="animate-fade-in space-y-4">
                            {isGeneratingGifts ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                     {Array(3).fill(0).map((_, i) => (
                                         <div key={i} className="p-4 rounded-xl border border-gray-100">
                                             <Skeleton className="h-4 w-24 mb-2" />
                                             <Skeleton className="h-3 w-16 mb-2" />
                                             <Skeleton className="h-3 w-full mb-3" />
                                             <Skeleton className="h-6 w-full" />
                                         </div>
                                     ))}
                                 </div>
                            ) : giftSuggestions.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {giftSuggestions.map((gift, idx) => (
                                        <div key={idx} className="p-4 rounded-xl border bg-rose-50/50 border-rose-100 hover:shadow-md transition-shadow">
                                            <h4 className="font-bold text-sm text-gray-900 mb-1">{gift.item}</h4>
                                            <div className="text-[10px] font-medium text-gray-500 mb-2">{gift.priceRange}</div>
                                            <p className="text-xs text-gray-600 italic">"{gift.reason}"</p>
                                            <button onClick={() => window.open(`https://www.amazon.com/s?k=${encodeURIComponent(gift.item)}`, '_blank')} className="mt-3 w-full py-1.5 bg-white border border-rose-200 rounded text-[10px] font-bold text-rose-600 hover:bg-rose-50 transition-colors">Find Item</button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-4 bg-gray-50 rounded text-xs text-gray-500 text-center">No suggestions found.</div>
                            )}
                            <div className="flex justify-end">
                                <button onClick={() => { setEmailDraftTopic("Handwritten Thank You Card"); handleGenerateEmail(); }} className="text-xs text-gray-500 hover:text-brand-dark flex items-center"><PenTool size={12} className="mr-1"/> Draft Thank You Note</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Deal Strategy (Architect) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 overflow-hidden">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-800 flex items-center"><Scale size={16} className="mr-2 text-indigo-600"/> Deal Strategy</h3>
                        <button onClick={handleRunArchitect} disabled={isArchitecting} className="text-[10px] bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-full flex items-center transition-colors disabled:opacity-50 font-bold">
                            {isArchitecting ? <Loader2 size={10} className="animate-spin mr-1"/> : <Zap size={10} className="mr-1"/>}
                            {showArchitect ? "Regenerate" : "Structure Deal"}
                        </button>
                    </div>
                    {showArchitect && (
                        <div className="animate-fade-in space-y-4">
                            {isArchitecting ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                     {Array(3).fill(0).map((_, i) => (
                                         <div key={i} className="p-4 rounded-xl border border-gray-100">
                                             <Skeleton className="h-3 w-12 mb-2" />
                                             <Skeleton className="h-4 w-32 mb-2" />
                                             <Skeleton className="h-6 w-24 mb-2" />
                                             <Skeleton className="h-3 w-full" />
                                         </div>
                                     ))}
                                 </div>
                            ) : dealStrategies.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {dealStrategies.map((strategy, idx) => (
                                        <div key={idx} className={`p-4 rounded-xl border ${strategy.type === 'SAFE' ? 'bg-green-50 border-green-200' : strategy.type === 'AGGRESSIVE' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'} hover:shadow-md transition-shadow`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide bg-white/50">{strategy.type}</span>
                                            </div>
                                            <h4 className="font-bold text-sm text-gray-900 mb-1">{strategy.title}</h4>
                                            <div className="text-lg font-bold text-gray-800 mb-2">{strategy.monthlyPayment}<span className="text-[10px] font-normal text-gray-500">/mo</span></div>
                                            <p className="text-[10px] text-gray-600 mb-3 italic">"{strategy.description}"</p>
                                            <div className="space-y-1">
                                                {strategy.pros.slice(0,2).map((pro, pIdx) => <div key={pIdx} className="flex items-center text-[10px] text-green-700"><Check size={8} className="mr-1"/> {pro}</div>)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : <div className="p-4 bg-gray-50 rounded text-xs text-gray-500 text-center">No data found. Sync DTI first.</div>}
                        </div>
                    )}
                </div>

                {/* Contact & Loan Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Contact Info */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center"><Users size={16} className="mr-2 text-blue-600"/> Contact Info</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                                <div className="relative"><Mail className="absolute left-3 top-2.5 text-gray-400" size={14} />
                                    <BufferedInput value={client.email} onCommit={(val) => onUpdate({...client, email: val})} className="w-full pl-9 p-2 bg-gray-50 border border-gray-200 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500" placeholder="Email"/>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone</label>
                                <div className="relative"><Phone className="absolute left-3 top-2.5 text-gray-400" size={14} />
                                    <BufferedInput value={client.phone} onCommit={(val) => onUpdate({...client, phone: val})} className="w-full pl-9 p-2 bg-gray-50 border border-gray-200 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500" placeholder="Phone"/>
                                </div>
                            </div>
                            {isEditing && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Referral</label>
                                    <BufferedInput value={client.referralSource || ''} onCommit={(val) => onUpdate({...client, referralSource: val})} placeholder="Referral Source" className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"/>
                                </div>
                            )}
                            {!isEditing && client.referralSource && (
                                <div className="flex items-center text-xs text-gray-500"><span className="font-bold uppercase mr-2">Referred By:</span><span className="bg-blue-50 text-blue-700 px-2 py-1 rounded font-medium border border-blue-100 flex items-center"><UserPlus size={10} className="mr-1"/>{client.referralSource}</span></div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Next Follow-up</label>
                                <div className="flex space-x-2">
                                    <input 
                                        type="date" 
                                        value={client.nextActionDate} 
                                        onChange={(e) => onUpdate({...client, nextActionDate: e.target.value})}
                                        className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700 outline-none focus:ring-1 focus:ring-blue-500 text-base md:text-sm"
                                    />
                                    <button 
                                        onClick={handleSetReminder}
                                        className="px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 rounded transition-colors flex items-center"
                                        title="Add Reminder Task & Calendar Event"
                                    >
                                        <Bell size={16} className="mr-1"/> <span className="text-xs font-bold">Set Reminder</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Loan Info */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center"><ArrowUpRight size={16} className="mr-2 text-brand-red"/> Loan Details</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Address</label>
                                <div className="flex space-x-2">
                                    <BufferedInput value={client.propertyAddress} onCommit={(val) => onUpdate({...client, propertyAddress: val})} className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded text-sm outline-none focus:border-brand-gold" placeholder="Address..."/>
                                    <button onClick={handleEstimateValue} disabled={isEstimatingValue || !client.propertyAddress} className="bg-brand-gold text-brand-dark p-2 rounded hover:bg-yellow-500 disabled:opacity-50 transition-colors shadow-sm"><Wand2 size={16}/></button>
                                </div>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Loan Amount</label>
                                    <div className="relative"><span className="absolute left-3 top-2.5 text-gray-400 text-xs">$</span>
                                        <BufferedInput type="number" value={client.loanAmount} onCommit={(val) => onUpdate({...client, loanAmount: val})} className="w-full pl-6 p-2 bg-gray-50 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-brand-red outline-none"/>
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Current Rate</label>
                                    <div className="relative"><Percent className="absolute right-3 top-2.5 text-gray-400" size={14}/>
                                        <BufferedInput type="number" value={client.currentRate || ''} onCommit={(val) => onUpdate({...client, currentRate: val})} className="w-full pl-2 pr-8 p-2 bg-gray-50 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-brand-red outline-none" placeholder="0.000"/>
                                    </div>
                                </div>
                            </div>
                            
                            {client.estimatedPropertyValue && ltv !== null && <div className="mt-1 text-[10px] text-gray-500 text-right">LTV: <span className={ltv > 80 ? 'text-red-500 font-bold' : 'text-green-600 font-bold'}>{ltv.toFixed(1)}%</span></div>}
                            
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-xs font-bold text-gray-500 uppercase">Notes</label>
                                    <button 
                                        onClick={handleOrganizeNotes}
                                        disabled={isOrganizingNotes || !client.notes}
                                        className="text-[10px] text-purple-600 hover:text-purple-800 flex items-center disabled:opacity-50"
                                        title="Format with AI"
                                    >
                                        {isOrganizingNotes ? <Loader2 size={10} className="animate-spin mr-1"/> : <Wand2 size={10} className="mr-1"/>} Organize
                                    </button>
                                </div>
                                <BufferedTextArea value={client.notes} onCommit={(val) => onUpdate({...client, notes: val})} className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-sm min-h-[80px]" placeholder="Add notes..."/>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Checklist */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-800 flex items-center"><CheckSquare size={16} className="mr-2 text-brand-gold"/> Task Checklist</h3>
                        <button onClick={handleSmartChecklist} disabled={isGeneratingChecklist} className="text-[10px] bg-purple-50 text-purple-700 hover:bg-purple-100 px-2 py-1 rounded border border-purple-200 flex items-center transition-colors disabled:opacity-50">
                            {isGeneratingChecklist ? <Loader2 size={12} className="animate-spin mr-1"/> : <Sparkles size={12} className="mr-1"/>} AI Suggest
                        </button>
                    </div>
                    <div className="space-y-2 mb-4">
                        {client.checklist.map(item => (
                            <div key={item.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded group relative">
                                <button onClick={() => handleToggleTask(item.id, item.checked)} className={`p-1 rounded transition-colors ${item.checked ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                                    {item.checked ? <Check size={14}/> : <div className="w-3.5 h-3.5"/>}
                                </button>
                                <span className={`flex-1 text-sm ${item.checked ? 'line-through text-gray-400' : 'text-gray-700'}`}>{item.label}</span>
                                {item.reminderDate && <span className="text-[10px] bg-yellow-50 text-yellow-700 border border-yellow-200 px-1.5 py-0.5 rounded flex items-center"><CalendarIcon size={10} className="mr-1"/>{new Date(item.reminderDate).toLocaleDateString(undefined, {month:'numeric', day:'numeric'})}</span>}
                                <button onClick={() => handleDeleteTask(item.id)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"><X size={14}/></button>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input value={newTaskLabel} onChange={(e) => setNewTaskLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddTask()} className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded text-base md:text-sm outline-none focus:border-brand-gold" placeholder="Add new task..."/>
                        <button onClick={handleAddTask} disabled={!newTaskLabel.trim()} className="p-2 bg-brand-dark text-white rounded hover:bg-gray-800 disabled:opacity-50"><Square size={16} fill="white"/></button>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2 overflow-x-auto scrollbar-hide">
                        <button onClick={() => addQuickTask("Send Rate Update", 0)} className="whitespace-nowrap px-3 py-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full text-[10px] text-gray-600">Rate Update</button>
                        <button onClick={() => addQuickTask("Collect Documents", 1)} className="whitespace-nowrap px-3 py-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full text-[10px] text-gray-600">Docs Follow-up</button>
                    </div>
                </div>

                {/* Email Studio */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="font-bold text-gray-800 flex items-center"><Mail size={16} className="mr-2 text-brand-red"/> Communication Studio</h3>
                        {client.referralSource && (
                            <button onClick={handleGeneratePartnerUpdate} disabled={isNotifyingPartner} className="text-[10px] bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded flex items-center transition-colors disabled:opacity-50">
                                {isNotifyingPartner ? <Loader2 size={10} className="animate-spin mr-1"/> : <UserPlus size={10} className="mr-1"/>} Notify Partner
                            </button>
                        )}
                    </div>
                    <div className="space-y-3">
                        <div className="flex gap-2">
                            <input value={emailDraftTopic} onChange={(e) => setEmailDraftTopic(e.target.value)} className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded text-base md:text-sm outline-none focus:border-brand-red" placeholder="e.g. Rate Lock Alert"/>
                            <button onClick={handleGenerateEmail} disabled={isDrafting || !emailDraftTopic} className="bg-brand-dark text-white px-4 py-2 rounded text-sm hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center">
                                {isDrafting ? <Loader2 size={16} className="animate-spin"/> : <Zap size={16}/>}
                            </button>
                        </div>
                        {currentDraft && (
                            <div className="animate-fade-in space-y-3">
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex gap-2">
                                            {isGeneratingSubjects ? <Loader2 size={14} className="animate-spin text-gray-400"/> : <button onClick={handleGenerateSubjects} className="text-[10px] text-blue-600 hover:underline">Suggest Subjects</button>}
                                        </div>
                                        <button onClick={() => {navigator.clipboard.writeText(currentDraft); showToast('Copied', 'info')}} className="text-gray-400 hover:text-brand-dark"><Copy size={14}/></button>
                                    </div>
                                    {suggestedSubjects.length > 0 && <div className="mb-3 space-y-1">{suggestedSubjects.map((sub, idx) => <div key={idx} onClick={() => {navigator.clipboard.writeText(sub); showToast('Copied', 'info')}} className="text-xs p-1.5 bg-white border border-gray-200 rounded cursor-pointer hover:border-brand-gold text-gray-700 truncate">{sub}</div>)}</div>}
                                    <textarea value={currentDraft} onChange={(e) => setCurrentDraft(e.target.value)} className="w-full bg-transparent border-none outline-none text-base md:text-sm text-gray-700 h-32 resize-none leading-relaxed"/>
                                </div>
                                <button onClick={handleLogEmail} className="w-full py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-xs font-bold border border-green-200 transition-colors flex items-center justify-center"><Save size={14} className="mr-2"/> Log to History</button>
                            </div>
                        )}
                    </div>
                    {/* History Log */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center"><History size={12} className="mr-1"/> Recent Log</h4>
                        <div className="space-y-2 max-h-[150px] overflow-y-auto">
                            {client.emailHistory?.map(log => (
                                <div key={log.id} className="p-2 bg-gray-50 rounded border border-gray-100 text-xs relative group">
                                    <div className="flex justify-between"><span className="font-bold text-gray-700 truncate max-w-[80%]">{log.subject}</span><span className="text-gray-400">{new Date(log.date).toLocaleDateString()}</span></div>
                                    <button onClick={() => handleDeleteEmailLog(log.id)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"><X size={12}/></button>
                                </div>
                            ))}
                            {!client.emailHistory?.length && <p className="text-xs text-gray-400 italic">No history.</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});