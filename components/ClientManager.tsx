import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Client, ChecklistItem, EmailTemplate, CommandIntent, EmailLog } from '../types';
import { Mail, Search, Plus, X, ChevronRight, CheckSquare, Square, Calendar, MapPin, Sparkles, Loader2, Phone, MessageSquare, Save, Trash2, Filter, UserPlus, RefreshCw, Clock, History, Mic, Bell, StopCircle, ChevronDown, Check, Volume2, FileText, Send, BrainCircuit, ArrowRightCircle, ArrowLeft } from 'lucide-react';
import { generateEmailDraft, parseNaturalLanguageCommand, transcribeAudio, generateSpeech, analyzeCommunicationHistory } from '../services/geminiService';
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

// Helper to get future dates for placeholder data
const getFutureDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
};

const DEFAULT_CLIENTS: Client[] = [
    { 
      id: '1', 
      name: 'John & Jane Smith', 
      email: 'j.miller@example.com', 
      phone: '(415) 555-0123', 
      loanAmount: 2500000, 
      propertyAddress: '2400 Pacific Ave, San Francisco, CA',
      status: 'Pre-Approval', 
      nextActionDate: new Date().toISOString().split('T')[0], // Today
      notes: 'Looking in Pacific Heights. Needs Jumbo Interest Only options.', 
      checklist: [...DEFAULT_CHECKLIST],
      emailHistory: [
          {
              id: 'e1',
              date: getFutureDate(-2),
              subject: 'Introduction & Application Link',
              body: 'Hi John,\n\nGreat speaking with you today. As discussed, here is the link to start your application...'
          }
      ]
    },
    { 
      id: '2', 
      name: 'Estate of A. Thompson', 
      email: 'executor@thompson.com', 
      phone: '(212) 555-0987', 
      loanAmount: 1200000, 
      propertyAddress: '15 Central Park West, New York, NY', 
      status: 'Underwriting', 
      nextActionDate: getFutureDate(5), // 5 days out
      notes: 'Complex trust structure. awaiting trust docs.', 
      checklist: DEFAULT_CHECKLIST.map(i => i.id === '1' || i.id === '2' ? {...i, checked: true} : i),
      emailHistory: [
          {
              id: 'e2',
              date: getFutureDate(-5),
              subject: 'Missing Trust Documents',
              body: 'Hello,\n\nOur underwriter has reviewed the file and we are still missing the full trust agreement...'
          },
          {
              id: 'e3',
              date: getFutureDate(-10),
              subject: 'Loan Estimate Attached',
              body: 'Please find the attached Loan Estimate for your review...'
          }
      ]
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
  
  // Multi-select Status Filter
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

  const [minLoanFilter, setMinLoanFilter] = useState<string>('');
  const [maxLoanFilter, setMaxLoanFilter] = useState<string>('');
  const [dateStartFilter, setDateStartFilter] = useState<string>('');
  const [dateEndFilter, setDateEndFilter] = useState<string>('');

  // New Client Modal State
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [newClientForm, setNewClientForm] = useState<Partial<Client> & { nextActionDate?: string }>({
      status: 'Lead',
      checklist: [...DEFAULT_CHECKLIST],
      nextActionDate: new Date().toISOString().split('T')[0],
      emailHistory: []
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

  // History Analysis State
  const [analyzingHistory, setAnalyzingHistory] = useState(false);
  const [historyAnalysis, setHistoryAnalysis] = useState<string | null>(null);

  // Voice Command State
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>('audio/webm');

  // --- Handlers ---

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setHistoryAnalysis(null); // Reset analysis
    
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
          nextActionDate: newClientForm.nextActionDate || new Date().toISOString().split('T')[0],
          notes: newClientForm.notes || '',
          checklist: DEFAULT_CHECKLIST.map(i => ({...i})),
          emailHistory: []
      };

      setClients(prev => [newClient, ...prev]);
      setIsAddClientModalOpen(false);
      setNewClientForm({ 
          status: 'Lead', 
          checklist: [...DEFAULT_CHECKLIST],
          nextActionDate: new Date().toISOString().split('T')[0],
          emailHistory: []
      });
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

  const updateClientDate = (clientId: string, newDate: string) => {
      setClients(prev => prev.map(c => {
          if (c.id === clientId) {
              return { ...c, nextActionDate: newDate };
          }
          return c;
      }));
  
      if (selectedClient && selectedClient.id === clientId) {
          setSelectedClient(prev => prev ? { ...prev, nextActionDate: newDate } : null);
      }
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
    } catch (e) {
        showToast('Failed to generate follow-up', 'error');
    } finally {
        setIsGeneratingFollowUp(false);
    }
  };

  const handleApplyTemplate = (templateId: string) => {
      setSelectedTemplateId(templateId);
      const template = templates.find(t => t.id === templateId);
      if (template && selectedClient) {
          setEmailTopic(template.subject); // Or maybe name?
          // Simple replace
          let body = template.body.replace('[Client Name]', selectedClient.name.split(' ')[0]);
          body = body.replace('[Rate]', '6.125'); // Placeholder
          body = body.replace('[Days]', '30');
          body = body.replace('[Your Name]', 'Your Name');
          setEmailDraft(body);
      }
  };

  const handleSaveTemplate = () => {
      if (!newTemplateName || !emailDraft) return;
      
      const newTemp: EmailTemplate = {
          id: Date.now().toString(),
          name: newTemplateName,
          subject: emailTopic,
          body: emailDraft,
          isDefault: false
      };
      
      setTemplates(prev => [...prev, newTemp]);
      setIsSaveTemplateMode(false);
      setNewTemplateName('');
      showToast('Template saved', 'success');
  };

  const handleSendEmail = () => {
      if (!selectedClient) return;
      
      const newLog: EmailLog = {
          id: Date.now().toString(),
          date: new Date().toISOString().split('T')[0],
          subject: emailTopic,
          body: emailDraft
      };
      
      const updatedClient = {
          ...selectedClient,
          emailHistory: [...selectedClient.emailHistory, newLog]
      };
      
      setSelectedClient(updatedClient);
      setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
      setIsEmailModalOpen(false);
      setEmailDraft('');
      showToast('Email logged to history', 'success');
  };

  const handleAnalyzeHistory = async () => {
      if (!selectedClient || selectedClient.emailHistory.length === 0) {
          showToast('No history to analyze', 'error');
          return;
      }
      setAnalyzingHistory(true);
      try {
          const analysis = await analyzeCommunicationHistory(selectedClient.name, selectedClient.emailHistory);
          setHistoryAnalysis(analysis);
      } catch(e) {
          showToast('Analysis failed', 'error');
      } finally {
          setAnalyzingHistory(false);
      }
  }

  // --- Voice Commands ---

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
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
           const base64Audio = (reader.result as string).split(',')[1];
           try {
             // 1. Transcribe
             const transcript = await transcribeAudio(base64Audio);
             setVoiceTranscript(transcript);
             
             // 2. Parse Intent
             const command = await parseNaturalLanguageCommand(transcript);
             
             // 3. Execute
             executeCommand(command);
             
           } catch (e) {
             console.error(e);
             showToast('Voice command failed', 'error');
           } finally {
             setIsProcessingCommand(false);
             setIsListening(false);
           }
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch (e) {
      console.error(e);
      showToast('Microphone access denied', 'error');
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
    }
  };

  const executeCommand = (command: CommandIntent) => {
    switch (command.action) {
        case 'CREATE_CLIENT':
            if (command.payload.name && command.payload.loanAmount) {
                const newC: Client = {
                    id: Date.now().toString(),
                    name: command.payload.name,
                    loanAmount: command.payload.loanAmount,
                    status: (command.payload.status as any) || 'Lead',
                    email: '', phone: '', propertyAddress: 'TBD',
                    nextActionDate: new Date().toISOString().split('T')[0],
                    checklist: [...DEFAULT_CHECKLIST],
                    emailHistory: [],
                    notes: ''
                };
                setClients(prev => [newC, ...prev]);
                showToast(`Created client: ${newC.name}`, 'success');
            } else {
                showToast('Missing name or amount for new client', 'error');
            }
            break;
        
        case 'UPDATE_STATUS':
        case 'UPDATE_CLIENT':
            // Fuzzy match name
            if (command.clientName) {
               const target = clients.find(c => c.name.toLowerCase().includes(command.clientName!.toLowerCase()));
               if (target) {
                   setClients(prev => prev.map(c => {
                       if (c.id === target.id) {
                           return {
                               ...c,
                               status: (command.payload.status as any) || c.status,
                               loanAmount: command.payload.loanAmount || c.loanAmount,
                               phone: command.payload.phone || c.phone,
                               email: command.payload.email || c.email
                           };
                       }
                       return c;
                   }));
                   showToast(`Updated ${target.name}`, 'success');
               } else {
                   showToast(`Client ${command.clientName} not found`, 'error');
               }
            }
            break;
        case 'ADD_NOTE':
            if (command.clientName && command.payload.note) {
               const target = clients.find(c => c.name.toLowerCase().includes(command.clientName!.toLowerCase()));
               if (target) {
                    setClients(prev => prev.map(c => {
                       if (c.id === target.id) {
                           return { ...c, notes: c.notes ? c.notes + '\n' + command.payload.note : command.payload.note! };
                       }
                       return c;
                   }));
                   showToast(`Note added to ${target.name}`, 'success');
               }
            }
            break;
        default:
            showToast(`Command not recognized: ${command.action}`, 'info');
    }
  };


  // --- Filter Logic ---
  
  const hasActiveFilters = useMemo(() => {
    return statusFilters.length > 0 || minLoanFilter !== '' || maxLoanFilter !== '' || dateStartFilter !== '' || dateEndFilter !== '';
  }, [statusFilters, minLoanFilter, maxLoanFilter, dateStartFilter, dateEndFilter]);

  const clearAllFilters = () => {
    setStatusFilters([]);
    setMinLoanFilter('');
    setMaxLoanFilter('');
    setDateStartFilter('');
    setDateEndFilter('');
  };

  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            client.propertyAddress.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilters.length === 0 || statusFilters.includes(client.status);
      
      const matchesLoanMin = !minLoanFilter || client.loanAmount >= parseFloat(minLoanFilter);
      const matchesLoanMax = !maxLoanFilter || client.loanAmount <= parseFloat(maxLoanFilter);
      
      const matchesDateStart = !dateStartFilter || client.nextActionDate >= dateStartFilter;
      const matchesDateEnd = !dateEndFilter || client.nextActionDate <= dateEndFilter;

      return matchesSearch && matchesStatus && matchesLoanMin && matchesLoanMax && matchesDateStart && matchesDateEnd;
    });
  }, [clients, searchTerm, statusFilters, minLoanFilter, maxLoanFilter, dateStartFilter, dateEndFilter]);

  const recentClients = useMemo(() => {
      return recentClientIds.map(id => clients.find(c => c.id === id)).filter(Boolean) as Client[];
  }, [recentClientIds, clients]);

  // --- Render ---

  return (
    <div className="flex h-full animate-fade-in relative">
      
      {/* Main List Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Top Controls */}
        <div className="p-4 md:p-6 border-b border-gray-200 bg-white shrink-0 safe-top">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-brand-dark tracking-tight">Client Manager</h1>
              <p className="text-sm text-gray-500">Track leads, applications, and closings.</p>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
               <button 
                  onClick={() => setIsAddClientModalOpen(true)}
                  className="flex-1 md:flex-none flex items-center justify-center space-x-2 bg-brand-red hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm active:scale-95"
                >
                  <UserPlus size={18} />
                  <span>New Client</span>
                </button>
                <div className="relative group">
                     <button
                        onClick={isListening ? stopListening : startListening}
                        className={`p-2 rounded-full border transition-all shadow-sm ${isListening ? 'bg-red-50 border-red-200 text-red-500 animate-pulse' : 'bg-white border-gray-200 text-gray-600 hover:text-brand-dark'}`}
                     >
                         {isProcessingCommand ? <Loader2 className="animate-spin" size={20}/> : isListening ? <StopCircle size={20} /> : <Mic size={20}/>}
                     </button>
                     {/* Tooltip for Mic */}
                     <div className="absolute right-0 top-full mt-2 w-64 bg-brand-dark text-white text-xs p-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                        Try: "Add note to Smith: Called today, interest only." or "Create client John Doe loan 500k"
                     </div>
                </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                inputMode="search"
                placeholder="Search clients, emails, addresses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-brand-red outline-none transition-all"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar w-full md:w-auto">
                 <button 
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center space-x-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${showFilters || hasActiveFilters ? 'bg-brand-light border-brand-red text-brand-red' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                 >
                    <Filter size={16} />
                    <span>Filters</span>
                    {hasActiveFilters && (
                        <span className="w-2 h-2 rounded-full bg-brand-red ml-1"></span>
                    )}
                 </button>
                 
                 {hasActiveFilters && (
                    <button
                        onClick={clearAllFilters}
                        className="flex items-center space-x-1 px-3 py-2 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors whitespace-nowrap animate-fade-in"
                    >
                        <X size={14} />
                        <span>Clear</span>
                    </button>
                 )}

                  <button 
                    onClick={() => setShowRecents(!showRecents)}
                    className={`flex items-center space-x-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${showRecents ? 'bg-brand-light border-brand-gold text-brand-dark' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                 >
                    <History size={16} />
                    <span>Recents</span>
                 </button>
            </div>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 animate-slide-up">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {/* Status Multi-Select */}
                      <div className="relative">
                          <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Status</label>
                          <div 
                            className="bg-white border border-gray-300 rounded-md p-2 text-sm flex justify-between items-center cursor-pointer"
                            onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                          >
                              <span className="truncate">
                                  {statusFilters.length === 0 ? 'All Statuses' : `${statusFilters.length} Selected`}
                              </span>
                              <ChevronDown size={14} />
                          </div>
                          {isStatusDropdownOpen && (
                              <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-20 p-2 max-h-48 overflow-y-auto">
                                  {['Lead', 'Pre-Approval', 'Underwriting', 'Clear to Close', 'Closed'].map(status => (
                                      <div 
                                        key={status} 
                                        className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                                        onClick={() => {
                                            setStatusFilters(prev => 
                                                prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
                                            )
                                        }}
                                      >
                                          <div className={`w-4 h-4 border rounded flex items-center justify-center ${statusFilters.includes(status) ? 'bg-brand-red border-brand-red' : 'border-gray-300'}`}>
                                              {statusFilters.includes(status) && <Check size={10} className="text-white" />}
                                          </div>
                                          <span className="text-sm">{status}</span>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>

                      {/* Loan Amount Range */}
                      <div>
                          <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Loan Amount ($)</label>
                          <div className="flex items-center space-x-2">
                              <input 
                                type="number" 
                                inputMode="decimal"
                                placeholder="Min" 
                                value={minLoanFilter}
                                onChange={e => setMinLoanFilter(e.target.value)}
                                className="w-full p-2 text-sm border border-gray-300 rounded-md"
                              />
                              <span className="text-gray-400">-</span>
                              <input 
                                type="number"
                                inputMode="decimal" 
                                placeholder="Max" 
                                value={maxLoanFilter}
                                onChange={e => setMaxLoanFilter(e.target.value)}
                                className="w-full p-2 text-sm border border-gray-300 rounded-md"
                              />
                          </div>
                      </div>

                      {/* Next Action Date Range */}
                      <div>
                          <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Action Date</label>
                          <div className="flex items-center space-x-2">
                              <input 
                                type="date" 
                                value={dateStartFilter}
                                onChange={e => setDateStartFilter(e.target.value)}
                                className="w-full p-2 text-sm border border-gray-300 rounded-md"
                              />
                              <span className="text-gray-400">-</span>
                              <input 
                                type="date" 
                                value={dateEndFilter}
                                onChange={e => setDateEndFilter(e.target.value)}
                                className="w-full p-2 text-sm border border-gray-300 rounded-md"
                              />
                          </div>
                      </div>
                      
                      <div className="flex items-end">
                          <button 
                            onClick={clearAllFilters}
                            className="text-sm text-brand-red hover:underline pb-2"
                          >
                              Clear Filters
                          </button>
                      </div>
                  </div>
              </div>
          )}

          {/* Voice Transcript Feedback */}
          {voiceTranscript && (
              <div className="mt-2 p-2 bg-blue-50 text-blue-700 text-sm rounded border border-blue-100 flex items-center animate-fade-in">
                  <Mic size={14} className="mr-2"/>
                  <span className="italic">"{voiceTranscript}"</span>
              </div>
          )}
        </div>

        {/* Recents Bar */}
        {showRecents && recentClients.length > 0 && (
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-2 flex items-center space-x-4 overflow-x-auto hide-scrollbar">
                <span className="text-xs font-bold text-gray-400 uppercase whitespace-nowrap">Recently Viewed:</span>
                {recentClients.map(c => (
                    <button 
                        key={c.id}
                        onClick={() => handleSelectClient(c)}
                        className="flex items-center space-x-2 bg-white border border-gray-200 rounded-full px-3 py-1 text-xs hover:border-brand-gold transition-colors shadow-sm whitespace-nowrap"
                    >
                        <div className={`w-2 h-2 rounded-full ${c.status === 'Closed' ? 'bg-green-500' : 'bg-brand-red'}`}></div>
                        <span className="font-medium">{c.name}</span>
                    </button>
                ))}
            </div>
        )}

        {/* Client List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20">
          <div className="grid grid-cols-1 gap-4">
            {filteredClients.map((client) => (
              <div
                key={client.id}
                onClick={() => handleSelectClient(client)}
                className={`group bg-white p-4 md:p-5 rounded-xl border transition-all cursor-pointer hover:shadow-md relative overflow-hidden ${
                   selectedClient?.id === client.id ? 'border-brand-red ring-1 ring-brand-red' : 'border-gray-200 hover:border-brand-red/50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-start space-x-4">
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${
                         client.status === 'Closed' ? 'bg-green-100 text-green-700' : 
                         client.status === 'Clear to Close' ? 'bg-green-50 text-green-600' :
                         'bg-brand-light text-brand-dark'
                     }`}>
                         {client.name.charAt(0)}
                     </div>
                     <div>
                        <h3 className="font-bold text-gray-900 group-hover:text-brand-red transition-colors">{client.name}</h3>
                        <p className="text-sm text-gray-500 flex items-center mt-1">
                            <MapPin size={12} className="mr-1" />
                            <span className="truncate max-w-[200px] md:max-w-xs">{client.propertyAddress}</span>
                        </p>
                        <div className="flex items-center space-x-4 mt-3">
                            <span className="text-sm font-semibold text-brand-dark font-mono">
                                ${(client.loanAmount / 1000000).toFixed(2)}M
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                                client.status === 'Lead' ? 'bg-gray-100 text-gray-600 border-gray-200' :
                                client.status === 'Pre-Approval' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                client.status === 'Underwriting' ? 'bg-purple-50 text-purple-600 border-purple-200' :
                                client.status === 'Clear to Close' ? 'bg-green-50 text-green-600 border-green-200' :
                                'bg-emerald-100 text-emerald-800 border-emerald-200'
                            }`}>
                                {client.status}
                            </span>
                        </div>
                     </div>
                  </div>
                  
                  <div className="text-right flex flex-col items-end space-y-2">
                     <div className={`flex items-center text-xs px-2 py-1 rounded ${
                         new Date(client.nextActionDate) <= new Date() ? 'bg-red-50 text-red-600 font-bold' : 'bg-gray-50 text-gray-500'
                     }`}>
                         <Calendar size={12} className="mr-1" />
                         {new Date(client.nextActionDate).toLocaleDateString()}
                     </div>
                     {client.checklist.some(i => i.checked) && (
                         <div className="flex items-center text-xs text-green-600">
                             <CheckSquare size={12} className="mr-1"/>
                             {client.checklist.filter(i => i.checked).length}/{client.checklist.length}
                         </div>
                     )}
                  </div>
                </div>
              </div>
            ))}
            {filteredClients.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                    <Search size={48} className="mx-auto mb-4 opacity-20"/>
                    <p>No clients found matching your filters.</p>
                </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Slide-over */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity" onClick={() => setSelectedClient(null)}></div>
            <div className="relative w-full md:w-[500px] bg-white h-full shadow-2xl flex flex-col animate-slide-in-right transform transition-transform">
                
                {/* Header */}
                <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white shrink-0 safe-top">
                   <div className="flex items-center space-x-3">
                       {/* Mobile Back Button */}
                       <button onClick={() => setSelectedClient(null)} className="md:hidden p-2 -ml-2 text-gray-600 hover:text-brand-dark rounded-full hover:bg-gray-100">
                           <ArrowLeft size={24} />
                       </button>
                       <h2 className="text-xl font-bold text-gray-900 truncate max-w-[200px] md:max-w-xs">{selectedClient.name}</h2>
                   </div>
                   <div className="flex items-center space-x-2">
                       <button 
                         onClick={() => handleDeleteClient(selectedClient.id)}
                         className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-gray-100"
                         title="Delete Client"
                       >
                           <Trash2 size={18} />
                       </button>
                       <button 
                         onClick={() => setSelectedClient(null)}
                         className="p-2 text-gray-400 hover:text-gray-600 transition-colors hidden md:block"
                       >
                           <X size={24} />
                       </button>
                   </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 safe-bottom">
                    {/* Key Info Card */}
                    <div className="bg-brand-dark rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Sparkles size={64} />
                        </div>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-brand-gold text-xs font-bold uppercase tracking-wider mb-1">Current Status</p>
                                <div className="inline-flex items-center bg-white/10 px-3 py-1 rounded-full border border-white/20 backdrop-blur-sm">
                                    <span className="font-semibold">{selectedClient.status}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Loan Amount</p>
                                <p className="text-2xl font-bold font-mono">${(selectedClient.loanAmount / 1000000).toFixed(2)}M</p>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="grid grid-cols-2 gap-3 mt-4">
                             <select 
                                value={selectedClient.status}
                                onChange={(e) => updateClientStatus(selectedClient.id, e.target.value as any)}
                                className="bg-white/10 border border-white/20 text-white text-sm rounded-lg p-2 outline-none focus:ring-1 focus:ring-brand-gold cursor-pointer"
                             >
                                 <option className="text-gray-900" value="Lead">Lead</option>
                                 <option className="text-gray-900" value="Pre-Approval">Pre-Approval</option>
                                 <option className="text-gray-900" value="Underwriting">Underwriting</option>
                                 <option className="text-gray-900" value="Clear to Close">Clear to Close</option>
                                 <option className="text-gray-900" value="Closed">Closed</option>
                             </select>
                             <input 
                                type="date"
                                value={selectedClient.nextActionDate}
                                onChange={(e) => updateClientDate(selectedClient.id, e.target.value)}
                                className="bg-white/10 border border-white/20 text-white text-sm rounded-lg p-2 outline-none focus:ring-1 focus:ring-brand-gold"
                             />
                        </div>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Contact Details</h3>
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
                             <div className="flex items-center space-x-3">
                                 <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-gray-200 text-gray-500">
                                     <Mail size={16} />
                                 </div>
                                 <a href={`mailto:${selectedClient.email}`} className="text-sm font-medium text-brand-dark hover:underline hover:text-brand-red truncate block flex-1">
                                     {selectedClient.email}
                                 </a>
                             </div>
                             <div className="flex items-center space-x-3">
                                 <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-gray-200 text-gray-500">
                                     <Phone size={16} />
                                 </div>
                                 <a href={`tel:${selectedClient.phone}`} className="text-sm font-medium text-brand-dark hover:underline hover:text-brand-red">
                                     {selectedClient.phone}
                                 </a>
                             </div>
                             <div className="flex items-center space-x-3">
                                 <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-gray-200 text-gray-500">
                                     <MapPin size={16} />
                                 </div>
                                 <span className="text-sm font-medium text-gray-700 leading-tight">
                                     {selectedClient.propertyAddress}
                                 </span>
                             </div>
                        </div>
                    </div>

                    {/* Smart Notes */}
                    <div>
                         <div className="flex justify-between items-center mb-2">
                             <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Smart Notes</h3>
                             <button 
                                onClick={handleAiFollowUp}
                                disabled={isGeneratingFollowUp}
                                className="text-xs flex items-center bg-brand-light text-brand-red px-2 py-1 rounded-md font-medium hover:bg-red-50 transition-colors"
                             >
                                 {isGeneratingFollowUp ? <Loader2 size={12} className="animate-spin mr-1"/> : <Sparkles size={12} className="mr-1"/>}
                                 Draft Follow-Up
                             </button>
                         </div>
                         <textarea 
                            value={selectedClient.notes}
                            onChange={(e) => handleUpdateNotes(e.target.value)}
                            className="w-full h-32 p-3 bg-white border border-gray-200 rounded-xl text-sm leading-relaxed focus:ring-2 focus:ring-brand-red focus:border-brand-red outline-none resize-none shadow-sm"
                            placeholder="Add client context, preferences, or call notes..."
                         />
                    </div>

                    {/* Checklist */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Deal Checklist</h3>
                        <div className="space-y-2">
                            {selectedClient.checklist.map(item => (
                                <div key={item.id} className="flex items-center group">
                                    <button 
                                        onClick={() => toggleChecklist(selectedClient!.id, item.id)}
                                        className={`mr-3 transition-colors ${item.checked ? 'text-green-500' : 'text-gray-300 hover:text-gray-400'}`}
                                    >
                                        {item.checked ? <CheckSquare size={20} /> : <Square size={20} />}
                                    </button>
                                    <span className={`text-sm flex-1 ${item.checked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                        {item.label}
                                    </span>
                                    <button 
                                        className={`opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100 text-gray-400 ${item.reminderDate ? 'text-brand-gold opacity-100' : ''}`}
                                        title="Set Reminder"
                                        onClick={() => setChecklistReminder(selectedClient!.id, item.id, getFutureDate(3))}
                                    >
                                        <Bell size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Communication History */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                             <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">History</h3>
                             <button 
                                onClick={handleAnalyzeHistory}
                                disabled={analyzingHistory}
                                className="text-xs text-brand-dark hover:underline flex items-center"
                             >
                                 {analyzingHistory ? <Loader2 size={10} className="animate-spin mr-1"/> : <BrainCircuit size={10} className="mr-1"/>}
                                 Analyze Arc
                             </button>
                        </div>

                        {historyAnalysis && (
                             <div className="mb-4 p-3 bg-brand-light rounded-lg border border-brand-gold/20 animate-fade-in">
                                 <pre className="whitespace-pre-wrap font-sans text-xs text-gray-700 leading-relaxed">{historyAnalysis}</pre>
                             </div>
                        )}

                        <div className="space-y-4 border-l-2 border-gray-100 pl-4">
                            {selectedClient.emailHistory.length === 0 ? (
                                <p className="text-xs text-gray-400 italic">No emails logged yet.</p>
                            ) : (
                                selectedClient.emailHistory.slice().reverse().map((log) => (
                                    <div key={log.id} className="relative">
                                        <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-gray-200 border-2 border-white"></div>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">{new Date(log.date).toLocaleDateString()}</p>
                                        <h4 className="text-sm font-bold text-gray-800">{log.subject}</h4>
                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{log.body}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
      )}

      {/* Add Client Modal */}
      {isAddClientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full sm:max-w-lg h-[90vh] sm:h-auto rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0 safe-top">
                    <h3 className="text-lg font-bold text-gray-900">Add New Client</h3>
                    <button onClick={() => setIsAddClientModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto safe-bottom">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <input 
                            type="text" 
                            className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red outline-none"
                            placeholder="e.g. Dr. Stephen Strange"
                            value={newClientForm.name || ''}
                            onChange={e => setNewClientForm({...newClientForm, name: e.target.value})}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                             <label className="block text-sm font-medium text-gray-700 mb-1">Loan Amount</label>
                             <div className="relative">
                                 <span className="absolute left-3 top-3 text-gray-400">$</span>
                                 <input 
                                    type="number"
                                    inputMode="decimal"
                                    className="w-full pl-6 p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red outline-none"
                                    placeholder="2500000"
                                    value={newClientForm.loanAmount || ''}
                                    onChange={e => setNewClientForm({...newClientForm, loanAmount: parseFloat(e.target.value)})}
                                 />
                             </div>
                        </div>
                        <div>
                             <label className="block text-sm font-medium text-gray-700 mb-1">Target Close</label>
                             <input 
                                type="date"
                                className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red outline-none text-sm"
                                value={newClientForm.nextActionDate}
                                onChange={e => setNewClientForm({...newClientForm, nextActionDate: e.target.value})}
                             />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input 
                            type="email" 
                            className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red outline-none"
                            placeholder="client@example.com"
                            value={newClientForm.email || ''}
                            onChange={e => setNewClientForm({...newClientForm, email: e.target.value})}
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <input 
                            type="tel" 
                            className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red outline-none"
                            placeholder="(555) 123-4567"
                            value={newClientForm.phone || ''}
                            onChange={e => setNewClientForm({...newClientForm, phone: e.target.value})}
                        />
                    </div>
                    <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">Initial Notes</label>
                         <textarea 
                            className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red outline-none resize-none h-24"
                            placeholder="Source of wealth, property details, referral source..."
                            value={newClientForm.notes || ''}
                            onChange={e => setNewClientForm({...newClientForm, notes: e.target.value})}
                         />
                    </div>
                    <button 
                        onClick={handleCreateClient}
                        className="w-full bg-brand-dark text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-lg active:scale-[0.98]"
                    >
                        Create Profile
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Email Composer Modal */}
      {isEmailModalOpen && selectedClient && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
              <div className="bg-white w-full sm:max-w-2xl h-full sm:h-auto sm:rounded-2xl shadow-2xl flex flex-col sm:max-h-[90vh]">
                  {/* Header */}
                  <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white shrink-0 safe-top">
                      <div className="flex items-center space-x-2">
                        {/* Mobile Back/Close for Fullscreen */}
                         <button onClick={() => setIsEmailModalOpen(false)} className="sm:hidden p-2 -ml-2 text-gray-600">
                             <X size={24} />
                         </button>
                         <h3 className="text-lg font-bold text-gray-900">Compose Email</h3>
                      </div>
                      <div className="flex items-center space-x-2">
                          <select 
                             className="text-xs border border-gray-300 rounded p-1 max-w-[120px]"
                             onChange={(e) => handleApplyTemplate(e.target.value)}
                             value={selectedTemplateId}
                          >
                              <option value="">Select Template...</option>
                              {templates.map(t => (
                                  <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                          </select>
                          <button onClick={() => setIsEmailModalOpen(false)} className="hidden sm:block text-gray-400 hover:text-gray-600">
                             <X size={20} />
                          </button>
                      </div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      <div>
                          <input 
                             type="text" 
                             className="w-full text-lg font-bold placeholder-gray-400 outline-none border-b border-gray-100 pb-2 focus:border-brand-red transition-colors"
                             placeholder="Subject Line"
                             value={emailTopic}
                             onChange={e => setEmailTopic(e.target.value)}
                          />
                      </div>
                      <textarea 
                          className="w-full h-64 resize-none outline-none text-gray-700 leading-relaxed text-sm"
                          placeholder="Draft your email here..."
                          value={emailDraft}
                          onChange={e => setEmailDraft(e.target.value)}
                      />
                  </div>

                  {/* Actions */}
                  <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0 safe-bottom">
                      <div className="flex items-center space-x-2 w-full sm:w-auto">
                          <button 
                             onClick={handleGenerateDraft}
                             disabled={isDrafting}
                             className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
                          >
                             {isDrafting ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16} className="text-brand-gold"/>}
                             <span>AI Rewrite</span>
                          </button>
                           <button 
                             onClick={() => setIsSaveTemplateMode(!isSaveTemplateMode)}
                             className="flex items-center justify-center space-x-2 px-4 py-2 text-gray-500 hover:text-brand-dark text-sm font-medium transition-colors"
                          >
                             <Save size={16}/>
                             <span className="hidden sm:inline">Save Template</span>
                          </button>
                      </div>

                      {isSaveTemplateMode ? (
                          <div className="flex items-center space-x-2 w-full sm:w-auto animate-fade-in">
                              <input 
                                type="text" 
                                placeholder="Template Name" 
                                className="border border-gray-300 rounded px-2 py-1 text-sm flex-1"
                                value={newTemplateName}
                                onChange={e => setNewTemplateName(e.target.value)}
                              />
                              <button onClick={handleSaveTemplate} className="text-xs bg-brand-dark text-white px-3 py-1.5 rounded">Save</button>
                          </div>
                      ) : (
                          <button 
                             onClick={handleSendEmail}
                             className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-brand-red text-white px-6 py-2.5 rounded-lg font-bold hover:bg-red-700 transition-colors shadow-md"
                          >
                             <Send size={16} />
                             <span>Log Email</span>
                          </button>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};