import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Client, ChecklistItem, EmailTemplate, CommandIntent } from '../types';
import { Mail, Search, Plus, X, ChevronRight, CheckSquare, Square, Calendar, MapPin, Sparkles, Loader2, ArrowLeft, Phone, MessageSquare, AlertCircle, FileText, Save, Trash2, Filter, UserPlus, RefreshCw, Clock, History, Mic, Bell, AlarmClock, Volume2, StopCircle } from 'lucide-react';
import { generateEmailDraft, parseNaturalLanguageCommand, transcribeAudio, generateSpeech } from '../services/geminiService';
import { loadFromStorage, saveToStorage, StorageKeys } from '../services/storageService';
import { useToast } from '../App';

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: '1', label: 'W2s / 1099s (2 Years)', checked: false },
  { id: '2', label: 'Personal Tax Returns (2 Years)', checked: false },
  { id: '3', label: 'Asset Statements (2 Months)', checked: false },
  { id: '4', label: 'Purchase Contract (Executed)', checked: false },
  { id: '5', label: 'Appraisal Report', checked: false },
  { id: '6', label: 'Hazard Insurance Binder', checked: false },
];

const DEFAULT_CLIENTS: Client[] = [
    { 
      id: '1', 
      name: 'Jonathan & Sarah Miller', 
      email: 'j.miller@example.com', 
      phone: '(415) 555-0123', 
      loanAmount: 2500000, 
      propertyAddress: '2400 Pacific Ave, San Francisco, CA',
      status: 'Pre-Approval', 
      nextActionDate: new Date().toISOString().split('T')[0],
      notes: 'Looking in Pacific Heights. Needs Jumbo Interest Only options.', 
      checklist: [...DEFAULT_CHECKLIST]
    },
    { 
      id: '2', 
      name: 'Estate of A. Thompson', 
      email: 'executor@thompson.com', 
      phone: '(212) 555-0987', 
      loanAmount: 1200000, 
      propertyAddress: '15 Central Park West, New York, NY',
      status: 'Underwriting', 
      nextActionDate: '2023-11-12',
      notes: 'Complex trust structure. awaiting trust docs.', 
      checklist: DEFAULT_CHECKLIST.map(i => i.id === '1' || i.id === '2' ? {...i, checked: true} : i)
    }
];

const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    id: 't1',
    name: 'Intro / Application Invite',
    subject: 'Next Steps: Mortgage Application',
    body: "Hi [Client Name],\n\nIt was a pleasure speaking with you. To proceed with your pre-approval, please complete the online application link below.\n\nLet me know if you have any questions about the process.\n\nBest,\n[Your Name]",
    isDefault: true
  },
  {
    id: 't2',
    name: 'Rate Lock Confirmation',
    subject: 'CONFIRMED: Your Interest Rate is Locked',
    body: "Hi [Client Name],\n\nGreat news. We have successfully locked your interest rate at [Rate]% for [Days] days.\n\nAttached is the official Loan Estimate for your review.\n\nBest,\n[Your Name]",
    isDefault: true
  }
];

export const ClientManager: React.FC = () => {
  const { showToast } = useToast();
  
  // Data State with Persistence
  const [clients, setClients] = useState<Client[]>(() => loadFromStorage(StorageKeys.CLIENTS, DEFAULT_CLIENTS));
  const [templates, setTemplates] = useState<EmailTemplate[]>(() => loadFromStorage(StorageKeys.TEMPLATES, DEFAULT_TEMPLATES));
  const [recentClientIds, setRecentClientIds] = useState<string[]>(() => loadFromStorage(StorageKeys.RECENT_IDS, []));

  // Save on change
  useEffect(() => {
    saveToStorage(StorageKeys.CLIENTS, clients);
  }, [clients]);

  useEffect(() => {
    saveToStorage(StorageKeys.TEMPLATES, templates);
  }, [templates]);

  useEffect(() => {
    saveToStorage(StorageKeys.RECENT_IDS, recentClientIds);
  }, [recentClientIds]);

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filtering State
  const [showFilters, setShowFilters] = useState(false);
  const [showRecents, setShowRecents] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [minLoanFilter, setMinLoanFilter] = useState<string>('');
  const [maxLoanFilter, setMaxLoanFilter] = useState<string>('');
  const [dateStartFilter, setDateStartFilter] = useState<string>('');
  const [dateEndFilter, setDateEndFilter] = useState<string>('');

  // New Client Modal State
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [newClientForm, setNewClientForm] = useState<Partial<Client>>({
      status: 'Lead',
      checklist: [...DEFAULT_CHECKLIST]
  });

  // Email Draft State
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailTopic, setEmailTopic] = useState('Status Update');
  const [emailDraft, setEmailDraft] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [isGeneratingFollowUp, setIsGeneratingFollowUp] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Template State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isSaveTemplateMode, setIsSaveTemplateMode] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  // Voice Command State
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // --- Handlers ---

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    
    // Update Recent History
    setRecentClientIds(prev => {
        // Remove id if it exists, add to front, keep max 5
        const filtered = prev.filter(id => id !== client.id);
        return [client.id, ...filtered].slice(0, 5);
    });
  };

  const handleCreateClient = () => {
      if (!newClientForm.name || !newClientForm.loanAmount) {
          showToast('Name and Loan Amount are required', 'error');
          return;
      }

      const newClient: Client = {
          id: Date.now().toString(),
          name: newClientForm.name || 'Unknown',
          email: newClientForm.email || '',
          phone: newClientForm.phone || '',
          loanAmount: newClientForm.loanAmount || 0,
          propertyAddress: newClientForm.propertyAddress || 'TBD',
          status: newClientForm.status || 'Lead',
          nextActionDate: new Date().toISOString().split('T')[0],
          notes: newClientForm.notes || '',
          checklist: DEFAULT_CHECKLIST.map(i => ({...i})) // Clone checklist
      };

      setClients(prev => [newClient, ...prev]);
      setIsAddClientModalOpen(false);
      setNewClientForm({ status: 'Lead', checklist: [...DEFAULT_CHECKLIST] });
      showToast('Client added successfully', 'success');
  };

  const handleDeleteClient = (id: string) => {
      if (confirm('Are you sure you want to delete this client? This action cannot be undone.')) {
          setClients(prev => prev.filter(c => c.id !== id));
          if (selectedClient?.id === id) setSelectedClient(null);
          // Also remove from recents
          setRecentClientIds(prev => prev.filter(recId => recId !== id));
          showToast('Client deleted', 'info');
      }
  };

  const toggleChecklist = (clientId: string, itemId: string) => {
    setClients(prev => prev.map(c => {
      if (c.id === clientId) {
        return {
          ...c,
          checklist: c.checklist.map(i => i.id === itemId ? { ...i, checked: !i.checked } : i)
        };
      }
      return c;
    }));
    
    // Update selected client view if active
    if (selectedClient && selectedClient.id === clientId) {
      setSelectedClient(prev => {
        if (!prev) return null;
        return {
            ...prev,
            checklist: prev.checklist.map(i => i.id === itemId ? { ...i, checked: !i.checked } : i)
        }
      });
    }
  };

  const setChecklistReminder = (clientId: string, itemId: string, date: string) => {
    const updatedClient = clients.find(c => c.id === clientId);
    if (!updatedClient) return;

    setClients(prev => prev.map(c => {
        if (c.id === clientId) {
            return {
                ...c,
                checklist: c.checklist.map(i => i.id === itemId ? { ...i, reminderDate: date } : i)
            }
        }
        return c;
    }));

     if (selectedClient && selectedClient.id === clientId) {
        setSelectedClient(prev => {
            if (!prev) return null;
            return {
                ...prev,
                checklist: prev.checklist.map(i => i.id === itemId ? { ...i, reminderDate: date } : i)
            }
        });
    }
    showToast(`Reminder set for ${date}`, 'success');
  };

  const updateClientStatus = (clientId: string, newStatus: Client['status']) => {
    const today = new Date();
    let daysAdded = 0;
    const futureDate = new Date(today);
    
    // Simple logic to set next action date to 5 business days out
    while (daysAdded < 5) {
      futureDate.setDate(futureDate.getDate() + 1);
      if (futureDate.getDay() !== 0 && futureDate.getDay() !== 6) {
        daysAdded++;
      }
    }
    const nextActionDate = futureDate.toISOString().split('T')[0];
    
    setClients(prev => prev.map(c => {
        if (c.id === clientId) {
            return { ...c, status: newStatus, nextActionDate };
        }
        return c;
    }));

    if (selectedClient && selectedClient.id === clientId) {
        setSelectedClient(prev => prev ? { ...prev, status: newStatus, nextActionDate } : null);
    }
    showToast(`Status updated to ${newStatus}`, 'info');
  };

  const handleUpdateNotes = (newNotes: string) => {
    if (!selectedClient) return;
    
    // Update local state
    setSelectedClient({ ...selectedClient, notes: newNotes });

    // Update global state
    setClients(prev => prev.map(c => 
        c.id === selectedClient.id ? { ...c, notes: newNotes } : c
    ));
  };

  const handleGenerateDraft = async () => {
    if (!selectedClient) return;
    setIsDrafting(true);
    setSelectedTemplateId(''); 
    try {
        const result = await generateEmailDraft(selectedClient, emailTopic, selectedClient.notes);
        setEmailDraft(result || 'Could not generate draft.');
        showToast('Draft generated successfully', 'success');
    } catch (e) {
        showToast('Failed to generate draft', 'error');
    } finally {
        setIsDrafting(false);
    }
  };

  const handleAiFollowUp = async () => {
    if (!selectedClient) return;
    setIsGeneratingFollowUp(true);
    showToast('Consulting AI Assistant...', 'info');
    try {
        const topic = `Personalized follow-up for ${selectedClient.status}`;
        const draft = await generateEmailDraft(selectedClient, topic, `Current Notes: ${selectedClient.notes}`);
        
        setEmailTopic(topic);
        setEmailDraft(draft || '');
        setSelectedTemplateId(''); 
        setIsEmailModalOpen(true);
        showToast('Draft generated', 'success');
    } catch (e) {
        showToast('Failed to generate draft', 'error');
    } finally {
        setIsGeneratingFollowUp(false);
    }
  };

  const handleReadDraft = async () => {
      if (!emailDraft) return;
      setIsSpeaking(true);
      try {
          const base64Audio = await generateSpeech(emailDraft);
          const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
          audio.onended = () => setIsSpeaking(false);
          audio.play();
      } catch (e) {
          console.error(e);
          showToast('Failed to generate speech', 'error');
          setIsSpeaking(false);
      }
  };

  const handleLoadTemplate = (templateId: string) => {
      setSelectedTemplateId(templateId);
      const template = templates.find(t => t.id === templateId);
      if (template) {
          let body = template.body;
          let subject = template.subject;
          
          if (selectedClient) {
              body = body.replace('[Client Name]', selectedClient.name.split(' ')[0]);
          }

          setEmailDraft(body);
          setEmailTopic(subject);
      }
  };

  const handleSaveTemplate = () => {
      if (!newTemplateName.trim() || !emailDraft.trim()) return;
      
      const newTemplate: EmailTemplate = {
          id: Date.now().toString(),
          name: newTemplateName,
          subject: emailTopic,
          body: emailDraft,
          isDefault: false
      };

      setTemplates(prev => [...prev, newTemplate]);
      setSelectedTemplateId(newTemplate.id);
      setIsSaveTemplateMode(false);
      setNewTemplateName('');
      showToast('Template saved', 'success');
  };

  const handleDeleteTemplate = (id: string) => {
      setTemplates(prev => prev.filter(t => t.id !== id));
      if (selectedTemplateId === id) {
          setSelectedTemplateId('');
          setEmailDraft('');
      }
      showToast('Template deleted', 'info');
  };

  const resetFilters = () => {
      setStatusFilter('All');
      setMinLoanFilter('');
      setMaxLoanFilter('');
      setDateStartFilter('');
      setDateEndFilter('');
      setSearchTerm('');
  };

  // --- Voice Command Implementation (Gemini Transcription) ---

  const startListening = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunksRef.current.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            setIsProcessingCommand(true);
            try {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = async () => {
                    const base64Audio = (reader.result as string).split(',')[1];
                    try {
                        // 1. Transcribe with Gemini Flash
                        const transcript = await transcribeAudio(base64Audio);
                        setVoiceTranscript(transcript);
                        
                        // 2. Parse command
                        if (transcript) {
                            await processVoiceCommand(transcript);
                        } else {
                            showToast("No speech detected.", 'info');
                        }
                    } catch (e) {
                         showToast('Voice processing failed.', 'error');
                    } finally {
                         setIsProcessingCommand(false);
                         setIsListening(false);
                         setVoiceTranscript('');
                    }
                };
            } catch (e) {
                console.error(e);
                setIsProcessingCommand(false);
                setIsListening(false);
            }
            
            // Stop tracks
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsListening(true);
        setVoiceTranscript('');
    } catch (e) {
        showToast('Microphone access denied.', 'error');
    }
  };

  const stopListening = () => {
      if (mediaRecorderRef.current && isListening) {
          mediaRecorderRef.current.stop();
          setIsListening(false); // UI update immediate, processing happens in onstop
      }
  };

  const processVoiceCommand = async (text: string) => {
      try {
          const intent: CommandIntent = await parseNaturalLanguageCommand(text);
          console.log("Parsed Intent:", intent);

          if (intent.action === 'CREATE_CLIENT') {
              const newClient: Client = {
                  id: Date.now().toString(),
                  name: intent.payload.name || 'New Client',
                  loanAmount: intent.payload.loanAmount || 0,
                  status: (intent.payload.status as any) || 'Lead',
                  email: '',
                  phone: '',
                  propertyAddress: 'TBD',
                  nextActionDate: new Date().toISOString().split('T')[0],
                  notes: intent.payload.note || 'Created via Voice Command',
                  checklist: [...DEFAULT_CHECKLIST]
              };
              setClients(prev => [newClient, ...prev]);
              showToast(`Created client: ${newClient.name}`, 'success');
          } 
          else if ((intent.action === 'UPDATE_STATUS' || intent.action === 'UPDATE_CLIENT') && intent.clientName) {
              const target = clients.find(c => c.name.toLowerCase().includes(intent.clientName!.toLowerCase()));
              if (target) {
                  let updates: Partial<Client> = {};
                  let message = `Updated ${target.name}: `;
                  
                  if (intent.payload.status) {
                       updates.status = intent.payload.status as any;
                       message += `Status to ${intent.payload.status}. `;
                  }
                  if (intent.payload.loanAmount) {
                      updates.loanAmount = intent.payload.loanAmount;
                      message += `Loan to $${intent.payload.loanAmount.toLocaleString()}. `;
                  }
                  if (intent.payload.phone) {
                      updates.phone = intent.payload.phone;
                      message += `Phone updated. `;
                  }
                  if (intent.payload.email) {
                      updates.email = intent.payload.email;
                      message += `Email updated. `;
                  }

                  if (Object.keys(updates).length > 0) {
                      setClients(prev => prev.map(c => c.id === target.id ? { ...c, ...updates } : c));
                      if (selectedClient?.id === target.id) setSelectedClient({ ...target, ...updates });
                      showToast(message.trim(), 'success');
                  } else {
                      showToast('Found client but no specific details to update.', 'info');
                  }
              } else {
                  showToast('Client not found.', 'error');
              }
          }
          else if (intent.action === 'ADD_NOTE' && intent.clientName) {
              const target = clients.find(c => c.name.toLowerCase().includes(intent.clientName!.toLowerCase()));
              if (target && intent.payload.note) {
                  const updatedNote = target.notes + `\n[Voice Note]: ${intent.payload.note}`;
                  setClients(prev => prev.map(c => c.id === target.id ? { ...c, notes: updatedNote } : c));
                  if (selectedClient?.id === target.id) setSelectedClient({ ...target, notes: updatedNote });
                  showToast('Note added', 'success');
              }
          }
          else if (intent.action === 'ADD_TASK' && intent.clientName) {
              const target = clients.find(c => c.name.toLowerCase().includes(intent.clientName!.toLowerCase()));
              if (target && intent.payload.taskLabel) {
                  const newItem: ChecklistItem = {
                      id: Date.now().toString(),
                      label: intent.payload.taskLabel,
                      checked: false,
                      reminderDate: intent.payload.date
                  };
                  const updatedChecklist = [...target.checklist, newItem];
                  setClients(prev => prev.map(c => c.id === target.id ? { ...c, checklist: updatedChecklist } : c));
                  if (selectedClient?.id === target.id) setSelectedClient({ ...target, checklist: updatedChecklist });
                  showToast('Task added', 'success');
              }
          }
          else {
              showToast("I couldn't understand that command.", 'error');
          }

      } catch (e) {
          console.error(e);
          showToast('Failed to execute command', 'error');
      }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Lead': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Pre-Approval': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Underwriting': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Clear to Close': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Closed': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      // Search
      const matchesSearch = 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.propertyAddress.toLowerCase().includes(searchTerm.toLowerCase());

      // Status
      const matchesStatus = statusFilter === 'All' || c.status === statusFilter;

      // Loan Amount
      const min = minLoanFilter ? parseFloat(minLoanFilter) : 0;
      const max = maxLoanFilter ? parseFloat(maxLoanFilter) : Infinity;
      const matchesLoan = c.loanAmount >= min && c.loanAmount <= max;

      // Date Range
      const matchesDateStart = !dateStartFilter || c.nextActionDate >= dateStartFilter;
      const matchesDateEnd = !dateEndFilter || c.nextActionDate <= dateEndFilter;

      return matchesSearch && matchesStatus && matchesLoan && matchesDateStart && matchesDateEnd;
    });
  }, [clients, searchTerm, statusFilter, minLoanFilter, maxLoanFilter, dateStartFilter, dateEndFilter]);

  const recentClients = useMemo(() => {
      return recentClientIds
        .map(id => clients.find(c => c.id === id))
        .filter((c): c is Client => c !== undefined);
  }, [recentClientIds, clients]);

  const today = new Date().toISOString().split('T')[0];
  const priorityClients = useMemo(() => clients.filter(c => c.nextActionDate <= today && c.status !== 'Closed'), [clients, today]);

  const totalPipeline = useMemo(() => filteredClients.reduce((acc, c) => acc + c.loanAmount, 0), [filteredClients]);

  return (
    <div className="flex h-full bg-slate-50 relative overflow-hidden animate-fade-in">
      {/* List View */}
      <div className={`flex flex-col p-4 md:p-8 transition-all duration-300 w-full ${selectedClient ? 'md:w-2/3 lg:w-3/4' : 'w-full'}`}>
        
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-brand-dark tracking-tight">Client Dashboard</h2>
            <p className="text-sm text-gray-500">Manage pipeline & active deals.</p>
          </div>
          <div className="flex space-x-2 relative">
             {/* Listening UI Overlay */}
            {(isListening || isProcessingCommand) && (
                <div className="absolute top-12 right-0 z-50 bg-brand-dark text-white p-3 rounded-lg shadow-xl w-64 animate-fade-in border border-gray-700">
                    <div className="flex items-center space-x-2 mb-2 border-b border-gray-600 pb-2">
                        {isListening ? <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div> : <Sparkles size={12} className="text-brand-gold"/>}
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                            {isProcessingCommand ? 'Thinking...' : 'Recording...'}
                        </span>
                    </div>
                    <p className="text-sm italic text-gray-200">
                        {voiceTranscript || "Say 'Create client John Doe...'"}
                    </p>
                </div>
            )}

            <button 
                onClick={isListening ? stopListening : startListening}
                disabled={isProcessingCommand}
                className={`px-4 py-2.5 rounded-lg flex items-center justify-center space-x-2 shadow-lg transition-all active:scale-95 border ${
                    isListening 
                    ? 'bg-red-500 text-white border-red-600 animate-pulse' 
                    : isProcessingCommand 
                        ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                        : 'bg-white text-brand-dark border-brand-gold/50 hover:bg-yellow-50'
                }`}
            >
                {isListening ? <StopCircle size={18} /> : <Mic size={18} />}
                <span className="font-bold text-sm hidden md:inline">{isListening ? 'Stop Recording' : 'Magic Mic'}</span>
            </button>
            <button 
                className="bg-brand-red hover:bg-red-700 text-white px-5 py-2.5 rounded-lg flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transition-all active:scale-95"
                onClick={() => setIsAddClientModalOpen(true)}
            >
                <UserPlus size={18} />
                <span className="font-semibold hidden md:inline">Add Client</span>
                <span className="md:hidden"><Plus size={18}/></span>
            </button>
          </div>
        </div>

        {/* Priority Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm transition-transform hover:scale-[1.01]">
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Filtered Volume</p>
                <p className="text-2xl font-bold text-brand-dark mt-1">${(totalPipeline / 1000000).toFixed(1)}M</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm transition-transform hover:scale-[1.01]">
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Priority Actions</p>
                <p className="text-2xl font-bold text-brand-red mt-1">{priorityClients.length}</p>
            </div>
             <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm transition-transform hover:scale-[1.01]">
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Filtered Count</p>
                <p className="text-2xl font-bold text-gray-700 mt-1">{filteredClients.length}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm transition-transform hover:scale-[1.01]">
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Total Database</p>
                <p className="text-2xl font-bold text-gray-400 mt-1">{clients.length}</p>
            </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mb-6 space-y-2 relative z-10">
            <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 text-gray-400 h-5 w-5" />
                    <input 
                    type="text" 
                    placeholder="Search by name, address, or basic status..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg focus:outline-none focus:bg-gray-50 transition-colors"
                    />
                </div>
                <div className="h-6 w-px bg-gray-200"></div>
                
                <button 
                    onClick={() => { setShowRecents(!showRecents); setShowFilters(false); }}
                    className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium whitespace-nowrap ${showRecents ? 'bg-brand-gold text-brand-dark' : 'text-gray-500 hover:text-brand-dark hover:bg-gray-50'}`}
                    title="Recent History"
                >
                    <Clock size={18} />
                    <span className="hidden lg:inline">History</span>
                </button>

                <button 
                    onClick={() => { setShowFilters(!showFilters); setShowRecents(false); }}
                    className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium whitespace-nowrap ${showFilters ? 'bg-brand-red text-white' : 'text-gray-500 hover:text-brand-dark hover:bg-gray-50'}`}
                >
                    <Filter size={18} />
                    <span className="hidden md:inline">Filters</span>
                </button>
            </div>

            {/* Recently Viewed Panel */}
            {showRecents && (
                 <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-4 animate-slide-up">
                    <div className="flex justify-between items-center mb-3">
                         <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center">
                             <History size={12} className="mr-1"/> Recently Viewed
                         </h4>
                         <button onClick={() => setShowRecents(false)} className="text-gray-400 hover:text-gray-600"><X size={14}/></button>
                    </div>
                    {recentClients.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {recentClients.map(client => (
                                <div 
                                    key={client.id}
                                    onClick={() => { handleSelectClient(client); setShowRecents(false); }}
                                    className="p-3 rounded-lg border border-gray-100 hover:border-brand-gold hover:bg-yellow-50 cursor-pointer transition-all flex items-center space-x-3 group"
                                >
                                    <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold group-hover:bg-brand-gold group-hover:text-white transition-colors">
                                        {client.name.charAt(0)}
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="text-sm font-bold text-gray-800 truncate">{client.name}</p>
                                        <p className="text-xs text-gray-500 truncate">{client.status}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400 italic text-center py-4">No recent history yet.</p>
                    )}
                 </div>
            )}

            {/* Collapsible Filter Panel */}
            {showFilters && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-5 animate-slide-up grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1.5 block">Status</label>
                        <select 
                            value={statusFilter} 
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-red outline-none"
                        >
                            <option value="All">All Statuses</option>
                            <option value="Lead">Lead</option>
                            <option value="Pre-Approval">Pre-Approval</option>
                            <option value="Underwriting">Underwriting</option>
                            <option value="Clear to Close">Clear to Close</option>
                            <option value="Closed">Closed</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1.5 block">Loan Amount Range</label>
                        <div className="flex items-center space-x-2">
                            <input 
                                type="number" 
                                placeholder="Min" 
                                value={minLoanFilter}
                                onChange={(e) => setMinLoanFilter(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-red outline-none"
                            />
                            <span className="text-gray-400">-</span>
                            <input 
                                type="number" 
                                placeholder="Max" 
                                value={maxLoanFilter}
                                onChange={(e) => setMaxLoanFilter(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-red outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1.5 block">Next Action Date</label>
                        <div className="flex items-center space-x-2">
                            <input 
                                type="date" 
                                value={dateStartFilter}
                                onChange={(e) => setDateStartFilter(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-red outline-none"
                            />
                            <span className="text-gray-400">-</span>
                            <input 
                                type="date" 
                                value={dateEndFilter}
                                onChange={(e) => setDateEndFilter(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-red outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex items-end">
                        <button 
                            onClick={resetFilters}
                            className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={14} /> Reset Filters
                        </button>
                    </div>
                </div>
            )}
        </div>

        {/* Client List */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1 flex flex-col relative">
          <div className="overflow-x-auto overflow-y-auto h-full scrollbar-hide">
            {filteredClients.length > 0 ? (
                <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50/80 backdrop-blur sticky top-0 z-10 border-b border-gray-200">
                    <tr>
                    <th className="px-6 py-4 font-bold text-gray-500 text-[10px] uppercase tracking-wider">Client Details</th>
                    <th className="px-6 py-4 font-bold text-gray-500 text-[10px] uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 font-bold text-gray-500 text-[10px] uppercase tracking-wider hidden md:table-cell">Loan Amount</th>
                    <th className="px-6 py-4 font-bold text-gray-500 text-[10px] uppercase tracking-wider hidden md:table-cell">Next Action</th>
                    <th className="px-6 py-4"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {filteredClients.map((client) => (
                    <tr 
                        key={client.id} 
                        onClick={() => handleSelectClient(client)}
                        className={`cursor-pointer transition-colors group ${selectedClient?.id === client.id ? 'bg-blue-50/60' : 'hover:bg-gray-50'}`}
                    >
                        <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-dark to-slate-700 text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-sm">
                                {client.name.charAt(0)}
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900 text-sm group-hover:text-brand-red transition-colors">{client.name}</p>
                                <p className="text-xs text-gray-500 truncate max-w-[140px] md:max-w-[200px]">{client.propertyAddress}</p>
                            </div>
                        </div>
                        </td>
                        <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border shadow-sm ${getStatusColor(client.status)}`}>
                            {client.status}
                        </span>
                        </td>
                        <td className="px-6 py-4 text-gray-700 font-mono text-sm font-medium hidden md:table-cell">
                        ${(client.loanAmount / 1000000).toFixed(2)}M
                        </td>
                        <td className="px-6 py-4 hidden md:table-cell">
                        <div className={`flex items-center text-xs font-medium ${client.nextActionDate <= today ? 'text-red-600 bg-red-50 px-2 py-1 rounded w-fit' : 'text-gray-500'}`}>
                            <Calendar size={14} className="mr-1.5"/>
                            {client.nextActionDate}
                        </div>
                        </td>
                        <td className="px-6 py-4 text-right text-gray-300 group-hover:text-brand-red transition-colors">
                            <ChevronRight size={20} />
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 p-12">
                    <Search size={48} className="mb-4 opacity-20"/>
                    <p>No clients found matching filters.</p>
                    <button onClick={resetFilters} className="mt-4 text-sm text-brand-red hover:underline font-medium">Clear all filters</button>
                </div>
            )}
          </div>
        </div>
      </div>

      {/* Client Detail Slide-out */}
      {selectedClient && (
          <div className="fixed md:absolute inset-0 md:inset-auto md:right-0 md:top-0 md:bottom-0 w-full md:w-1/3 lg:w-1/4 bg-white border-l border-gray-200 h-full overflow-y-auto shadow-2xl animate-slide-in-right z-20 flex flex-col">
              <div className="p-6 border-b border-gray-100 flex justify-between items-start sticky top-0 bg-white/95 backdrop-blur-sm z-10 shadow-sm">
                  <div>
                      <h3 className="text-xl font-bold text-gray-900 leading-tight">{selectedClient.name}</h3>
                      <p className="text-xs text-gray-500 flex items-center mt-1">
                          <MapPin size={12} className="mr-1 shrink-0"/>
                          <span className="truncate max-w-[200px]">{selectedClient.propertyAddress}</span>
                      </p>
                  </div>
                  <button onClick={() => setSelectedClient(null)} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition-colors">
                      <X size={20} />
                  </button>
              </div>

              <div className="p-6 space-y-8 flex-1">
                {/* Actions */}
                <div className="grid grid-cols-4 gap-3">
                    <button className="flex flex-col items-center justify-center p-3 bg-white hover:bg-green-50 rounded-xl transition-all border border-gray-200 hover:border-green-200 group shadow-sm hover:shadow">
                        <Phone className="w-5 h-5 text-gray-400 group-hover:text-green-600 mb-1" />
                        <span className="text-[10px] font-bold text-gray-600 group-hover:text-green-700 uppercase">Call</span>
                    </button>
                    <button onClick={() => { setIsEmailModalOpen(true); setEmailDraft(''); setSelectedTemplateId(''); }} className="flex flex-col items-center justify-center p-3 bg-white hover:bg-blue-50 rounded-xl transition-all border border-gray-200 hover:border-blue-200 group shadow-sm hover:shadow">
                        <Mail className="w-5 h-5 text-gray-400 group-hover:text-blue-600 mb-1" />
                        <span className="text-[10px] font-bold text-gray-600 group-hover:text-blue-700 uppercase">Email</span>
                    </button>
                    <button 
                        onClick={handleAiFollowUp}
                        disabled={isGeneratingFollowUp}
                        className="flex flex-col items-center justify-center p-3 bg-brand-dark/5 hover:bg-brand-dark/10 rounded-xl transition-all border border-transparent hover:border-brand-dark/20 group shadow-sm hover:shadow"
                    >
                        {isGeneratingFollowUp ? (
                            <Loader2 className="w-5 h-5 text-brand-dark animate-spin mb-1" />
                        ) : (
                            <Sparkles className="w-5 h-5 text-gray-400 group-hover:text-brand-dark mb-1" />
                        )}
                        <span className="text-[10px] font-bold text-gray-600 group-hover:text-brand-dark uppercase whitespace-nowrap">AI Follow-Up</span>
                    </button>
                    <button className="flex flex-col items-center justify-center p-3 bg-white hover:bg-purple-50 rounded-xl transition-all border border-gray-200 hover:border-purple-200 group shadow-sm hover:shadow">
                        <MessageSquare className="w-5 h-5 text-gray-400 group-hover:text-purple-600 mb-1" />
                        <span className="text-[10px] font-bold text-gray-600 group-hover:text-purple-700 uppercase">Log</span>
                    </button>
                </div>

                {/* Status Card */}
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block tracking-wider">Deal Status</label>
                    <div className="relative">
                        <select 
                            value={selectedClient.status}
                            onChange={(e) => updateClientStatus(selectedClient.id, e.target.value as any)}
                            className="w-full p-2.5 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-brand-dark outline-none focus:ring-2 focus:ring-brand-red transition-all cursor-pointer shadow-sm appearance-none"
                        >
                            {['Lead', 'Pre-Approval', 'Underwriting', 'Clear to Close', 'Closed'].map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                         {/* Custom Arrow */}
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                            <ChevronRight size={14} className="rotate-90" />
                        </div>
                    </div>
                    
                    <div className="mt-5 grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase font-bold">Loan Amount</p>
                            <p className="font-mono font-medium text-gray-900 mt-0.5">${selectedClient.loanAmount.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase font-bold">Next Touch</p>
                            <p className="font-medium text-gray-900 mt-0.5">{selectedClient.nextActionDate}</p>
                        </div>
                    </div>
                </div>

                {/* Checklist with Reminders */}
                <div>
                    <h4 className="font-bold text-gray-800 mb-4 flex items-center text-xs uppercase tracking-wide">
                        <CheckSquare size={16} className="mr-2 text-brand-red"/>
                        Conditions / Docs
                    </h4>
                    <div className="space-y-2">
                        {selectedClient.checklist.map(item => (
                            <div 
                                key={item.id} 
                                className={`flex items-center justify-between p-3 rounded-lg border transition-all group/item ${item.checked ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-200 hover:border-brand-red/30 hover:shadow-sm'}`}
                            >
                                <div 
                                    className="flex items-center flex-1 cursor-pointer"
                                    onClick={() => toggleChecklist(selectedClient.id, item.id)}
                                >
                                    <div className={`mr-3 transition-transform duration-200 ${item.checked ? 'scale-100' : 'scale-90'}`}>
                                        {item.checked 
                                            ? <CheckSquare className="text-green-600" size={18} />
                                            : <Square className="text-gray-300" size={18} />
                                        }
                                    </div>
                                    <span className={`text-sm ${item.checked ? 'text-gray-400 line-through' : 'text-gray-700 font-medium'}`}>
                                        {item.label}
                                    </span>
                                </div>
                                
                                {/* Reminder Bell */}
                                <div className="relative group/reminder ml-2">
                                    <button 
                                        className={`p-1.5 rounded-full transition-colors ${item.reminderDate ? 'text-brand-dark bg-brand-gold/20' : 'text-gray-300 hover:text-brand-gold'}`}
                                        title={item.reminderDate ? `Reminder: ${item.reminderDate}` : 'Set Reminder'}
                                    >
                                        <Bell size={14} className={item.reminderDate && item.reminderDate <= today && !item.checked ? 'animate-pulse text-red-600' : ''}/>
                                    </button>
                                    
                                    {/* Date Picker Tooltip on Hover */}
                                    <div className="absolute right-0 top-full mt-1 hidden group-hover/reminder:block z-20 bg-white p-2 shadow-xl border border-gray-200 rounded-lg w-48">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Set Reminder</p>
                                        <input 
                                            type="date" 
                                            className="w-full text-xs p-1 border rounded"
                                            value={item.reminderDate || ''}
                                            onChange={(e) => setChecklistReminder(selectedClient.id, item.id, e.target.value)}
                                        />
                                        {item.reminderDate && (
                                            <button 
                                                onClick={() => setChecklistReminder(selectedClient.id, item.id, '')}
                                                className="mt-2 text-[10px] text-red-500 hover:underline w-full text-left"
                                            >
                                                Clear Reminder
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Notes */}
                <div>
                    <h4 className="font-bold text-gray-800 mb-2 text-xs uppercase tracking-wide">Notes</h4>
                    <textarea
                        value={selectedClient.notes}
                        onChange={(e) => handleUpdateNotes(e.target.value)}
                        className="w-full bg-yellow-50/50 p-4 rounded-lg border border-yellow-100 text-sm text-gray-700 leading-relaxed font-medium focus:bg-white focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold outline-none transition-all resize-none min-h-[120px]"
                        placeholder="Add private notes about this deal..."
                    />
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-gray-100 bg-gray-50 mt-auto">
                 <button 
                    onClick={() => handleDeleteClient(selectedClient.id)}
                    className="w-full flex items-center justify-center p-2 text-red-500 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
                 >
                     <Trash2 size={16} className="mr-2" /> Delete Client Record
                 </button>
              </div>
          </div>
      )}

      {/* Add Client Modal */}
      {isAddClientModalOpen && (
          <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-scale-up overflow-hidden">
                  <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                      <h3 className="font-bold text-lg text-brand-dark">Add New Client</h3>
                      <button onClick={() => setIsAddClientModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                          <X size={20}/>
                      </button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Full Name *</label>
                          <input 
                            value={newClientForm.name || ''}
                            onChange={e => setNewClientForm({...newClientForm, name: e.target.value})}
                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-red outline-none text-sm"
                            placeholder="e.g. John Doe"
                          />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Loan Amount *</label>
                            <input 
                                type="number"
                                value={newClientForm.loanAmount || ''}
                                onChange={e => setNewClientForm({...newClientForm, loanAmount: parseFloat(e.target.value)})}
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-red outline-none text-sm"
                                placeholder="2500000"
                            />
                         </div>
                         <div>
                             <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Phone</label>
                             <input 
                                value={newClientForm.phone || ''}
                                onChange={e => setNewClientForm({...newClientForm, phone: e.target.value})}
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-red outline-none text-sm"
                                placeholder="(555) 000-0000"
                            />
                         </div>
                      </div>
                      <div>
                          <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Property Address</label>
                          <input 
                            value={newClientForm.propertyAddress || ''}
                            onChange={e => setNewClientForm({...newClientForm, propertyAddress: e.target.value})}
                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-red outline-none text-sm"
                            placeholder="123 Market St"
                          />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Initial Notes</label>
                          <textarea 
                            value={newClientForm.notes || ''}
                            onChange={e => setNewClientForm({...newClientForm, notes: e.target.value})}
                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-red outline-none text-sm h-24 resize-none"
                            placeholder="Key details about the deal..."
                          />
                      </div>
                      <button 
                        onClick={handleCreateClient}
                        className="w-full bg-brand-dark text-white py-3 rounded-lg font-bold hover:bg-gray-800 transition-colors shadow-md mt-2"
                      >
                          Create Client Record
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Email Modal */}
      {isEmailModalOpen && selectedClient && (
          <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up relative">
                  
                  {/* Save Template Overlay */}
                  {isSaveTemplateMode && (
                      <div className="absolute inset-0 bg-white/95 z-20 flex items-center justify-center p-8 animate-fade-in">
                          <div className="w-full max-w-sm space-y-4">
                              <h4 className="font-bold text-lg text-brand-dark">Save Template</h4>
                              <div>
                                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Template Name</label>
                                  <input 
                                    autoFocus
                                    value={newTemplateName}
                                    onChange={(e) => setNewTemplateName(e.target.value)}
                                    placeholder="e.g. My Custom Follow Up"
                                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-brand-red outline-none"
                                  />
                              </div>
                              <div className="flex gap-2">
                                  <button onClick={() => setIsSaveTemplateMode(false)} className="flex-1 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                                  <button onClick={handleSaveTemplate} className="flex-1 py-2 bg-brand-red text-white rounded hover:bg-red-700 font-medium">Save</button>
                              </div>
                          </div>
                      </div>
                  )}

                  <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                      <h3 className="font-bold text-lg text-brand-dark flex items-center">
                          <Mail size={18} className="text-brand-dark mr-2"/>
                          Compose Message
                      </h3>
                      <button onClick={() => setIsEmailModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                          <X size={20}/>
                      </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto flex-1">
                       {/* Template Selection */}
                       <div className="mb-6 p-4 bg-blue-50/50 border border-blue-100 rounded-lg">
                           <div className="flex justify-between items-center mb-2">
                               <label className="text-xs font-bold text-blue-700 uppercase flex items-center">
                                   <FileText size={12} className="mr-1"/> Load Template
                               </label>
                           </div>
                           <div className="flex gap-2">
                               <select 
                                   value={selectedTemplateId} 
                                   onChange={(e) => handleLoadTemplate(e.target.value)}
                                   className="flex-1 text-sm border-gray-300 rounded-md border p-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                               >
                                   <option value="">-- Choose a template --</option>
                                   {templates.map(t => (
                                       <option key={t.id} value={t.id}>{t.name}</option>
                                   ))}
                               </select>
                               {selectedTemplateId && !templates.find(t => t.id === selectedTemplateId)?.isDefault && (
                                   <button 
                                     onClick={() => handleDeleteTemplate(selectedTemplateId)}
                                     className="p-2 text-red-500 hover:bg-red-50 rounded border border-gray-200 hover:border-red-100 transition-colors"
                                     title="Delete Template"
                                   >
                                       <Trash2 size={16} />
                                   </button>
                               )}
                           </div>
                       </div>

                       <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div>
                               <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Recipient</label>
                               <div className="bg-gray-100 border border-gray-200 rounded p-2 text-gray-700 text-sm font-medium">
                                   {selectedClient.name}
                               </div>
                           </div>
                           <div>
                               <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Topic / Subject</label>
                               <div className="relative">
                                    <input 
                                        value={emailTopic} 
                                        onChange={(e) => setEmailTopic(e.target.value)}
                                        className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-brand-red focus:border-brand-red outline-none text-sm"
                                        list="topics"
                                        placeholder="Enter subject..."
                                    />
                                    <datalist id="topics">
                                        <option>Status Update</option>
                                        <option>Rate Lock Opportunity</option>
                                        <option>Needed Documents</option>
                                        <option>Pre-Approval Letter Attached</option>
                                        <option>Closing Congratulations</option>
                                    </datalist>
                               </div>
                           </div>
                       </div>
                       
                       {/* AI Actions */}
                       <div className="flex justify-end items-center mb-2 space-x-2">
                           {emailDraft && (
                               <button 
                                    onClick={handleReadDraft}
                                    disabled={isSpeaking}
                                    className="bg-gray-100 text-gray-600 border border-gray-200 px-3 py-1.5 rounded-full text-xs font-bold flex items-center hover:bg-gray-200 transition-colors"
                               >
                                   {isSpeaking ? <Loader2 className="animate-spin w-3 h-3 mr-2"/> : <Volume2 className="w-3 h-3 mr-2"/>}
                                   {isSpeaking ? 'Reading...' : 'Read Aloud'}
                               </button>
                           )}
                           <button 
                                onClick={handleGenerateDraft}
                                disabled={isDrafting}
                                className="bg-brand-red/10 text-brand-red border border-brand-red/20 px-3 py-1.5 rounded-full text-xs font-bold flex items-center hover:bg-brand-red/20 transition-colors disabled:opacity-50"
                            >
                               {isDrafting ? <Loader2 className="animate-spin w-3 h-3 mr-2"/> : <Sparkles className="w-3 h-3 mr-2"/>}
                               {isDrafting ? 'Writing...' : 'Draft with AI'}
                           </button>
                       </div>

                       <div className="bg-white rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-brand-red/20 transition-all shadow-sm">
                           <textarea 
                                value={emailDraft}
                                onChange={(e) => setEmailDraft(e.target.value)}
                                className="w-full bg-transparent border-none outline-none resize-none h-64 p-4 text-sm leading-relaxed text-gray-800 font-sans"
                                placeholder="Write your email here..."
                           />
                           <div className="bg-gray-50 p-2 border-t border-gray-200 flex justify-end">
                               <button 
                                 onClick={() => setIsSaveTemplateMode(true)}
                                 disabled={!emailDraft.trim()}
                                 className="text-xs text-brand-slate hover:text-brand-dark flex items-center px-3 py-1.5 rounded hover:bg-gray-200 transition-colors disabled:opacity-50 font-medium"
                               >
                                   <Save size={14} className="mr-1.5"/> Save Template
                               </button>
                           </div>
                       </div>
                  </div>
                  <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
                      <button onClick={() => setIsEmailModalOpen(false)} className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors">Discard</button>
                      <button 
                        onClick={() => {
                            showToast('Email sent via Outlook Integration', 'success');
                            setIsEmailModalOpen(false);
                        }} 
                        className="px-5 py-2 bg-brand-dark text-white rounded-lg hover:bg-gray-800 text-sm font-bold shadow-md hover:shadow-lg transition-all"
                      >
                          Send Email
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};