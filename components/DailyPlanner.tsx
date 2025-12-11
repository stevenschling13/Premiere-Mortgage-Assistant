import React, { useState, useEffect, memo, useCallback } from 'react';
import CalendarIcon from 'lucide-react/dist/esm/icons/calendar';
import Clock from 'lucide-react/dist/esm/icons/clock';
import Plus from 'lucide-react/dist/esm/icons/plus';
import BrainCircuit from 'lucide-react/dist/esm/icons/brain-circuit';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left';
import LinkIcon from 'lucide-react/dist/esm/icons/link';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import { CalendarEvent, Client } from '../types';
import { loadFromStorage, saveToStorage, StorageKeys } from '../services/storageService';
import { useToast } from './Toast';
import { MarkdownRenderer } from './MarkdownRenderer';

const loadScheduleService = () => import('../services/gemini/scheduleService');

// --- SUB-COMPONENT: Time Slot Row (Memoized) ---
const TimeSlotRow = memo(({ 
    hour, 
    events, 
    today, 
    onEventClick 
}: { 
    hour: number, 
    events: CalendarEvent[], 
    today: string, 
    onEventClick: (e: CalendarEvent) => void 
}) => {
    const timeLabel = hour > 12 ? `${hour - 12} PM` : hour === 12 ? `12 PM` : `${hour} AM`;
    const hourEvents = events.filter(e => {
        const eventDate = new Date(e.start);
        return eventDate.getHours() === hour && e.start.startsWith(today);
    });

    return (
        <div className="flex border-b border-gray-100 min-h-[80px] group relative">
            <div className="w-16 py-2 px-3 text-xs font-bold text-gray-400 border-r border-gray-100 shrink-0">
                {timeLabel}
            </div>
            <div className="flex-1 relative p-1">
                {/* Hover 'Add' Button */}
                <button className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-brand-dark transition-opacity" title="Add Event">
                    <Plus size={14}/>
                </button>
                
                {hourEvents.map(event => (
                    <div 
                        key={event.id}
                        onClick={() => onEventClick(event)}
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
});

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

    useEffect(() => {
        saveToStorage(StorageKeys.CALENDAR_EVENTS, events);
    }, [events]);

    const handleOptimizeSchedule = useCallback(async () => {
        if (!naturalInput.trim()) {
            showToast("Tell the Chief of Staff what you need to do today.", "info");
            return;
        }
        setIsOptimizing(true);
        try {
            const { generateDailySchedule } = await loadScheduleService();
            const newEvents = await generateDailySchedule(events, naturalInput, clients);
            setEvents(prev => [...prev, ...newEvents]);
            setNaturalInput('');
            
            // Sync logic
            let syncedCount = 0;
            const updatedClients = [...clients];
            let hasUpdates = false;

            newEvents.forEach(evt => {
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
    }, [naturalInput, events, clients, showToast]);

    const handleEventClick = useCallback(async (event: CalendarEvent) => {
        setSelectedEvent(event);
        setPrepContent(null);
        
        if (event.type === 'MEETING' || event.type === 'CALL') {
            setIsPrepping(true);
            try {
                const matchedClient = clients.find(c =>
                    (event.clientId && c.id === event.clientId) ||
                    event.title.toLowerCase().includes(c.name.toLowerCase())
                );
                const { generateMeetingPrep } = await loadScheduleService();
                const content = await generateMeetingPrep(event.title, matchedClient);
                setPrepContent(content);
            } catch (e) {
                console.error(e);
                setPrepContent("Unable to generate prep materials.");
            } finally {
                setIsPrepping(false);
            }
        }
    }, [clients]);

    const handleDeleteEvent = useCallback((id: string) => {
        setEvents(prev => prev.filter(e => e.id !== id));
        if (selectedEvent?.id === id) setSelectedEvent(null);
    }, [selectedEvent]);

    const timeSlots = Array.from({ length: 11 }, (_, i) => i + 8); // 8 to 18

    return (
        <div className="flex flex-col md:flex-row h-full bg-white relative animate-fade-in overflow-hidden">
            {/* Left Col: Calendar */}
            <div className="flex-1 flex flex-col border-r border-gray-200 overflow-hidden order-2 md:order-1">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 md:safe-top">
                    <div>
                        <h2 className="text-xl font-bold text-brand-dark flex items-center">
                            <CalendarIcon className="mr-2 text-brand-gold" size={20}/> 
                            Daily Planner
                        </h2>
                        <p className="text-xs text-gray-500">{new Date().toLocaleDateString(undefined, {weekday: 'long', month: 'long', day: 'numeric'})}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button onClick={() => {}} className="p-2 hover:bg-white rounded-full transition-colors text-gray-500"><ChevronLeft size={20}/></button>
                        <button onClick={() => {}} className="p-2 hover:bg-white rounded-full transition-colors text-gray-500"><ChevronRight size={20}/></button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {timeSlots.map(hour => (
                        <TimeSlotRow 
                            key={hour} 
                            hour={hour} 
                            events={events} 
                            today={today} 
                            onEventClick={handleEventClick} 
                        />
                    ))}
                </div>
            </div>

            {/* Right Col: Chief of Staff Intelligence */}
            <div className="w-full md:w-[400px] bg-brand-light flex flex-col border-l border-gray-200 shadow-xl z-10 order-1 md:order-2 shrink-0 h-[40%] md:h-full overflow-hidden">
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
                                <button onClick={() => handleDeleteEvent(selectedEvent.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
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
                            <p className="text-xs mt-1 text-center max-w-[200px]">Click any calendar item to see AI prep notes.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};