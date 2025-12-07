import React, { useState } from 'react';
import { 
    MapPin, Edit2, Trash2, Layers, Check, Mail, Phone, Calendar, 
    CheckSquare, Plus, X, Sparkles, Loader2, Send, Copy, ChevronRight 
} from 'lucide-react';
import { Client, DealStage, ChecklistItem } from '../types';
import { generateEmailDraft, generateSubjectLines } from '../services/geminiService';
import { useToast } from './Toast';

interface ClientDetailProps {
    client: Client;
    isEditing: boolean;
    setIsEditing: (val: boolean) => void;
    onUpdate: (client: Client) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
    dealStages: DealStage[];
    getStageColor: (status: string) => string;
}

export const ClientDetail: React.FC<ClientDetailProps> = ({
    client,
    isEditing,
    setIsEditing,
    onUpdate,
    onDelete,
    onClose,
    dealStages,
    getStageColor
}) => {
    const { showToast } = useToast();
    
    // AI State moved here to clean up Manager
    const [emailDraftTopic, setEmailDraftTopic] = useState('');
    const [isDrafting, setIsDrafting] = useState(false);
    const [currentDraft, setCurrentDraft] = useState('');
    const [suggestedSubjects, setSuggestedSubjects] = useState<string[]>([]);
    const [isGeneratingSubjects, setIsGeneratingSubjects] = useState(false);

    const currentStageIndex = dealStages.findIndex(s => s.name === client.status);

    const handleGenerateEmail = async () => {
        if (!emailDraftTopic) return;
        setIsDrafting(true);
        try {
            const draft = await generateEmailDraft(client, emailDraftTopic, 'Standard follow up');
            setCurrentDraft(draft || '');
        } catch (error) {
            showToast('Failed to generate email', 'error');
        } finally {
            setIsDrafting(false);
        }
    };

    const handleGenerateSubjects = async () => {
        if (!emailDraftTopic) return;
        setIsGeneratingSubjects(true);
        try {
            const subjects = await generateSubjectLines(client, emailDraftTopic);
            setSuggestedSubjects(subjects);
        } catch (error) {
            showToast('Failed to generate subjects', 'error');
        } finally {
            setIsGeneratingSubjects(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50/30">
            {/* Detail Header */}
            <div className="p-6 border-b border-gray-200 bg-white flex justify-between items-start sticky top-0 z-10 safe-top">
                <div className="flex items-start space-x-4">
                    <button onClick={onClose} className="md:hidden p-1 -ml-2 text-gray-500">
                        <ChevronRight className="rotate-180" />
                    </button>
                    <div>
                        {isEditing ? (
                            <input 
                                className="text-2xl font-bold text-gray-900 border-b border-brand-red outline-none bg-transparent"
                                value={client.name}
                                onChange={(e) => onUpdate({...client, name: e.target.value})}
                            />
                        ) : (
                            <h2 className="text-2xl font-bold text-brand-dark flex items-center">
                                {client.name}
                                <button onClick={() => setIsEditing(true)} className="ml-2 text-gray-400 hover:text-brand-red">
                                    <Edit2 size={16} />
                                </button>
                            </h2>
                        )}
                        <p className="text-sm text-gray-500 flex items-center mt-1">
                            <MapPin size={14} className="mr-1" />
                            {isEditing ? (
                                <input 
                                    className="border-b border-gray-300 outline-none bg-transparent"
                                    value={client.propertyAddress}
                                    onChange={(e) => onUpdate({...client, propertyAddress: e.target.value})}
                                    placeholder="Property Address"
                                />
                            ) : (
                                client.propertyAddress || 'No Address Listed'
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex items-center space-x-3">
                        <div className="text-right hidden sm:block">
                        <span className="block text-xs text-gray-400 uppercase">Loan Amount</span>
                        {isEditing ? (
                            <input 
                                type="number"
                                className="text-xl font-bold text-brand-dark text-right border-b border-gray-300 outline-none bg-transparent w-32"
                                value={client.loanAmount}
                                onChange={(e) => onUpdate({...client, loanAmount: parseFloat(e.target.value)})}
                            />
                        ) : (
                            <span className="text-xl font-bold text-brand-dark">${client.loanAmount.toLocaleString()}</span>
                        )}
                        </div>
                        <div className="h-10 w-px bg-gray-200 mx-2"></div>
                        <button onClick={() => onDelete(client.id)} className="text-gray-400 hover:text-red-500 transition-colors p-2">
                        <Trash2 size={20} />
                        </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
                
                {/* Deal Snapshot Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-gray-700 flex items-center">
                            <Layers size={18} className="mr-2" />
                            Deal Snapshot
                        </h3>
                        <div className="flex items-center space-x-2">
                            <label className="text-xs font-bold text-gray-400 uppercase">Current Stage:</label>
                            <select 
                                value={client.status}
                                onChange={(e) => onUpdate({...client, status: e.target.value})}
                                className="text-sm font-bold text-brand-dark bg-gray-100 border-none rounded-lg px-3 py-1 cursor-pointer focus:ring-2 focus:ring-brand-red outline-none"
                                style={{ color: getStageColor(client.status) }}
                            >
                                {dealStages.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                            </select>
                        </div>
                        </div>
                        
                        {/* Deal Progress Stepper */}
                        <div className="relative flex items-center justify-between w-full mb-8 px-2">
                        {/* Progress Bar Background */}
                        <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -z-10 rounded-full"></div>
                        {/* Active Progress Bar */}
                        <div 
                            className="absolute top-1/2 left-0 h-1 bg-brand-red -z-10 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${(currentStageIndex / (dealStages.length - 1)) * 100}%` }}
                        ></div>

                        {dealStages.map((stage, idx) => {
                            const isCompleted = idx <= currentStageIndex;
                            const isActive = idx === currentStageIndex;
                            
                            return (
                                <div 
                                    key={stage.name} 
                                    className="flex flex-col items-center cursor-pointer group"
                                    onClick={() => onUpdate({...client, status: stage.name})}
                                >
                                    <div 
                                        className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 z-10 bg-white ${
                                            isActive 
                                                ? 'border-brand-red shadow-[0_0_0_4px_rgba(205,19,55,0.2)] scale-110' 
                                                : isCompleted 
                                                    ? 'border-brand-red bg-brand-red text-white' 
                                                    : 'border-gray-300 text-gray-300'
                                        }`}
                                    >
                                        {isCompleted ? <Check size={14} strokeWidth={3} /> : <div className="w-2 h-2 rounded-full bg-gray-300"></div>}
                                    </div>
                                    <span 
                                        className={`mt-2 text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 absolute translate-y-8 whitespace-nowrap ${
                                            isActive ? 'text-brand-dark scale-110' : isCompleted ? 'text-brand-red' : 'text-gray-400'
                                        }`}
                                    >
                                        {stage.name}
                                    </span>
                                </div>
                            );
                        })}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Contact Email</label>
                            {isEditing ? (
                                <input 
                                    className="w-full p-2 bg-gray-50 rounded border border-gray-200 text-gray-900"
                                    value={client.email}
                                    onChange={(e) => onUpdate({...client, email: e.target.value})}
                                />
                            ) : (
                                <div className="flex items-center text-gray-700">
                                    <Mail size={14} className="mr-2 text-gray-400" />
                                    {client.email || '-'}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Phone</label>
                            {isEditing ? (
                                <input 
                                    className="w-full p-2 bg-gray-50 rounded border border-gray-200 text-gray-900"
                                    value={client.phone}
                                    onChange={(e) => onUpdate({...client, phone: e.target.value})}
                                />
                            ) : (
                                <div className="flex items-center text-gray-700">
                                    <Phone size={14} className="mr-2 text-gray-400" />
                                    {client.phone || '-'}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Next Action</label>
                            {isEditing ? (
                                <input 
                                    type="date"
                                    className="w-full p-2 bg-gray-50 rounded border border-gray-200 text-gray-900"
                                    value={client.nextActionDate}
                                    onChange={(e) => onUpdate({...client, nextActionDate: e.target.value})}
                                />
                            ) : (
                                <div className={`flex items-center font-medium ${
                                    new Date(client.nextActionDate) < new Date() ? 'text-red-600' : 'text-gray-700'
                                }`}>
                                    <Calendar size={14} className="mr-2 opacity-50" />
                                    {new Date(client.nextActionDate).toLocaleDateString()}
                                </div>
                            )}
                        </div>
                        </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Col: Tasks & Notes */}
                    <div className="space-y-6">
                        {/* Tasks */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <h3 className="font-bold text-gray-700 mb-4 flex items-center">
                                <CheckSquare size={18} className="mr-2" />
                                Task Checklist
                            </h3>
                            <div className="space-y-3 mb-4">
                                {client.checklist.map(item => (
                                    <div key={item.id} className="flex items-start group">
                                        <input 
                                            type="checkbox"
                                            checked={item.checked}
                                            onChange={(e) => {
                                                const newChecklist = client.checklist.map(i => 
                                                    i.id === item.id ? { ...i, checked: e.target.checked } : i
                                                );
                                                onUpdate({...client, checklist: newChecklist});
                                            }}
                                            className="mt-1 mr-3 rounded text-brand-red focus:ring-brand-red border-gray-300"
                                        />
                                        <span className={`text-sm ${item.checked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                            {item.label}
                                        </span>
                                        <button 
                                            onClick={() => {
                                                onUpdate({
                                                    ...client, 
                                                    checklist: client.checklist.filter(i => i.id !== item.id)
                                                })
                                            }}
                                            className="ml-auto text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={14}/>
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center mt-2">
                                <Plus size={16} className="text-gray-400 mr-2" />
                                <input 
                                    placeholder="Add a task..."
                                    className="flex-1 bg-transparent text-sm outline-none text-gray-900"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const val = (e.target as HTMLInputElement).value;
                                            if (val.trim()) {
                                                const newItem: ChecklistItem = {
                                                    id: Date.now().toString(),
                                                    label: val,
                                                    checked: false
                                                };
                                                onUpdate({...client, checklist: [...client.checklist, newItem]});
                                                (e.target as HTMLInputElement).value = '';
                                            }
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <h3 className="font-bold text-gray-700 mb-4 flex items-center">
                                <Edit2 size={18} className="mr-2" />
                                Client Notes
                            </h3>
                            <textarea 
                                className="w-full h-32 p-3 bg-gray-50 rounded-lg text-sm border border-gray-200 outline-none focus:border-brand-red resize-none text-gray-900 leading-relaxed"
                                value={client.notes}
                                onChange={(e) => onUpdate({...client, notes: e.target.value})}
                                placeholder="Add private client notes here..."
                            />
                        </div>
                    </div>

                    {/* Right Col: AI Concierge */}
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-brand-gold/30 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-gold opacity-10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                        <div className="relative z-10">
                            <div className="flex items-center space-x-2 mb-6">
                                <Sparkles className="text-brand-red" size={20} />
                                <h3 className="font-bold text-brand-dark text-lg">AI Concierge</h3>
                            </div>
                            
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Draft Email</label>
                                    <div className="flex space-x-2 mb-2">
                                        <input 
                                            value={emailDraftTopic}
                                            onChange={(e) => setEmailDraftTopic(e.target.value)}
                                            placeholder="E.g., Rate lock update, Missing docs..."
                                            className="flex-1 p-2 bg-gray-50 border border-gray-300 rounded-lg text-sm outline-none focus:border-brand-red text-gray-900"
                                        />
                                        <button 
                                            onClick={handleGenerateEmail}
                                            disabled={isDrafting || !emailDraftTopic}
                                            className="bg-brand-dark text-white p-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
                                        >
                                            {isDrafting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                                        </button>
                                    </div>
                                    
                                    {/* Subject Line Suggester */}
                                    {emailDraftTopic && (
                                        <div className="mb-4">
                                            <button 
                                                onClick={handleGenerateSubjects}
                                                disabled={isGeneratingSubjects}
                                                className="text-xs text-brand-red font-bold hover:underline flex items-center mb-2"
                                            >
                                                {isGeneratingSubjects ? <Loader2 size={10} className="animate-spin mr-1"/> : <Sparkles size={10} className="mr-1"/>}
                                                Suggest Subject Lines
                                            </button>
                                            
                                            {suggestedSubjects.length > 0 && (
                                                <div className="flex flex-wrap gap-2 animate-fade-in">
                                                    {suggestedSubjects.map((subject, idx) => (
                                                        <button
                                                            key={idx}
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(subject);
                                                                showToast('Subject copied', 'info');
                                                            }}
                                                            className="text-[10px] bg-yellow-50 text-yellow-800 border border-yellow-200 px-2 py-1 rounded-full hover:bg-yellow-100 flex items-center transition-colors"
                                                        >
                                                            {subject} <Copy size={8} className="ml-1 opacity-50"/>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {currentDraft && (
                                        <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-700 relative group animate-fade-in">
                                            <p className="whitespace-pre-wrap">{currentDraft}</p>
                                            <button 
                                                onClick={() => {
                                                    navigator.clipboard.writeText(currentDraft);
                                                    showToast('Draft copied to clipboard', 'info');
                                                }}
                                                className="absolute top-2 right-2 p-1.5 bg-white shadow-sm rounded border border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity hover:text-brand-red"
                                            >
                                                <Copy size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};