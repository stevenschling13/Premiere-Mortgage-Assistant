
import React, { useState, useEffect } from 'react';
import { 
    Calendar as CalendarIcon, Clock, Plus, BrainCircuit, 
    Sparkles, Loader2, CheckCircle2, MoreHorizontal, Trash, 
    ChevronRight, ChevronLeft, MapPin, User, FileText, Link as LinkIcon,
    Edit, X, Save
} from 'lucide-react';
import { CalendarEvent, Client } from '../types';
import { loadFromStorage, saveToStorage, StorageKeys, generateDailySchedule, generateMeetingPrep } from '../services';
import { useToast } from './Toast';
import { MarkdownRenderer } from './MarkdownRenderer';

export const DailyPlanner: React.FC = () => {
    const { showToast } = useToast();
    const today = new Date().toISOString().split('T')[0];
    
    // Data State
    const [events, setEvents] = useState<CalendarEvent[]>(() => 
        loadFromStorage(StorageKeys.CALENDAR_EVENTS, [])
    );
    const [clients, setClients] = useState<Client[]>(() => loadFromStorage(StorageKeys.CLIENTS, []));

    // UI State
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [prepContent, setPrepContent] = useState<string | null>(null);
    const [isPrepping, setIsPrepping] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [naturalInput, setNaturalInput] = useState('');

    // Manual Event Management State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [eventFormData, setEventFormData] = useState<Partial<CalendarEvent>>({
        title: '',
        type: 'MEETING',
        start: '',
        end: '',
        notes: ''
    });

    useEffect(() => {
        saveToStorage(StorageKeys.CALENDAR_EVENTS, events);
    }, [events]);

    const formatForInput = (isoString?: string) => {
        if (!isoString) return '';
        // Handles "2023-10-25T14:30:00.000Z" -> "2023-10-25T14:30"
        return isoString.length > 16 ? isoString.slice(0, 16) : isoString;
    };

    const handleOptimizeSchedule = async () => {
        if (!naturalInput.trim()) {
            showToast("Tell the Chief of Staff what you need to do today.", "info");
            return;
        }
        setIsOptimizing(true);
        try {
            const newEvents = await generateDailySchedule(events, naturalInput, clients);
            setEvents(prev => [...prev, ...newEvents]);
            setNaturalInput('');
            
            // Check for matched clients and auto-update their last action date
            let syncedCount = 0;
            const updatedClients = [...clients];
            let hasUpdates = false;

            newEvents.forEach((evt: CalendarEvent) => {
                if (evt.clientId) {
                    const clientIdx = updatedClients.findIndex(c => c.id === evt.clientId);
                    if (clientIdx >= 0) {
                        updatedClients[clientIdx] = {
                            ...updatedClients[clientIdx],
                            nextActionDate: evt.start.split('T')[0],
                            checklist: [
                                ...updatedClients[clientIdx].checklist,
                                {
                                    id: `auto-${Date.now()}`,
                                    label: `Meeting: ${evt.title}`,
                                    checked: false,
                                    reminderDate: evt.start.split('T')[0]
                                }
                            ]
                        };
                        hasUpdates = true;
                        syncedCount++;
                    }
                }
            });

            if (hasUpdates) {
                setClients(updatedClients);
                saveToStorage(StorageKeys.CLIENTS, updatedClients);
                showToast(`Schedule created. Synced ${syncedCount} clients.`, "success");
            } else {
                showToast("Schedule updated by Chief of Staff", "success");
            }

        } catch (e) {
            console.error(e);
            showToast("Failed to optimize schedule", "error");
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleEventClick = async (event: CalendarEvent) => {
        setSelectedEvent(event);
        setPrepContent(null);
        
        // Auto-generate prep if it's a meeting linked to a client or has a recognizable name
        if ((event.type === 'MEETING' || event.type === 'CALL') && !event.notes?.includes("Meeting Brief")) {
            setIsPrepping(true);
            try {
                // Try to match client by ID or name
                const matchedClient = clients.find(c => 
                    (event.clientId && c.id === event.clientId) || 
                    event.title.toLowerCase().includes(c.name.toLowerCase())
                );
                
                const content = await generateMeetingPrep(event.title, matchedClient);
                setPrepContent(content ?? null);
            } catch (e) {
                console.error(e);
                setPrepContent("Unable to generate prep materials.");
            } finally {
                setIsPrepping(false);
            }
        } else if (event.notes) {
            // Use existing notes if available
            setPrepContent(event.notes);
        }
    };

    const handleDeleteEvent = (id: string) => {
        if(confirm("Delete this event?")) {
            setEvents(prev => prev.filter(e => e.id !== id));
            if (selectedEvent?.id === id) setSelectedEvent(null);
            showToast("Event deleted", "info");
        }
    };

    // Manual Event Handlers
    const openAddModal = () => {
        const now = new Date();
        const startStr = `${today}T${now.getHours().toString().padStart(2, '0')}:00`;
        const endStr = `${today}T${(now.getHours() + 1).toString().padStart(2, '0')}:00`;
        
        setEventFormData({
            id: undefined,
            title: '',
            type: 'MEETING',
            start: startStr,
            end: endStr,
            notes: ''
        });
        setIsModalOpen(true);
    };

    const openEditModal = (event: CalendarEvent) => {
        setEventFormData({ ...event });
        setIsModalOpen(true);
    };

    const handleSaveManualEvent = () => {
        if (!eventFormData.title || !eventFormData.start || !eventFormData.end) {
            showToast("Title and times are required", "error");
            return;
        }

        if (eventFormData.id) {
            // Edit
            const updatedEvent = eventFormData as CalendarEvent;
            setEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
            if (selectedEvent?.id === updatedEvent.id) setSelectedEvent(updatedEvent);
            showToast("Event updated", "success");
        } else {
            // Create
            const newEvent: CalendarEvent = {
                ...(eventFormData as CalendarEvent),
                id: Date.now().toString(),
                isAiGenerated: false
            };
            setEvents(prev => [...prev, newEvent]);
            showToast("Event added", "success");
        }
        setIsModalOpen(false);
    };

    // Render Time Slots (8 AM to 6 PM)
    const renderTimeSlots = () => {
        const slots = [];
        for (let i = 8; i <= 18; i++) {
            const timeLabel = i > 12 ? `${i - 12} PM` : i === 12 ? `12 PM` : `${i} AM`;
            // Filter events for this hour
            const hourEvents = events.filter(e => {
                const eventDate = new Date(e.start);
                return eventDate.getHours() === i && e.start.startsWith(today);
            });

            slots.push(
                <div key={i} className="flex border-b border-gray-100 min-h-[80px] group relative">
                    <div className="w-16 py-2 px-3 text-xs font-bold text-gray-400 border-r border-gray-100 shrink-0">
                        {timeLabel}
                    </div>
                    <div className="flex-1 relative p-1">
                        {/* Hover 'Add' Button - sets time automatically */}
                        <button 
                            onClick={() => {
                                const startT = `${today}T${i.toString().padStart(2,'0')}:00`;
                                const endT = `${today}T${(i+1).toString().padStart(2,'0')}:00`;
                                setEventFormData({ ...eventFormData, start: startT, end: endT });
                                setIsModalOpen(true);
                            }}
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-brand-dark transition-opacity" 
                            title="Add Event Here"
                        >
                            <Plus size={14}/>
                        </button>
                        
                        {hourEvents.map(event => (
                            <div 
                                key={event.id}
                                onClick={() => handleEventClick(event)}
                                className={`absolute inset-x-2 p-2 rounded-lg border text-xs cursor-pointer hover:brightness-95 transition-all shadow-sm flex items-center justify-between ${
                                    event.type === 'MEETING' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                                    event.type === 'CALL' ? 'bg-green-50 border-green-200 text-green-700' :
                                    event.type === 'BLOCK' ? 'bg-gray-100 border-gray-300 text-gray-600' :
                                    'bg-purple-50 border-purple-200 text-purple-700'
                                }`}
                                style={{
                                    top: `${(new Date(event.start).getMinutes() / 60) * 100}%`,
                                    height: '40px' 
                                }}
                            >
                                <div className="font-bold truncate flex items-center">
                                    {event.clientId && <LinkIcon size={10} className="mr-1 opacity-60"/>}
                                    {event.title}
                                </div>
                                {event.isAiGenerated && <Sparkles size={10} className="ml-1 opacity-50"/>}
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return slots;
    };

    return (
        <div className="flex h-full bg-white relative animate-fade-in">
            {/* Left Col: Calendar */}
            <div className="flex-1 flex flex-col border-r border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 safe-top">
                    <div>
                        <h2 className="text-xl font-bold text-brand-dark flex items-center">
                            <CalendarIcon className="mr-2 text-brand-gold" size={20}/> 
                            Daily Planner
                        </h2>
                        <p className="text-xs text-gray-500">{new Date().toLocaleDateString(undefined, {weekday: 'long', month: 'long', day: 'numeric'})}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button onClick={openAddModal} className="flex items-center space-x-2 bg-brand-dark text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-800 transition-colors">
                            <Plus size={14}/> <span>Add Event</span>
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {renderTimeSlots()}
                </div>
            </div>

            {/* Right Col: Chief of Staff Intelligence */}
            <div className="w-[400px] bg-brand-light flex flex-col border-l border-gray-200 shadow-xl z-10">
                <div className="p-5 bg-brand-dark text-white safe-top">
                    <div className="flex items-center space-x-3 mb-4">
                        <div className="p-2 bg-white/10 rounded-lg">
                            <BrainCircuit className="text-brand-gold" size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">Chief of Staff</h3>
                            <p className="text-xs text-gray-400">Schedule Optimization Agent</p>
                        </div>
                    </div>
                    
                    <div className="relative">
                        <input 
                            value={naturalInput}
                            onChange={(e) => setNaturalInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleOptimizeSchedule()}
                            placeholder='E.g. "Book call with Smith at 2pm"'
                            className="w-full pl-4 pr-12 py-3 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-gold outline-none"
                        />
                        <button 
                            onClick={handleOptimizeSchedule}
                            disabled={isOptimizing}
                            className="absolute right-2 top-2 p-1.5 bg-brand-gold text-brand-dark rounded-lg hover:bg-yellow-500 transition-colors disabled:opacity-50"
                        >
                            {isOptimizing ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>}
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {selectedEvent ? (
                        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden animate-slide-up">
                            <div className="p-4 border-b border-gray-100 flex justify-between items-start">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 block">Event Detail</span>
                                    <h3 className="font-bold text-lg text-gray-800">{selectedEvent.title}</h3>
                                    <div className="flex items-center text-xs text-gray-500 mt-1">
                                        <Clock size={12} className="mr-1"/> 
                                        {new Date(selectedEvent.start).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {new Date(selectedEvent.end).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                    </div>
                                    {selectedEvent.clientId && (
                                        <div className="mt-2 inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs border border-blue-100">
                                            <LinkIcon size={10} className="mr-1"/> Linked to Client Record
                                        </div>
                                    )}
                                </div>
                                <div className="flex space-x-1">
                                    <button onClick={() => openEditModal(selectedEvent)} className="p-2 text-gray-400 hover:text-brand-dark hover:bg-gray-100 rounded-lg transition-colors"><Edit size={16}/></button>
                                    <button onClick={() => handleDeleteEvent(selectedEvent.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash size={16}/></button>
                                </div>
                            </div>
                            
                            <div className="p-4 bg-gray-50">
                                {isPrepping ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-brand-dark opacity-60">
                                        <Loader2 size={24} className="animate-spin mb-2"/>
                                        <span className="text-xs font-medium">Generating Prep Sheet...</span>
                                    </div>
                                ) : prepContent ? (
                                    <div>
                                        <div className="flex items-center space-x-2 mb-3">
                                            <FileText size={14} className="text-brand-red"/>
                                            <span className="text-xs font-bold text-gray-700 uppercase">Meeting Brief</span>
                                        </div>
                                        <div className="prose prose-sm max-w-none text-xs">
                                            <MarkdownRenderer content={prepContent} />
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-500 italic text-center">No prep data available.</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-60">
                            <CalendarIcon size={48} className="mb-4 text-gray-300"/>
                            <p className="text-sm font-medium">Select an event</p>
                            <p className="text-xs mt-1 text-center max-w-[200px]">Click any calendar item to see AI prep notes or edit details.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Add/Edit Event Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg text-gray-900">{eventFormData.id ? 'Edit Event' : 'Add New Event'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} className="text-gray-500"/></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title</label>
                                <input 
                                    value={eventFormData.title} 
                                    onChange={e => setEventFormData({...eventFormData, title: e.target.value})} 
                                    placeholder="e.g. Call with Smith" 
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-gold" 
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Type</label>
                                    <select 
                                        value={eventFormData.type} 
                                        onChange={e => setEventFormData({...eventFormData, type: e.target.value as any})}
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none"
                                    >
                                        <option value="MEETING">Meeting</option>
                                        <option value="CALL">Call</option>
                                        <option value="TASK">Task</option>
                                        <option value="BLOCK">Block</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
                                    <div className="p-3 bg-gray-100 text-gray-500 rounded-lg text-sm">{eventFormData.start?.split('T')[0] || today}</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Start Time</label>
                                    <input 
                                        type="datetime-local" 
                                        value={formatForInput(eventFormData.start)} 
                                        onChange={e => setEventFormData({...eventFormData, start: e.target.value})} 
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">End Time</label>
                                    <input 
                                        type="datetime-local" 
                                        value={formatForInput(eventFormData.end)} 
                                        onChange={e => setEventFormData({...eventFormData, end: e.target.value})} 
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Notes</label>
                                <textarea 
                                    value={eventFormData.notes} 
                                    onChange={e => setEventFormData({...eventFormData, notes: e.target.value})} 
                                    placeholder="Add preparation notes..." 
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none h-24 resize-none" 
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-gray-500 font-medium hover:bg-gray-50 rounded-lg">Cancel</button>
                                <button onClick={handleSaveManualEvent} className="flex-1 py-3 bg-brand-dark text-white font-bold rounded-lg hover:bg-gray-800 shadow-lg">Save Event</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
