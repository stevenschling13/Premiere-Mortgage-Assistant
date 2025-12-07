import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Linkedin, Mail, Copy, ArrowRight, MessageSquare, Sparkles, Loader2, FileText, Megaphone, Smartphone, Volume2, RefreshCw, BrainCircuit } from 'lucide-react';
import { synthesizeMarketNews, generateMarketingContent, generateSpeech, fetchDailyMarketPulse, generateClientFriendlyAnalysis } from '../services/geminiService';
import { MarketIndex, NewsItem } from '../types';
import { useToast } from './Toast';

export const MarketingStudio: React.FC = () => {
  const { showToast } = useToast();
  // Content Generation State
  const [genChannel, setGenChannel] = useState('LinkedIn Post');
  const [genTopic, setGenTopic] = useState('Weekly Rate Update');
  const [genTone, setGenTone] = useState('Professional & Educational');
  const [generatedContent, setGeneratedContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Market Data State
  const [indices, setIndices] = useState<MarketIndex[]>([
    { label: '10-Yr Treasury', value: '4.12%', change: '+0.05', isUp: true },
    { label: 'S&P 500', value: '5,230', change: '-12.4', isUp: false },
    { label: 'MBS (UMBS 5.5)', value: '98.42', change: '-0.15', isUp: false },
    { label: 'Brent Crude', value: '$82.40', change: '+0.45', isUp: true },
  ]);

  const [newsFeed, setNewsFeed] = useState<NewsItem[]>([
    {
      id: '1',
      source: 'Federal Reserve',
      date: 'Today, 8:30 AM',
      title: "Fed Signals 'Higher for Longer' After Strong Jobs Report",
      summary: "Chairman Powell emphasized that while inflation is cooling, the labor market remains too tight to justify immediate rate cuts.",
      category: 'Economy',
      talkingPoints: ["Advise clients to lock in rates now if closing within 45 days."]
    },
    {
      id: '2',
      source: 'Housing Wire',
      date: 'Yesterday',
      title: "Luxury Inventory Tightens: Jumbo Listings Down 12% YoY",
      summary: "High-end markets in SF, NY, and Miami are seeing a shortage of turnkey properties.",
      category: 'Housing',
      talkingPoints: ["Be prepared for appraisal gaps in the $5M+ range."]
    }
  ]);
  
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [clientAnalysis, setClientAnalysis] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  // --- Handlers ---

  const handleRefreshMarketData = async () => {
      setIsFetchingData(true);
      try {
          showToast('Scanning live markets...', 'info');
          const data = await fetchDailyMarketPulse();
          if (data) {
              setIndices(data.indices);
              setNewsFeed(data.news);
              showToast('Market data updated successfully', 'success');
          }
      } catch (error) {
          console.error(error);
          showToast('Failed to fetch live data', 'error');
      } finally {
          setIsFetchingData(false);
      }
  };

  const handleGenerateAnalysis = async () => {
      setIsThinking(true);
      try {
          const context = { indices, news: newsFeed.slice(0, 3) };
          const analysis = await generateClientFriendlyAnalysis(context);
          setClientAnalysis(analysis || "Analysis unavailable.");
      } catch (error) {
          console.error(error);
          showToast('Analysis failed', 'error');
      } finally {
          setIsThinking(false);
      }
  };

  const handleGenerateContent = async (customContext?: string) => {
    setIsGenerating(true);
    try {
        const result = await generateMarketingContent(genChannel, genTopic, genTone, customContext);
        setGeneratedContent(result || 'Could not generate content.');
    } catch (e) {
        console.error(e);
    } finally {
        setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      showToast('Copied to clipboard', 'info');
  };

  const handleReadContent = async () => {
    if (!generatedContent) return;
    setIsSpeaking(true);
    try {
        const base64Audio = await generateSpeech(generatedContent);
        const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
        audio.onended = () => setIsSpeaking(false);
        audio.play();
    } catch (e) {
        console.error(e);
        setIsSpeaking(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto animate-fade-in pb-20">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-3xl font-bold text-brand-dark flex items-center">
             <Megaphone className="mr-3 text-brand-red" size={32}/>
             Marketing Studio
          </h2>
          <p className="text-gray-500 mt-1">Real-time market intelligence & content generation.</p>
        </div>
        <button 
            onClick={handleRefreshMarketData}
            disabled={isFetchingData}
            className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-brand-red transition-all shadow-sm text-sm font-medium text-gray-700 disabled:opacity-50"
        >
            <RefreshCw size={16} className={`${isFetchingData ? 'animate-spin text-brand-red' : ''}`}/>
            <span>{isFetchingData ? 'Updating...' : 'Update Daily Data'}</span>
        </button>
      </div>

      {/* Market Pulse / Sources */}
      <div className="mb-8">
        <h3 className="font-bold text-gray-700 mb-4 flex items-center">
            <TrendingUp className="mr-2" size={20}/>
            Market Pulse (Live)
        </h3>

        {/* Indices Ticker */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {indices.map((index, idx) => (
            <div key={idx} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{index.label}</span>
                <div className="flex items-end justify-between mt-1">
                <span className="text-lg font-bold text-brand-dark">{index.value}</span>
                <span className={`text-xs font-medium ${index.isUp ? 'text-green-600' : 'text-red-600'}`}>
                    {index.change}
                </span>
                </div>
            </div>
            ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             {/* News Column */}
             <div className="lg:col-span-2 space-y-4">
                 {newsFeed.map((news, idx) => (
                    <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col hover:shadow-md transition-shadow relative group">
                        <div className="flex items-center justify-between mb-2">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                news.category === 'Rates' ? 'bg-blue-100 text-blue-700' : 
                                news.category === 'Economy' ? 'bg-purple-100 text-purple-700' : 
                                'bg-orange-100 text-orange-700'
                            }`}>
                                {news.category}
                            </span>
                            <span className="text-[10px] text-gray-400">{news.date}</span>
                        </div>
                        <h4 className="font-bold text-gray-900 mb-1 leading-tight">{news.title}</h4>
                        <p className="text-xs text-gray-600 leading-relaxed mb-4">{news.summary}</p>
                        
                        <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4 bg-white shadow-sm p-1 rounded-lg border border-gray-100">
                             <button 
                                onClick={() => {
                                    setGenTopic(news.title);
                                    setGenChannel('LinkedIn Post');
                                    handleGenerateContent(`Source: ${news.title}. Summary: ${news.summary}`);
                                    window.scrollTo({top: 500, behavior: 'smooth'});
                                }}
                                className="p-1.5 hover:bg-gray-100 rounded text-blue-600" title="Draft LinkedIn"
                             >
                                <Linkedin size={14} />
                             </button>
                             <button 
                                onClick={() => {
                                    setGenTopic(news.title);
                                    setGenChannel('Client Email Blast');
                                    handleGenerateContent(`Source: ${news.title}. Summary: ${news.summary}`);
                                    window.scrollTo({top: 500, behavior: 'smooth'});
                                }}
                                className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="Draft Email"
                             >
                                <Mail size={14} />
                             </button>
                        </div>
                    </div>
                 ))}
             </div>

             {/* Client Analysis (Deep Thinking) */}
             <div className="lg:col-span-1">
                 <div className="bg-brand-dark text-white rounded-xl shadow-lg p-6 relative overflow-hidden h-full">
                     <div className="absolute top-0 right-0 p-6 opacity-10">
                         <BrainCircuit size={100} />
                     </div>
                     <div className="relative z-10 flex flex-col h-full">
                         <div className="flex items-center space-x-2 mb-4">
                             <div className="bg-white/10 p-2 rounded-lg">
                                <BrainCircuit className="text-brand-gold" size={20} />
                             </div>
                             <div>
                                 <h3 className="font-bold text-sm">Client-Ready Intelligence</h3>
                                 <p className="text-[10px] text-gray-400">Gemini 3 Pro • Deep Thinking Analysis</p>
                             </div>
                         </div>
                         
                         <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex-1 text-sm leading-relaxed mb-4 overflow-y-auto max-h-[300px]">
                             {isThinking ? (
                                 <div className="flex flex-col items-center justify-center h-full space-y-3">
                                     <Loader2 className="animate-spin text-brand-gold" size={24} />
                                     <p className="text-xs text-brand-gold animate-pulse text-center">
                                         Analyzing Yield Curves...<br/>Simulating Inflation Impact...<br/>Simplifying for Borrowers...
                                     </p>
                                 </div>
                             ) : clientAnalysis ? (
                                 <div className="prose prose-invert prose-sm">
                                     <pre className="whitespace-pre-wrap font-sans text-xs">{clientAnalysis}</pre>
                                 </div>
                             ) : (
                                 <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-60 text-center">
                                     <p className="text-xs">
                                         Click below to translate complex market data into a simple "What it means for you" brief for clients.
                                     </p>
                                 </div>
                             )}
                         </div>

                         <button 
                            onClick={handleGenerateAnalysis}
                            disabled={isThinking}
                            className="w-full py-2 bg-brand-gold text-brand-dark font-bold text-sm rounded-lg hover:bg-yellow-500 transition-colors shadow-lg active:scale-95 disabled:opacity-50"
                         >
                            {isThinking ? 'Thinking Deeply...' : 'Generate Daily Brief'}
                         </button>
                     </div>
                 </div>
             </div>
        </div>
      </div>

      {/* Content Generator Panel */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-brand-red"></div>
          <div className="flex items-center space-x-2 mb-6">
              <Sparkles className="text-brand-red" size={20}/>
              <h3 className="font-bold text-brand-dark text-lg">AI Content Generator</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-4">
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
                      <select 
                        value={genChannel}
                        onChange={(e) => setGenChannel(e.target.value)}
                        className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-red text-sm"
                      >
                          <option>LinkedIn Post</option>
                          <option>Client Email Blast</option>
                          <option>SMS / Text Message</option>
                          <option>Instagram Caption</option>
                          <option>Phone Call Script</option>
                      </select>
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
                      <input 
                        type="text"
                        value={genTopic}
                        onChange={(e) => setGenTopic(e.target.value)}
                        className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-red text-sm"
                        placeholder="e.g. Fed Rate Decision"
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
                      <select 
                        value={genTone}
                        onChange={(e) => setGenTone(e.target.value)}
                        className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-red text-sm"
                      >
                          <option>Professional & Educational</option>
                          <option>Urgent & Opportunity Focused</option>
                          <option>Warm & Relationship Building</option>
                          <option>Short & Punchy</option>
                      </select>
                  </div>
                  <button 
                    onClick={() => handleGenerateContent()}
                    disabled={isGenerating}
                    className="w-full bg-brand-dark text-white py-2.5 rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center justify-center shadow-md disabled:opacity-70"
                  >
                      {isGenerating ? <Loader2 className="animate-spin w-4 h-4 mr-2"/> : <Sparkles className="w-4 h-4 mr-2 text-brand-gold"/>}
                      Generate Draft
                  </button>
              </div>

              <div className="md:col-span-2">
                  <div className="bg-gray-50 border border-gray-200 rounded-xl h-[400px] md:h-full md:min-h-[400px] relative p-4 flex flex-col">
                      {generatedContent ? (
                          <>
                            <textarea 
                                value={generatedContent}
                                onChange={(e) => setGeneratedContent(e.target.value)}
                                className="w-full flex-1 bg-transparent border-none outline-none resize-none text-base text-gray-900 leading-relaxed font-sans pr-10"
                            />
                            <div className="absolute top-3 right-3 flex flex-col gap-2">
                                <button 
                                    onClick={() => copyToClipboard(generatedContent)}
                                    className="p-2 bg-white rounded-lg shadow-sm border border-gray-200 text-gray-500 hover:text-brand-dark transition-colors"
                                    title="Copy to Clipboard"
                                >
                                    <Copy size={16}/>
                                </button>
                                <button 
                                    onClick={handleReadContent}
                                    disabled={isSpeaking}
                                    className="p-2 bg-white rounded-lg shadow-sm border border-gray-200 text-gray-500 hover:text-brand-dark transition-colors"
                                    title="Read Aloud"
                                >
                                    {isSpeaking ? <Loader2 size={16} className="animate-spin text-brand-red"/> : <Volume2 size={16}/>}
                                </button>
                            </div>
                          </>
                      ) : (
                          <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-2">
                              <FileText size={48} className="opacity-20"/>
                              <p className="text-sm">Select options and click Generate to draft content.</p>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};