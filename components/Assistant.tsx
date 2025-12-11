import React, { useState, useRef, useEffect, useTransition, memo, useCallback } from 'react';
import { Send, Bot, User as UserIcon, Loader2, ExternalLink, Mic, Trash2, ShieldCheck, AlertTriangle, Swords, XCircle, Globe, Radar } from 'lucide-react';
import { ChatMessage, SimulationScenario, Client } from '../types';
import { streamChatWithAssistant, verifyFactualClaims, parseNaturalLanguageCommand, fetchDailyMarketPulse, scanPipelineOpportunities } from '../services/geminiService';
import { loadFromStorage, saveToStorage, StorageKeys } from '../services/storageService';
import { SIMULATION_SCENARIOS, SUGGESTED_PROMPTS, DEFAULT_DEAL_STAGES } from '../constants';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useToast } from './Toast';

// ... (MessageBubble and MessageList components remain same)

// --- SUB-COMPONENT: Message Bubble (Memoized) ---
const MessageBubble = memo(({ 
    msg, 
    isSimulationMode, 
    verifyingMsgIds, 
    onVerify 
}: { 
    msg: ChatMessage, 
    isSimulationMode: boolean, 
    verifyingMsgIds: Set<string>, 
    onVerify: (id: string, text: string) => void 
}) => {
    return (
        <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
            <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 shadow-sm relative ${
                msg.role === 'user' 
                  ? 'bg-brand-dark text-white rounded-tr-none' 
                  : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
            }`}>
                <div className="flex items-center space-x-2 mb-1 opacity-50 text-[10px] uppercase font-bold tracking-wider">
                    {msg.role === 'user' ? <UserIcon size={10} /> : <Bot size={10} />}
                    <span>{msg.role === 'user' ? 'You' : (isSimulationMode ? 'Trainer' : 'Assistant')}</span>
                    <span>•</span>
                    <span>{msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                
                <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert' : ''}`}>
                    <MarkdownRenderer content={msg.text} />
                </div>

                {/* AI Verification & Links */}
                {msg.role === 'model' && (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                        {/* Citations from Grounding */}
                        {msg.groundingLinks && msg.groundingLinks.length > 0 && (
                            <div className="w-full flex flex-wrap gap-2 mb-2">
                                {msg.groundingLinks.map((link, i) => (
                                    <a 
                                      key={i} 
                                      href={link.uri} 
                                      target="_blank" 
                                      rel="noreferrer"
                                      className="flex items-center text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100 border border-blue-100 transition-colors"
                                    >
                                        <ExternalLink size={10} className="mr-1"/> {link.title}
                                    </a>
                                ))}
                            </div>
                        )}

                        {/* Manual Verify Button */}
                        {!msg.verificationResult && !isSimulationMode && msg.text.length > 50 && (
                            <button 
                                onClick={() => onVerify(msg.id, msg.text)}
                                disabled={verifyingMsgIds.has(msg.id)}
                                className="flex items-center text-[10px] bg-gray-50 hover:bg-gray-100 text-gray-500 px-2 py-1 rounded border border-gray-200 transition-colors disabled:opacity-50"
                            >
                                {verifyingMsgIds.has(msg.id) ? <Loader2 size={10} className="animate-spin mr-1"/> : <ShieldCheck size={10} className="mr-1"/>}
                                Verify Facts
                            </button>
                        )}

                        {/* Verification Result Display */}
                        {msg.verificationResult && (
                            <div className={`w-full text-xs p-2 rounded border flex items-start ${
                                msg.verificationResult.status === 'VERIFIED' ? 'bg-green-50 border-green-200 text-green-800' :
                                'bg-red-50 border-red-200 text-red-800'
                            }`}>
                                {msg.verificationResult.status === 'VERIFIED' ? <ShieldCheck size={14} className="mr-2 mt-0.5"/> : <AlertTriangle size={14} className="mr-2 mt-0.5"/>}
                                <div>
                                    <div className="font-bold">{msg.verificationResult.status === 'VERIFIED' ? 'Verified Accurate' : 'Potential Inaccuracies'}</div>
                                    <div className="opacity-80 mt-1">{msg.verificationResult.text}</div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});

// --- SUB-COMPONENT: Message List (Memoized) ---
const MessageList = memo(({ 
    messages, 
    isLoading, 
    isSimulationMode, 
    verifyingMsgIds, 
    onVerify 
}: {
    messages: ChatMessage[],
    isLoading: boolean,
    isSimulationMode: boolean,
    verifyingMsgIds: Set<string>,
    onVerify: (id: string, text: string) => void
}) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length, isLoading, messages[messages.length-1]?.text]);

    return (
        <div className={`flex-1 overflow-y-auto p-4 space-y-6 ${isSimulationMode ? 'bg-indigo-50/30' : ''}`}>
          {messages.map((msg) => (
              <MessageBubble 
                  key={msg.id} 
                  msg={msg} 
                  isSimulationMode={isSimulationMode}
                  verifyingMsgIds={verifyingMsgIds}
                  onVerify={onVerify}
              />
          ))}
          
          {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex items-center space-x-2 text-gray-400 text-xs animate-pulse">
                  <Bot size={14} />
                  <span>Thinking...</span>
              </div>
          )}
          <div ref={messagesEndRef} />
      </div>
    );
});

// --- SUB-COMPONENT: Chat Input (Memoized) ---
const ChatInput = memo(({ 
    onSend, 
    isLoading, 
    isSimulationMode, 
    suggestions 
}: { 
    onSend: (text: string) => void, 
    isLoading: boolean, 
    isSimulationMode: boolean,
    suggestions: string[]
}) => {
    const [input, setInput] = useState('');
    const { showToast } = useToast();

    const handleSend = () => {
        if (!input.trim() || isLoading) return;
        onSend(input);
        setInput('');
    };

    return (
        <div className="p-4 bg-white border-t border-gray-200 shrink-0">
          {!input && suggestions.length > 0 && !isSimulationMode && (
              <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
                  {suggestions.map((p, i) => (
                      <button 
                        key={i} 
                        onClick={() => onSend(p)}
                        className="whitespace-nowrap px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full text-xs text-gray-600 transition-colors"
                      >
                          {p}
                      </button>
                  ))}
              </div>
          )}

          <div className="relative flex items-end gap-2">
              <div className="relative flex-1">
                  <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSend();
                          }
                      }}
                      placeholder={isSimulationMode ? "Reply to the client..." : "Ask me anything about loans, markets, or guidelines..."}
                      className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-gold focus:bg-white transition-all resize-none text-sm max-h-32 min-h-[50px]"
                      rows={1}
                  />
                  <button 
                    className="absolute right-2 bottom-2 p-2 text-gray-400 hover:text-brand-dark rounded-full transition-colors"
                    onClick={() => showToast("Voice input is managed in Client Detail view.", "info")}
                  >
                      <Mic size={18}/>
                  </button>
              </div>
              <button 
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className={`p-3 rounded-xl transition-all shadow-md ${
                      !input.trim() || isLoading 
                        ? 'bg-gray-200 text-gray-400' 
                        : 'bg-brand-dark text-white hover:bg-gray-800 hover:scale-105'
                  }`}
              >
                  {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              </button>
          </div>
          <div className="text-[10px] text-center text-gray-400 mt-2">
              Gemini can make mistakes. Check important info.
          </div>
      </div>
    );
});

export const Assistant: React.FC = () => {
  const { showToast } = useToast();
  // Load State from storage to give Assistant context
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = loadFromStorage<any[]>(StorageKeys.CHAT_HISTORY, []);
    if (Array.isArray(saved) && saved.length > 0) {
        return saved.map(m => ({
            ...m,
            timestamp: new Date(m.timestamp)
        }));
    }
    return [{
      id: '1',
      role: 'model',
      text: 'Good morning. I am your Premiere Mortgage Assistant. I can check real-time market data, analyze loan scenarios, or draft client communications for you.',
      timestamp: new Date()
    }];
  });

  const [clients, setClients] = useState<Client[]>(() => loadFromStorage(StorageKeys.CLIENTS, []));

  const [isLoading, setIsLoading] = useState(false);
  const [verifyingMsgIds, setVerifyingMsgIds] = useState<Set<string>>(new Set());
  
  // Concurrency: Use transition for input submission updates
  const [isPending, startTransition] = useTransition();

  // Simulation Mode State
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<SimulationScenario | null>(null);
  const [simulationMessages, setSimulationMessages] = useState<ChatMessage[]>([]);
  
  // Ref for accessing latest messages in closure-less async handler
  const messagesRef = useRef(messages);
  const simulationMessagesRef = useRef(simulationMessages);
  
  useEffect(() => {
      messagesRef.current = messages;
  }, [messages]);
  
  useEffect(() => {
      simulationMessagesRef.current = simulationMessages;
  }, [simulationMessages]);
  
  // Unmount safety ref
  const isMountedRef = useRef(true);

  useEffect(() => {
     isMountedRef.current = true;
     return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
     if (!isSimulationMode) {
         saveToStorage(StorageKeys.CHAT_HISTORY, messages);
     }
  }, [messages, isSimulationMode]);

  const handleClearHistory = () => {
      if (isSimulationMode) {
          if (confirm("End simulation session?")) {
              exitSimulation();
          }
      } else {
          const resetMsg: ChatMessage[] = [{
            id: Date.now().toString(),
            role: 'model',
            text: 'History cleared. Ready for new queries.',
            timestamp: new Date()
          }];
          setMessages(resetMsg);
          saveToStorage(StorageKeys.CHAT_HISTORY, resetMsg);
      }
  };

  const startSimulation = (scenario: SimulationScenario) => {
      setIsSimulationMode(true);
      setSelectedScenario(scenario);
      setSimulationMessages([{
          id: 'sim-1',
          role: 'model',
          text: `**SIMULATION STARTED: ${scenario.title}**\n\n${scenario.description}\n\nI am ready. State your case.`,
          timestamp: new Date()
      }]);
  };

  const exitSimulation = () => {
      setIsSimulationMode(false);
      setSelectedScenario(null);
      setSimulationMessages([]);
  };

  const handleVerifyMessage = useCallback(async (msgId: string, text: string) => {
      setVerifyingMsgIds(prev => new Set(prev).add(msgId));
      try {
          const result = await verifyFactualClaims(text);
          setMessages(prev => prev.map(m => 
              m.id === msgId ? { ...m, verificationResult: result } : m
          ));
      } catch (e) {
          console.error(e);
      } finally {
          setVerifyingMsgIds(prev => {
              const next = new Set(prev);
              next.delete(msgId);
              return next;
          });
      }
  }, []);

  // --- AUTO-TOOL EXECUTION: PIPELINE SCAN ---
  const executePipelineScan = async (promptId: string) => {
      if (!isMountedRef.current) return;
      
      const systemMsgId = `sys-${Date.now()}`;
      setMessages(prev => [...prev, {
          id: systemMsgId,
          role: 'model',
          text: `**[SYSTEM]** Scanning pipeline against live market data...`,
          timestamp: new Date()
      }]);

      try {
          const marketData = await fetchDailyMarketPulse();
          const opportunities = await scanPipelineOpportunities(clients, marketData.indices);
          
          // Inject findings as system context for the final answer
          const report = `**SCAN RESULTS:**\nFound ${opportunities.length} urgent opportunities.\n${opportunities.map(o => `- **${o.clientName}**: ${o.trigger} (${o.action}) [Priority: ${o.priority}]`).join('\n')}`;
          
          if (isMountedRef.current) {
              setMessages(prev => prev.filter(m => m.id !== systemMsgId)); // Remove loading msg
              
              // Proceed with standard generation, but now with the report in history
              const contextHistory = [
                  ...messagesRef.current,
                  { role: 'user', text: "Scan pipeline." }, // Ensure user intent is clear
                  { role: 'model', text: report }
              ];
              
              const stream = streamChatWithAssistant(
                  contextHistory.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
                  "Summarize these findings and suggest next steps.",
                  undefined
              );

              // Standard stream handling from here...
              let textBuffer = "";
              const aiMsgId = (Date.now() + 1).toString();
              setMessages(prev => [...prev, { id: aiMsgId, role: 'model', text: '', timestamp: new Date() }]);
              
              for await (const chunk of stream) {
                  if (chunk.text) textBuffer += chunk.text;
                  setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: textBuffer } : m));
              }
          }

      } catch (e) {
          console.error(e);
          setMessages(prev => prev.filter(m => m.id !== systemMsgId));
          showToast("Failed to execute pipeline scan", "error");
      } finally {
          setIsLoading(false);
      }
  };

  // --- OPTIMIZED STREAMING CHAT HANDLER ---
  const handleSendMessage = useCallback(async (textToSend: string) => {
    if (!textToSend.trim()) return;

    startTransition(() => {
        const userMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'user',
          text: textToSend,
          timestamp: new Date()
        };
        
        if (isSimulationMode) {
            setSimulationMessages(prev => [...prev, userMsg]);
        } else {
            setMessages(prev => [...prev, userMsg]);
        }
        setIsLoading(true);
    });

    // 1. Check for Command Intents FIRST (Middleware)
    if (!isSimulationMode) {
        try {
            const command = await parseNaturalLanguageCommand(textToSend, DEFAULT_DEAL_STAGES.map(s => s.name));
            if (command.action === 'SCAN_PIPELINE') {
                await executePipelineScan(textToSend);
                return; // Stop standard chat flow, the tool took over
            }
        } catch (e) {
            // Ignore parsing errors, fall back to chat
        }
    }

    // 2. Standard Chat Flow
    const aiMsgId = (Date.now() + 1).toString();
    const aiMsgPlaceholder: ChatMessage = {
        id: aiMsgId,
        role: 'model',
        text: '',
        timestamp: new Date()
    };

    if (isSimulationMode) {
        setSimulationMessages(prev => [...prev, aiMsgPlaceholder]);
    } else {
        setMessages(prev => [...prev, aiMsgPlaceholder]);
    }

    let textBuffer = "";
    let linksBuffer: any[] = [];
    let streamActive = true;
    let rafId: number;

    const renderLoop = () => {
         if (!streamActive || !isMountedRef.current) return;
         
         const updateFn = (prev: ChatMessage[]) => {
             const last = prev[prev.length - 1];
             if (last && last.id === aiMsgId && (last.text !== textBuffer || last.groundingLinks?.length !== linksBuffer.length)) {
                 return prev.map(m => m.id === aiMsgId ? { 
                     ...m, 
                     text: textBuffer,
                     groundingLinks: linksBuffer.length > 0 ? linksBuffer : m.groundingLinks
                 } : m);
             }
             return prev;
         };

         if (isSimulationMode) {
             setSimulationMessages(updateFn);
         } else {
             setMessages(updateFn);
         }
         
         rafId = requestAnimationFrame(renderLoop);
    };
    rafId = requestAnimationFrame(renderLoop);

    try {
        const currentHistory = isSimulationMode ? simulationMessagesRef.current : messagesRef.current;
        const apiHistory = currentHistory.map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
        }));

        const systemInstruction = isSimulationMode && selectedScenario 
            ? selectedScenario.systemInstruction 
            : undefined;

        const stream = streamChatWithAssistant(apiHistory, textToSend, systemInstruction);
        
        for await (const chunk of stream) {
            if (chunk.text) {
                textBuffer += chunk.text;
            }
            
            const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (groundingChunks) {
                const links = groundingChunks
                    .map((c: any) => c.web ? { uri: c.web.uri, title: c.web.title } : null)
                    .filter((l: any) => l !== null);
                if (links.length > 0) {
                    linksBuffer = links;
                }
            }
        }

    } catch (error) {
        textBuffer += "\n\n**[Connection Error: The Assistant was interrupted.]**";
        console.error(error);
    } finally {
        streamActive = false;
        if (rafId) cancelAnimationFrame(rafId);
        
        if (isMountedRef.current) {
            setIsLoading(false);
            
            const finalUpdate = (prev: ChatMessage[]) => prev.map(m => m.id === aiMsgId ? { 
                ...m, 
                text: textBuffer,
                groundingLinks: linksBuffer
            } : m);

            if (isSimulationMode) {
                setSimulationMessages(finalUpdate);
            } else {
                setMessages(finalUpdate);
            }
        }
    }
  }, [isSimulationMode, selectedScenario, clients]); // Add clients dependency

  const activeMessages = isSimulationMode ? simulationMessages : messages;

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      {/* Header */}
      <div className={`p-4 border-b shrink-0 flex items-center justify-between safe-top transition-colors duration-300 ${isSimulationMode ? 'bg-indigo-900 text-white' : 'bg-white border-gray-200 text-gray-800'}`}>
         <div className="flex items-center space-x-3">
             <div className={`p-2 rounded-lg ${isSimulationMode ? 'bg-indigo-700' : 'bg-brand-red text-white'}`}>
                 {isSimulationMode ? <Swords size={20} /> : <Bot size={20} />}
             </div>
             <div>
                 <h2 className="font-bold text-lg leading-tight">
                     {isSimulationMode ? `Simulation: ${selectedScenario?.title}` : 'Virtual Analyst'}
                 </h2>
                 <div className="flex items-center gap-2">
                    <p className={`text-xs ${isSimulationMode ? 'text-indigo-200' : 'text-gray-500'}`}>
                        {isSimulationMode ? 'Roleplay & Training Mode' : 'Gemini 3 Pro • Reasoning Engine'}
                    </p>
                    {!isSimulationMode && (
                        <span className="flex items-center text-[10px] text-brand-gold bg-brand-gold/10 px-1.5 py-0.5 rounded border border-brand-gold/20">
                            <Globe size={10} className="mr-1"/> Search On
                        </span>
                    )}
                 </div>
             </div>
         </div>
         <div className="flex items-center gap-2">
            {isSimulationMode && (
                <button 
                    onClick={exitSimulation}
                    className="flex items-center px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-bold transition-colors"
                >
                    <XCircle size={14} className="mr-1"/> End Sim
                </button>
            )}
            <button 
                onClick={handleClearHistory}
                className={`p-2 rounded-full hover:bg-opacity-20 transition-colors ${isSimulationMode ? 'hover:bg-indigo-400 text-indigo-200' : 'hover:bg-gray-100 text-gray-400'}`}
                title="Clear History"
            >
                <Trash2 size={18} />
            </button>
         </div>
      </div>

      {/* Mode Selection */}
      {!isSimulationMode && messages.length <= 1 && (
          <div className="p-4 bg-white border-b border-gray-100">
             <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Training Simulations</h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                 {SIMULATION_SCENARIOS.map(scen => (
                     <button 
                        key={scen.id}
                        onClick={() => startSimulation(scen)}
                        className="text-left p-3 rounded-xl border border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all group relative overflow-hidden"
                     >
                         <div className="flex justify-between items-start mb-1">
                             <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                 scen.difficulty === 'ROOKIE' ? 'bg-green-100 text-green-700' : 
                                 scen.difficulty === 'VETERAN' ? 'bg-orange-100 text-orange-700' : 
                                 'bg-red-100 text-red-700'
                             }`}>{scen.difficulty}</div>
                             <Swords size={14} className="text-indigo-300 group-hover:text-indigo-600"/>
                         </div>
                         <div className="font-bold text-sm text-gray-800 group-hover:text-indigo-900">{scen.title}</div>
                         <div className="text-xs text-gray-500 mt-1 line-clamp-2">{scen.description}</div>
                     </button>
                 ))}
             </div>
             
             {/* Quick Action: Scan Pipeline */}
             <div className="mt-4 pt-4 border-t border-gray-100">
                 <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Instant Actions</h3>
                 <button 
                    onClick={() => handleSendMessage("Scan pipeline for urgent opportunities")}
                    className="flex items-center space-x-2 text-sm text-brand-dark bg-gray-50 hover:bg-white border border-gray-200 hover:border-brand-gold px-3 py-2 rounded-lg transition-all shadow-sm w-full md:w-auto"
                 >
                     <Radar size={16} className="text-brand-red" />
                     <span>Scan Pipeline for Urgent Opportunities</span>
                 </button>
             </div>
          </div>
      )}

      {/* Message List */}
      <MessageList 
          messages={activeMessages}
          isLoading={isLoading}
          isSimulationMode={isSimulationMode}
          verifyingMsgIds={verifyingMsgIds}
          onVerify={handleVerifyMessage}
      />

      {/* Input Area */}
      <ChatInput 
          onSend={handleSendMessage}
          isLoading={isLoading}
          isSimulationMode={isSimulationMode}
          suggestions={messages.length < 3 ? SUGGESTED_PROMPTS : []}
      />
    </div>
  );
};