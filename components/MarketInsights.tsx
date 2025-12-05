import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Linkedin, Mail, Copy, ArrowRight, MessageSquare, Sparkles, Loader2, FileText, Megaphone, Smartphone, Volume2 } from 'lucide-react';
import { synthesizeMarketNews, generateMarketingContent, generateSpeech } from '../services/geminiService';
import { useToast } from '../App';

interface NewsItem {
  id: string;
  source: string;
  date: string;
  title: string;
  summary: string;
  talkingPoints: string[];
  category: 'Rates' | 'Economy' | 'Housing';
}

export const MarketingStudio: React.FC = () => {
  // Content Generation State
  const [genChannel, setGenChannel] = useState('LinkedIn Post');
  const [genTopic, setGenTopic] = useState('Weekly Rate Update');
  const [genTone, setGenTone] = useState('Professional & Educational');
  const [generatedContent, setGeneratedContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Market Data State
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const { showToast } = useToast();

  const indices = [
    { label: '10-Yr Treasury', value: '4.12%', change: '+0.05', isUp: true },
    { label: 'S&P 500', value: '5,230', change: '-12.4', isUp: false },
    { label: 'MBS (UMBS 5.5)', value: '98.42', change: '-0.15', isUp: false },
    { label: 'Brent Crude', value: '$82.40', change: '+0.45', isUp: true },
  ];

  const newsFeed: NewsItem[] = [
    {
      id: '1',
      source: 'Federal Reserve',
      date: 'Today, 8:30 AM',
      category: 'Economy',
      title: "Fed Signals 'Higher for Longer' After Strong Jobs Report",
      summary: "Chairman Powell emphasized that while inflation is cooling, the labor market remains too tight to justify immediate rate cuts. Markets are now pricing in the first cut for September rather than June.",
      talkingPoints: [
        "Advise clients to lock in rates now if closing within 45 days.",
        "For long time horizons, 7/1 ARM is 0.5% lower than 30-year fixed.",
      ]
    },
    {
      id: '2',
      source: 'Housing Wire',
      date: 'Yesterday',
      category: 'Housing',
      title: "Luxury Inventory Tightens: Jumbo Listings Down 12% YoY",
      summary: "High-end markets in SF, NY, and Miami are seeing a shortage of turnkey properties, leading to renewed bidding wars despite elevated interest rates.",
      talkingPoints: [
        "Pre-underwriting is critical for 'good as cash' offers.",
        "Be prepared for appraisal gaps in the $5M+ range."
      ]
    },
    {
      id: '3',
      source: 'Bond Market Update',
      date: '2 Days Ago',
      category: 'Rates',
      title: "Jumbo-Conforming Spread Narrows to Historic Lows",
      summary: "The spread between Jumbo rates and Conforming rates has compressed. Jumbo liquidity remains strong as private banks compete for high-quality assets.",
      talkingPoints: [
        "Portfolio relationship pricing is beating standard secondary market.",
        "Moving assets to the bank (AUM) can unlock rate discounts."
      ]
    }
  ];

  const handleGenerateContent = async (customContext?: string) => {
    setIsGenerating(true);
    try {
        const result = await generateMarketingContent(genChannel, genTopic, genTone, customContext);
        setGeneratedContent(result || 'Could not generate content.');
    } catch (e) {
        console.error(e);
        showToast('Content generation failed. Please verify your API key and try again.', 'error');
    } finally {
        setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      showToast('Copied to clipboard', 'success');
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
        showToast('Unable to play audio. Check your API access and try again.', 'error');
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
          <p className="text-gray-500 mt-1">Generate high-impact content to nurture leads and build authority.</p>
        </div>
      </div>

      {/* Content Generator Panel */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-brand-gold"></div>
          <div className="flex items-center space-x-2 mb-6">
              <Sparkles className="text-brand-gold" size={20}/>
              <h3 className="font-bold text-brand-dark text-lg">AI Content Generator</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-4">
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
                      <select 
                        value={genChannel}
                        onChange={(e) => setGenChannel(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-red text-sm"
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
                        className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-red text-sm"
                        placeholder="e.g. Fed Rate Decision"
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
                      <select 
                        value={genTone}
                        onChange={(e) => setGenTone(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-red text-sm"
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
                  <div className="bg-gray-50 border border-gray-200 rounded-xl h-full min-h-[250px] relative p-4">
                      {generatedContent ? (
                          <>
                            <textarea 
                                value={generatedContent}
                                onChange={(e) => setGeneratedContent(e.target.value)}
                                className="w-full h-full bg-transparent border-none outline-none resize-none text-sm text-gray-800 leading-relaxed font-sans pr-8"
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

      {/* Market Pulse / Sources */}
      <h3 className="font-bold text-gray-700 mb-4 flex items-center">
          <TrendingUp className="mr-2" size={20}/>
          Market Pulse (Content Sources)
      </h3>

      {/* Indices Ticker */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {indices.map((index, idx) => (
          <div key={idx} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{index.label}</span>
            <div className="flex items-end justify-between mt-1">
              <span className="text-lg font-bold text-brand-dark">{index.value}</span>
              <span className={`text-xs font-medium ${index.isUp ? 'text-green-600' : 'text-red-600'}`}>{index.change}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {newsFeed.map((news) => (
          <div key={news.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
            <div className="p-5 flex-1">
              <div className="flex items-center justify-between mb-3">
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                  news.category === 'Rates' ? 'bg-blue-100 text-blue-700' : 
                  news.category === 'Economy' ? 'bg-purple-100 text-purple-700' : 
                  'bg-orange-100 text-orange-700'
                }`}>
                  {news.category}
                </span>
                <span className="text-[10px] text-gray-400">{news.date}</span>
              </div>
              
              <h4 className="font-bold text-gray-900 mb-2 leading-tight">{news.title}</h4>
              <p className="text-xs text-gray-600 leading-relaxed mb-4 line-clamp-3">{news.summary}</p>
              
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Key Talking Point</p>
                  <p className="text-xs text-gray-700">{news.talkingPoints[0]}</p>
              </div>
            </div>

            <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-between space-x-2">
                <button 
                    onClick={() => {
                        setGenTopic(news.title);
                        setGenChannel('LinkedIn Post');
                        handleGenerateContent(`Source: ${news.title}. Summary: ${news.summary}`);
                        window.scrollTo({top: 0, behavior: 'smooth'});
                    }}
                    className="flex-1 bg-white border border-gray-200 hover:bg-gray-100 text-brand-dark text-xs py-2 rounded flex items-center justify-center transition-colors font-medium"
                >
                    <Linkedin size={14} className="mr-1 text-blue-700"/> Post
                </button>
                 <button 
                    onClick={() => {
                        setGenTopic(news.title);
                        setGenChannel('Client Email Blast');
                        handleGenerateContent(`Source: ${news.title}. Summary: ${news.summary}`);
                        window.scrollTo({top: 0, behavior: 'smooth'});
                    }}
                    className="flex-1 bg-white border border-gray-200 hover:bg-gray-100 text-brand-dark text-xs py-2 rounded flex items-center justify-center transition-colors font-medium"
                >
                    <Mail size={14} className="mr-1 text-gray-600"/> Email
                </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};