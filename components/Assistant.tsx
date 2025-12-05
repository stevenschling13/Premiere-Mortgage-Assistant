
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User as UserIcon, Loader2, Link as LinkIcon, ExternalLink, Mic, MicOff, X, Activity } from 'lucide-react';
import { ChatMessage } from '../types';
import { chatWithAssistant, getGeminiClient } from '../services/geminiService';
import { useToast } from '../App';
import { LiveServerMessage, Modality } from "@google/genai";

const floatTo16BitPCM = (float32Array: Float32Array) => {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return buffer;
};

const base64ToUint8Array = (base64: string) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const Assistant: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'model',
      text: 'Good morning. I am your Premiere Mortgage Assistant. How can I support your private client deals today?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
  const sessionRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const { showToast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    return () => {
      stopLiveSession();
    };
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const response = await chatWithAssistant(history, userMsg.text);

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.text,
        timestamp: new Date(),
        groundingLinks: response.links
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: "I apologize, but I'm having trouble connecting to the market data service right now. Please try again in a moment.",
        timestamp: new Date(),
        isError: true
      }]);
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
    setIsLiveConnecting(true);
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = ctx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const ai = getGeminiClient();
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
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
              const pcm16 = floatTo16BitPCM(inputData);
              const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcm16)));

              sessionPromise.then(session => {
                  session.sendRealtimeInput({
                      media: {
                          mimeType: "audio/pcm;rate=16000",
                          data: base64Data
                      }
                  });
              });
            };

            // Connect for processing (but not to destination to avoid self-echo, unless we want to monitor)
            source.connect(processor);
            processor.connect(ctx.destination); 
          },
          onmessage: async (msg: LiveServerMessage) => {
            const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && audioContextRef.current) {
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
            stopLiveSession();
          },
          onerror: (err) => {
            console.error("Live session error", err);
            stopLiveSession();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          },
          systemInstruction: "You are a professional mortgage banking assistant. Speak concisely."
        }
      });
      
      sessionRef.current = sessionPromise;

    } catch (e) {
      console.error("Failed to start live session", e);
      setIsLiveConnecting(false);
      setIsLiveConnected(false);
      showToast('Unable to start live voice session. Check your API key and microphone permissions.', 'error');
    }
  };

  const stopLiveSession = () => {
    setIsLiveConnected(false);
    setIsLiveConnecting(false);
    setIsLiveMode(false);
    
    if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
    }

    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;

    processorRef.current?.disconnect();
    sourceNodeRef.current?.disconnect();
    analyserRef.current?.disconnect();
    
    audioContextRef.current?.close();
    audioContextRef.current = null;

    sessionRef.current?.then((s: any) => {
        // s.close() if available
    });
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
    <div className="h-[calc(100vh-64px)] md:h-[calc(100vh-32px)] flex flex-col bg-white md:rounded-xl shadow-sm border-t md:border border-gray-200 overflow-hidden mx-auto max-w-5xl md:my-4 relative w-full">
      
      {/* Header */}
      <div className="bg-brand-dark p-3 md:p-4 flex items-center justify-between z-20 relative shrink-0">
        <div className="flex items-center space-x-3">
            <div className="bg-white/10 p-2 rounded-lg">
                <Bot className="text-brand-gold w-6 h-6" />
            </div>
            <div>
                <h3 className="text-white font-semibold text-sm md:text-base">Live Market Assistant</h3>
                <p className="text-gray-400 text-xs flex items-center">
                    <span className={`w-2 h-2 rounded-full mr-1 ${isLiveConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></span>
                    Gemini 2.5 • {isLiveMode ? 'Voice Active' : 'Chat Active'}
                </p>
            </div>
        </div>
        
        <button 
            onClick={toggleLiveMode}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-full transition-all border ${
                isLiveMode 
                ? 'bg-red-500/20 text-red-200 border-red-500/50 hover:bg-red-500/30' 
                : 'bg-brand-gold text-brand-dark border-brand-gold hover:bg-yellow-500'
            }`}
        >
            {isLiveMode ? <MicOff size={16}/> : <Mic size={16}/>}
            <span className="text-xs md:text-sm font-medium">{isLiveMode ? 'End Session' : 'Voice Mode'}</span>
        </button>
      </div>

      {/* Voice Mode Overlay */}
      {isLiveMode && (
          <div className="absolute inset-0 top-[60px] md:top-[72px] bg-gradient-to-b from-brand-dark to-slate-900 z-10 flex flex-col items-center justify-center p-8 animate-fade-in">
              <div className="relative mb-12">
                  {/* Dynamic Visualizer */}
                  <div className="flex items-end justify-center space-x-2 h-24">
                       {visualizerData.map((val, idx) => (
                           <div 
                                key={idx}
                                className="w-4 md:w-6 bg-brand-red rounded-t-full transition-all duration-75 ease-out shadow-[0_0_15px_rgba(205,19,55,0.5)]"
                                style={{ 
                                    height: `${Math.min(val, 100)}%`,
                                    opacity: isLiveConnected ? 1 : 0.3 
                                }}
                           ></div>
                       ))}
                  </div>
              </div>

              <div className="text-center space-y-4">
                  <h3 className="text-xl md:text-2xl font-bold text-white tracking-wide">
                      {isLiveConnecting ? 'Connecting Secure Line...' : isLiveConnected ? 'Listening...' : 'Initializing...'}
                  </h3>
                  <p className="text-gray-400 max-w-xs md:max-w-md mx-auto text-sm leading-relaxed">
                      Speak naturally. I can analyze rates, draft emails, or search market news in real-time.
                  </p>
              </div>
          </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 bg-gray-50/50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex max-w-[90%] md:max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-start gap-2 md:gap-3`}>
              
              <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                msg.role === 'user' ? 'bg-brand-red text-white' : 'bg-brand-dark text-brand-gold'
              }`}>
                {msg.role === 'user' ? <UserIcon size={14} /> : <Bot size={14} />}
              </div>

              <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                    className={`px-4 py-2 md:px-5 md:py-3 rounded-2xl shadow-sm text-sm leading-relaxed ${
                    msg.role === 'user'
                        ? 'bg-brand-red text-white rounded-tr-none'
                        : msg.isError 
                            ? 'bg-red-50 text-red-800 border border-red-200 rounded-tl-none'
                            : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'
                    }`}
                >
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                    
                    {msg.groundingLinks && msg.groundingLinks.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-gray-100/20">
                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-2 flex items-center">
                           <LinkIcon size={10} className="mr-1" /> Sources
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {msg.groundingLinks.slice(0, 3).map((link, idx) => (
                            <a 
                              key={idx} 
                              href={link.uri} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[10px] bg-black/5 hover:bg-black/10 px-2 py-1 rounded flex items-center transition-colors text-current no-underline"
                            >
                              {link.title.substring(0, 30)}...
                              <ExternalLink size={10} className="ml-1 opacity-50" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
                <span className="text-[10px] text-gray-400 mt-1 px-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex justify-start">
                 <div className="flex flex-row items-center gap-3 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-brand-dark text-brand-gold flex items-center justify-center shrink-0">
                        <Bot size={16} />
                    </div>
                    <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none border border-gray-200 shadow-sm flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-brand-red" />
                        <span className="text-sm text-gray-500">Processing...</span>
                    </div>
                 </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 md:p-4 bg-white border-t border-gray-200 shrink-0 mb-safe">
        <div className="relative flex items-center">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about rates, draft emails, or analyze scenarios..."
            className="w-full pl-4 pr-12 py-3 md:py-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-red focus:bg-white focus:border-brand-red outline-none resize-none text-sm transition-all shadow-inner"
            rows={1}
            style={{ minHeight: '50px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 md:right-3 p-2 bg-brand-red text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
          >
            <Send size={16} md:size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
