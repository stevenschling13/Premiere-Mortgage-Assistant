
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User as UserIcon, Loader2, Link as LinkIcon, ExternalLink, Mic, MicOff, Trash, Search, ShieldCheck, AlertTriangle, Swords, XCircle, PlayCircle, Trophy, Beaker, X } from 'lucide-react';
import { ChatMessage, SimulationScenario } from '../types';
import { chatWithAssistant, verifyFactualClaims, loadFromStorage, saveToStorage, StorageKeys } from '../services';
import { SIMULATION_SCENARIOS, SUGGESTED_PROMPTS } from '../constants';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { MarkdownRenderer } from './MarkdownRenderer';

// Robust manual encoding to avoid stack overflow with large buffers
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const base64ToUint8Array = (base64: string) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

interface AssistantProps {
    onClose?: () => void;
}

export const Assistant: React.FC<AssistantProps> = ({ onClose }) => {
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

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [verifyingMsgIds, setVerifyingMsgIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Simulation Mode State
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<SimulationScenario | null>(null);
  const [simulationMessages, setSimulationMessages] = useState<ChatMessage[]>([]);

  // Live Voice State
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [isLiveConnecting, setIsLiveConnecting] = useState(false);
  const [visualizerData, setVisualizerData] = useState<number[]>(new Array(5).fill(10));

  // Live Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const shouldConnectRef = useRef(false);

  useEffect(() => {
     if (!isSimulationMode) {
         saveToStorage(StorageKeys.CHAT_HISTORY, messages);
     }
  }, [messages, isSimulationMode]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, simulationMessages, isSimulationMode]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopLiveSession();
    };
  }, []);

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

  const deleteMessage = (id: string) => {
      setMessages(prev => prev.filter(m => m.id !== id));
  };

  const startSimulation = (scenario: SimulationScenario) => {
      setIsSimulationMode(true);
      setSelectedScenario(scenario);
      setSimulationMessages([{
          id: 'sim-start',
          role: 'model',
          text: `**SIMULATION STARTED: ${scenario.title}**\n\n${scenario.description}\n\nI am ready. Make your move.`,
          timestamp: new Date()
      }]);
  };

  const exitSimulation = () => {
      setIsSimulationMode(false);
      setSelectedScenario(null);
      setSimulationMessages([]);
      stopLiveSession(); // Safety stop
  };

  const handleVerifyMessage = async (msgId: string, text: string) => {
      if (verifyingMsgIds.has(msgId)) return;
      
      setVerifyingMsgIds(prev => new Set(prev).add(msgId));
      
      try {
          if (!text) throw new Error("No text to verify");
          const result = await verifyFactualClaims(text);
          setMessages(prev => prev.map(m => 
              m.id === msgId ? { ...m, verificationResult: result } : m
          ));
      } catch (e) {
          console.error("Verification failed", e);
      } finally {
          setVerifyingMsgIds(prev => {
              const next = new Set(prev);
              next.delete(msgId);
              return next;
          });
      }
  };

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: textToSend,
      timestamp: new Date()
    };

    // Update appropriate state based on mode
    if (isSimulationMode) {
        setSimulationMessages(prev => [...prev, userMsg]);
    } else {
        setMessages(prev => [...prev, userMsg]);
    }
    
    setInput('');
    setIsLoading(true);

    try {
      const currentHistory = isSimulationMode ? simulationMessages : messages;
      // Prepare history excluding the message we just added
      const history = currentHistory.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      // In Simulation Mode, we inject the specific persona instructions
      const systemInstruction = isSimulationMode && selectedScenario 
          ? selectedScenario.systemInstruction 
          : undefined;

      const response = await chatWithAssistant(history, userMsg.text, systemInstruction);

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.text,
        timestamp: new Date(),
        groundingLinks: response.links,
        searchEntryPoint: response.searchEntryPoint,
        searchQueries: response.searchQueries
      };

      if (isSimulationMode) {
          setSimulationMessages(prev => [...prev, aiMsg]);
      } else {
          setMessages(prev => [...prev, aiMsg]);
      }

    } catch (error: any) {
      console.error(error);
      let errorText = "I apologize, but I'm having trouble connecting right now.";
      
      const errMsg = error.message || JSON.stringify(error);
      if (errMsg.includes('403') || errMsg.includes('API key')) {
          errorText = "Configuration Error: The API Key appears to be invalid.";
      }

      const errorMsg = {
        id: Date.now().toString(),
        role: 'model',
        text: errorText,
        timestamp: new Date(),
        isError: true
      } as ChatMessage;

      if (isSimulationMode) setSimulationMessages(prev => [...prev, errorMsg]);
      else setMessages(prev => [...prev, errorMsg]);

    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // --- Live Voice Handlers ---

  const updateVisualizer = () => {
      if (!analyserRef.current) return;
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Sample 5 distinct frequencies for the bars
      const samples = [
          dataArray[0],
          dataArray[10],
          dataArray[20],
          dataArray[30],
          dataArray[40]
      ].map(val => Math.max(10, val)); // Min height

      setVisualizerData(samples);
      animationFrameRef.current = requestAnimationFrame(updateVisualizer);
  };

  const startLiveSession = async () => {
    // If already connecting or connected, don't start again
    if (shouldConnectRef.current) return;
    
    setIsLiveConnecting(true);
    shouldConnectRef.current = true;

    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = ctx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      if (!mountedRef.current || !shouldConnectRef.current) {
          stream.getTracks().forEach(track => track.stop());
          ctx.close();
          setIsLiveConnecting(false);
          return;
      }

      mediaStreamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Select Instruction based on mode
      const instruction = isSimulationMode && selectedScenario
          ? selectedScenario.systemInstruction
          : "You are a professional mortgage banking assistant. Speak concisely. Use real-time data where possible.";

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            if (!mountedRef.current || !shouldConnectRef.current) return;
            console.log("Live session opened");
            setIsLiveConnected(true);
            setIsLiveConnecting(false);

            const source = ctx.createMediaStreamSource(stream);
            sourceNodeRef.current = source;
            
            // Visualizer Setup
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            analyserRef.current = analyser;
            source.connect(analyser);
            updateVisualizer();

            const processor = ctx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              // Convert Float32 to Int16
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
              }
              // Safer manual encoding
              const base64Data = encode(new Uint8Array(int16.buffer));

              sessionPromise.then(session => {
                  session.sendRealtimeInput({
                      media: {
                          mimeType: "audio/pcm;rate=16000",
                          data: base64Data
                      }
                  });
              });
            };

            source.connect(processor);
            processor.connect(ctx.destination); 
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (!mountedRef.current) return;
            const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
                const audioData = base64ToUint8Array(base64Audio);
                const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                
                const int16Array = new Int16Array(audioData.buffer);
                const float32Output = new Float32Array(int16Array.length);
                for(let i=0; i<int16Array.length; i++) {
                    float32Output[i] = int16Array[i] / 32768.0;
                }

                const buffer = outputCtx.createBuffer(1, float32Output.length, 24000);
                buffer.getChannelData(0).set(float32Output);

                const source = outputCtx.createBufferSource();
                source.buffer = buffer;
                source.connect(outputCtx.destination);
                source.start(0); 
            }
          },
          onclose: () => {
            console.log("Live session closed");
            if (mountedRef.current) {
              stopLiveSession();
            }
          },
          onerror: (err) => {
            console.error("Live session error", err);
            if (mountedRef.current) {
              stopLiveSession();
            }
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          },
          systemInstruction: instruction,
          tools: [{ googleSearch: {} }]
        }
      });
      

    } catch (e) {
      console.error("Failed to start live session", e);
      if (mountedRef.current) {
        setIsLiveConnecting(false);
        setIsLiveConnected(false);
        shouldConnectRef.current = false;
      }
    }
  };

  const stopLiveSession = () => {
    shouldConnectRef.current = false;
    setIsLiveConnected(false);
    setIsLiveConnecting(false);
    setIsLiveMode(false);
    setVisualizerData(new Array(5).fill(10));
    
    if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
    }

    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
    }

    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
    }
    
    if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
    }
    
    if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
    }
    
    if (audioContextRef.current) {
        if(audioContextRef.current.state !== 'closed') {
             audioContextRef.current.close().catch(console.error);
        }
        audioContextRef.current = null;
    }
  };

  const toggleLiveMode = () => {
    if (isLiveMode) {
      stopLiveSession();
    } else {
      setIsLiveMode(true);
      startLiveSession();
    }
  };

  return (
    <div className={`flex flex-col bg-white overflow-hidden w-full animate-fade-in ${
        onClose 
        ? 'h-full border-l border-gray-200 shadow-xl' 
        : 'h-[calc(100dvh-64px)] md:h-[calc(100dvh-32px)] md:rounded-xl shadow-sm border-t md:border border-gray-200 mx-auto max-w-5xl md:my-4'
    }`}>
      
      {/* Header */}
      <div className={`p-3 md:p-4 flex items-center justify-between z-20 relative shrink-0 safe-top transition-colors ${
          isSimulationMode ? 'bg-indigo-950 text-indigo-50' : 'bg-brand-dark text-white'
      }`}>
        <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg relative ${isSimulationMode ? 'bg-indigo-500/20' : 'bg-white/10'}`}>
                {isSimulationMode ? <Beaker className="text-indigo-400 w-6 h-6" /> : <Bot className="text-brand-gold w-6 h-6" />}
                <div className={`absolute -bottom-1 -right-1 rounded-full p-[2px] border ${isSimulationMode ? 'bg-indigo-500 border-indigo-900' : 'bg-brand-gold border-brand-dark'}`}>
                  {isSimulationMode ? <Trophy size={10} className="text-white"/> : <ShieldCheck size={10} className="text-brand-dark"/>}
                </div>
            </div>
            <div>
                <h3 className="font-semibold text-sm md:text-base">
                    {isSimulationMode ? 'Simulation Lab' : 'Verified Market Assistant'}
                </h3>
                <p className="opacity-70 text-xs flex items-center">
                    <span className={`w-2 h-2 rounded-full mr-1 ${isLiveConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></span>
                    {isSimulationMode ? `Scenario: ${selectedScenario?.title}` : 'Gemini 3 Pro • Tier-1 Sources'}
                </p>
            </div>
        </div>
        
        <div className="flex items-center space-x-2">
            {!isSimulationMode && !onClose && (
                <button 
                    onClick={() => setIsSimulationMode(true)}
                    className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 transition-all text-xs"
                >
                    <Beaker size={14} />
                    <span className="hidden md:inline">Enter Lab</span>
                </button>
            )}
            {isSimulationMode && (
                <button 
                    onClick={exitSimulation}
                    className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                    title="Exit Lab"
                >
                    <XCircle size={18} />
                </button>
            )}
            {!isSimulationMode && (
                <button 
                    onClick={handleClearHistory}
                    className="p-1.5 text-gray-400 hover:text-white transition-colors"
                    title="Clear History"
                >
                    <Trash size={16} />
                </button>
            )}
            <button 
                onClick={toggleLiveMode}
                className={`flex items-center justify-center w-8 h-8 md:w-auto md:h-auto md:px-3 md:py-1.5 rounded-full transition-all border ${
                    isLiveMode 
                    ? 'bg-red-500/20 text-red-200 border-red-500/50 hover:bg-red-500/30' 
                    : isSimulationMode 
                        ? 'bg-indigo-500 text-white border-indigo-600 hover:bg-indigo-600'
                        : 'bg-brand-gold text-brand-dark border-brand-gold hover:bg-yellow-500'
                }`}
                title="Voice Mode"
            >
                {isLiveMode ? <MicOff size={16}/> : <Mic size={16}/>}
                <span className="hidden md:inline ml-2 text-xs md:text-sm font-medium">{isLiveMode ? 'End' : 'Voice'}</span>
            </button>
            
            {onClose && (
                <button 
                    onClick={onClose} 
                    className="p-2 hover:bg-white/10 rounded-full text-gray-300 hover:text-white transition-colors ml-2 border border-transparent hover:border-white/10"
                    title="Close Assistant"
                >
                    <X size={20} />
                </button>
            )}
        </div>
      </div>

      {/* Simulation Scenario Selection Overlay */}
      {isSimulationMode && !selectedScenario && (
          <div className="absolute inset-0 top-[64px] bg-gray-50 z-30 flex flex-col p-6 animate-fade-in">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Select Simulation</h2>
              <p className="text-gray-500 mb-6">Choose a conversation scenario to practice.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto">
                  {SIMULATION_SCENARIOS.map(scenario => (
                      <div 
                        key={scenario.id}
                        onClick={() => startSimulation(scenario)}
                        className="bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-400 hover:shadow-lg cursor-pointer transition-all group"
                      >
                          <div className="flex justify-between items-start mb-3">
                              <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide ${
                                  scenario.difficulty === 'ROOKIE' ? 'bg-green-100 text-green-700' :
                                  scenario.difficulty === 'VETERAN' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-red-100 text-red-700'
                              }`}>
                                  {scenario.difficulty}
                              </span>
                              <Swords className="text-gray-300 group-hover:text-indigo-500 transition-colors" size={20}/>
                          </div>
                          <h3 className="font-bold text-lg text-gray-800 mb-2">{scenario.title}</h3>
                          <p className="text-sm text-gray-500 leading-relaxed">{scenario.description}</p>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* Voice Mode Overlay */}
      {isLiveMode && (
          <div className={`absolute inset-0 top-[60px] md:top-[72px] z-10 flex flex-col items-center justify-center p-8 animate-fade-in safe-bottom ${
              isSimulationMode ? 'bg-gradient-to-b from-indigo-950 to-gray-900' : 'bg-gradient-to-b from-brand-dark to-slate-900'
          }`}>
              <div className="relative mb-12 flex-1 flex flex-col items-center justify-center">
                  {/* Dynamic Visualizer */}
                  <div className="flex items-end justify-center space-x-2 h-24 mb-12">
                       {visualizerData.map((val, idx) => (
                           <div 
                                key={idx}
                                className={`w-4 md:w-6 rounded-t-full transition-all duration-75 ease-out shadow-[0_0_15px_rgba(255,255,255,0.2)] ${
                                    isSimulationMode ? 'bg-indigo-500' : 'bg-brand-red'
                                }`}
                                style={{ 
                                    height: `${Math.min(val, 100)}%`,
                                    opacity: isLiveConnected ? 1 : 0.3 
                                }}
                           ></div>
                       ))}
                  </div>

                  <div className="text-center space-y-4">
                      <h3 className="text-xl md:text-2xl font-bold text-white tracking-wide">
                          {isLiveConnecting ? 'Connecting...' : isLiveConnected ? (isSimulationMode ? 'Simulation Active' : 'Listening...') : 'Initializing...'}
                      </h3>
                      <p className="text-gray-400 max-w-xs md:max-w-md mx-auto text-sm leading-relaxed">
                          {isSimulationMode 
                              ? "You are now live with the client persona. Good luck." 
                              : "Speak naturally. I can analyze rates, draft emails, or search market news in real-time."}
                      </p>
                  </div>
              </div>
              
              <button 
                  onClick={stopLiveSession}
                  className="mb-8 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-full px-8 py-4 flex items-center space-x-3 shadow-lg transition-all active:scale-95 animate-fade-in"
              >
                  <MicOff size={24} />
                  <span className="font-bold text-lg">End Session</span>
              </button>
          </div>
      )}

      {/* Messages Area */}
      <div className={`flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 ${isSimulationMode ? 'bg-indigo-50/30' : 'bg-gray-50/50'}`}>
        {(isSimulationMode ? simulationMessages : messages).map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group`}
          >
            <div className={`flex max-w-[90%] md:max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-start gap-2 md:gap-3`}>
              
              <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                msg.role === 'user' 
                    ? (isSimulationMode ? 'bg-indigo-600 text-white' : 'bg-brand-red text-white') 
                    : (isSimulationMode ? 'bg-indigo-950 text-indigo-200' : 'bg-brand-dark text-brand-gold')
              }`}>
                {msg.role === 'user' ? <UserIcon size={14} /> : <Bot size={14} />}
              </div>

              <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                    className={`px-4 py-2 md:px-5 md:py-3 rounded-2xl shadow-sm text-sm leading-relaxed relative ${
                    msg.role === 'user'
                        ? (isSimulationMode ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-brand-red text-white rounded-tr-none')
                        : msg.isError 
                            ? 'bg-red-50 text-red-800 border border-red-200 rounded-tl-none'
                            : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'
                    }`}
                >
                    {msg.role === 'user' ? (
                         <div className="whitespace-pre-wrap">{msg.text}</div>
                    ) : (
                         <>
                            <MarkdownRenderer content={msg.text} />
                            
                            {/* Verification Button (Only in Assistant Mode) */}
                            {!isSimulationMode && !msg.isError && !msg.verificationResult && (
                                <div className="mt-3 pt-2 border-t border-gray-100 flex justify-end">
                                    <button 
                                        onClick={() => handleVerifyMessage(msg.id, msg.text)}
                                        disabled={verifyingMsgIds.has(msg.id)}
                                        className="flex items-center space-x-1.5 px-3 py-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full text-xs font-semibold text-gray-600 transition-colors disabled:opacity-50"
                                    >
                                        {verifyingMsgIds.has(msg.id) ? (
                                            <Loader2 size={12} className="animate-spin text-brand-red" />
                                        ) : (
                                            <ShieldCheck size={12} className="text-gray-400" />
                                        )}
                                        <span>{verifyingMsgIds.has(msg.id) ? 'Verifying...' : 'Verify Data'}</span>
                                    </button>
                                </div>
                            )}

                            {/* Verification Result Card */}
                            {msg.verificationResult && (
                                <div className={`mt-3 pt-3 border-t-2 border-dashed ${
                                    msg.verificationResult.status === 'VERIFIED' ? 'border-green-200' : 'border-red-200'
                                }`}>
                                    <div className={`p-3 rounded-lg text-xs border mb-2 ${
                                        msg.verificationResult.status === 'VERIFIED' 
                                            ? 'bg-green-50 border-green-200 text-green-800' 
                                            : 'bg-red-50 border-red-200 text-red-800'
                                    }`}>
                                        <div className="flex items-center font-bold mb-2 uppercase tracking-wide">
                                            {msg.verificationResult.status === 'VERIFIED' ? (
                                                <ShieldCheck size={14} className="mr-1.5" />
                                            ) : (
                                                <AlertTriangle size={14} className="mr-1.5" />
                                            )}
                                            Audit Report: {msg.verificationResult.status === 'VERIFIED' ? 'Verified Accurate' : 'Issues Found'}
                                        </div>
                                        <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1">
                                            <MarkdownRenderer content={msg.verificationResult.text} />
                                        </div>
                                    </div>
                                    
                                    {/* Sources from Verification */}
                                    {msg.verificationResult.sources.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {msg.verificationResult.sources.slice(0, 3).map((s, idx) => (
                                                <a 
                                                    key={idx}
                                                    href={s.uri}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-center px-2 py-1 bg-white border border-gray-200 rounded text-[10px] text-gray-500 hover:text-brand-dark hover:border-brand-gold transition-colors"
                                                >
                                                    <LinkIcon size={10} className="mr-1 opacity-50"/>
                                                    <span className="truncate max-w-[120px]">{s.title}</span>
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                         </>
                    )}
                    
                    {/* Grounding Info (Original Generation) */}
                    {((msg.groundingLinks?.length || 0) > 0 || (msg.searchQueries?.length || 0) > 0) && !isSimulationMode && (
                      <div className="mt-3 pt-3 border-t border-dashed border-gray-300/50">
                        {/* Source Links */}
                        {msg.groundingLinks && msg.groundingLinks.length > 0 && (
                            <>
                                <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-2 flex items-center text-gray-600">
                                <LinkIcon size={10} className="mr-1" /> Original Sources
                                </p>
                                <div className="flex flex-wrap gap-2 mb-2">
                                {msg.groundingLinks.slice(0, 4).map((link, idx) => (
                                    <a 
                                    key={idx} 
                                    href={link.uri} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[10px] bg-white border border-gray-200 hover:border-brand-gold hover:bg-yellow-50 px-2 py-1 rounded-md flex items-center transition-all text-brand-dark no-underline shadow-sm group"
                                    >
                                    <span className="max-w-[150px] truncate">{link.title}</span>
                                    <ExternalLink size={10} className="ml-1 opacity-30 group-hover:opacity-100" />
                                    </a>
                                ))}
                                </div>
                            </>
                        )}

                        {/* Search Entry Point Compliance Footer */}
                        {msg.searchEntryPoint && (
                            <div 
                                className="mt-2 text-[10px] text-gray-400 [&_a]:text-gray-500 [&_a]:underline"
                                dangerouslySetInnerHTML={{ __html: msg.searchEntryPoint }}
                            />
                        )}
                      </div>
                    )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-400 px-1">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {!isSimulationMode && (
                        <button 
                            onClick={() => deleteMessage(msg.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-300 hover:text-red-400"
                            title="Delete Message"
                        >
                            <Trash size={12} />
                        </button>
                    )}
                </div>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex justify-start">
                 <div className="flex flex-row items-center gap-3 animate-pulse">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isSimulationMode ? 'bg-indigo-950 text-indigo-200' : 'bg-brand-dark text-brand-gold'}`}>
                        <Bot size={16} />
                    </div>
                    <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none border border-gray-200 shadow-sm flex items-center gap-2">
                        <Loader2 className={`w-4 h-4 animate-spin ${isSimulationMode ? 'text-indigo-500' : 'text-brand-red'}`} />
                        <span className="text-sm text-gray-500">{isSimulationMode ? 'Opponent thinking...' : 'Searching market data...'}</span>
                    </div>
                 </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts (Visible when limited history) */}
      {!isLiveMode && !isSimulationMode && (
          <div className="px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide shrink-0 mask-image-fade-right">
              {SUGGESTED_PROMPTS.map((prompt, idx) => (
                  <button 
                      key={idx}
                      onClick={() => handleSend(prompt)}
                      className="whitespace-nowrap px-3 py-1.5 bg-gray-50 hover:bg-white hover:border-brand-gold text-gray-600 hover:text-brand-dark text-xs font-medium rounded-full border border-gray-200 transition-all shadow-sm"
                  >
                      {prompt}
                  </button>
              ))}
          </div>
      )}

      {/* Input Area */}
      <div className="p-3 md:p-4 bg-white border-t border-gray-200 shrink-0 mb-safe safe-bottom">
        <div className="relative flex items-center">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isSimulationMode ? "Type your rebuttal..." : "Ask about rates, draft emails, or analyze scenarios..."}
            className={`w-full pl-4 pr-12 py-3 md:py-4 bg-gray-50 border border-gray-200 rounded-xl outline-none resize-none text-sm transition-all shadow-inner text-gray-900 ${
                isSimulationMode ? 'focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500' : 'focus:ring-2 focus:ring-brand-red focus:bg-white focus:border-brand-red'
            }`}
            rows={1}
            style={{ minHeight: '50px' }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className={`absolute right-2 md:right-3 p-2 text-white rounded-lg transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                isSimulationMode ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-brand-red hover:bg-red-700'
            }`}
            aria-label="Send message"
          >
            <Send className="w-4 h-4 md:w-[18px] md:h-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );
};
