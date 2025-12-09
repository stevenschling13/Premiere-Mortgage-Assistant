
import React, { useState, useEffect } from 'react';
import { 
    TrendingUp, Megaphone, BrainCircuit, RefreshCw, 
    Linkedin, Mail, MessageSquare, 
    Layers, Loader2, Sparkles, Copy, ExternalLink, 
    Trash2, ShieldCheck, AlertTriangle, Link as LinkIcon, Home, Wallet
} from 'lucide-react';
import { 
    fetchDailyMarketPulse, 
    generateClientFriendlyAnalysis, 
    generateBuyerSpecificAnalysis,
    generateMarketingCampaign,
    verifyCampaignContent,
    loadFromStorage, 
    saveToStorage, 
    StorageKeys 
} from '../services';
import { MarketIndex, NewsItem, MarketingCampaign, VerificationResult } from '../types';
import { useToast } from './Toast';
import { MarkdownRenderer } from './MarkdownRenderer';

type Tab = 'PULSE' | 'CAMPAIGN';

interface MarketingState {
    campaignTopic: string;
    campaignTone: string;
    campaignResult: MarketingCampaign | null;
}

const DEFAULT_MARKETING_STATE: MarketingState = {
    campaignTopic: '',
    campaignTone: 'Professional & Educational',
    campaignResult: null,
};

export const MarketingStudio: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('PULSE');

  // Load Persisted State
  const [marketingState, setMarketingState] = useState<MarketingState>(() => 
      loadFromStorage(StorageKeys.MARKETING_DATA, DEFAULT_MARKETING_STATE)
  );

  // Helper to update specific fields in marketing state
  const updateMarketingState = (updates: Partial<MarketingState>) => {
      setMarketingState(prev => {
          const newState = { ...prev, ...updates };
          saveToStorage(StorageKeys.MARKETING_DATA, newState);
          return newState;
      });
  };

  const handleClearWorkspace = () => {
      if(confirm('Clear current campaign draft?')) {
          setMarketingState(DEFAULT_MARKETING_STATE);
          setVerificationResult(null);
          saveToStorage(StorageKeys.MARKETING_DATA, DEFAULT_MARKETING_STATE);
          showToast('Workspace cleared', 'info');
      }
  };

  // Market Pulse State (Not persisted, always fresh or default)
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
    },
    {
      id: '2',
      source: 'Housing Wire',
      date: 'Yesterday',
      title: "Luxury Inventory Tightens: Jumbo Listings Down 12% YoY",
      summary: "High-end markets in SF, NY, and Miami are seeing a shortage of turnkey properties.",
      category: 'Housing',
    }
  ]);
  const [marketSources, setMarketSources] = useState<{uri: string, title: string}[]>([]);
  const [isFetchingData, setIsFetchingData] = useState(false);
  
  const [clientAnalysis, setClientAnalysis] = useState('');
  const [analysisMode, setAnalysisMode] = useState<'GENERAL' | 'BUYER'>('GENERAL');
  const [isThinking, setIsThinking] = useState(false);

  // Verification State
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Loading States
  const [isGeneratingCampaign, setIsGeneratingCampaign] = useState(false);

  // --- Handlers ---

  const handleRefreshMarketData = async () => {
      setIsFetchingData(true);
      try {
          showToast('Scanning live markets...', 'info');
          const data = await fetchDailyMarketPulse();
          if (data) {
              setIndices(data.indices);
              setNewsFeed(data.news);
              setMarketSources(data.sources || []);
              showToast('Market data updated', 'success');
          }
      } catch (error) {
          console.error(error);
          showToast('Failed to fetch live data', 'error');
      } finally {
          setIsFetchingData(false);
      }
  };

  const handleGenerateAnalysis = async (mode: 'GENERAL' | 'BUYER') => {
      setIsThinking(true);
      setAnalysisMode(mode);
      try {
          const context = { indices, news: newsFeed.slice(0, 3) };
          let analysis = '';
          if (mode === 'GENERAL') {
              analysis = await generateClientFriendlyAnalysis(context) ?? '';
          } else {
              analysis = await generateBuyerSpecificAnalysis(context) ?? '';
          }
          setClientAnalysis(analysis || "Analysis unavailable.");
      } catch (error) {
          console.error(error);
          showToast('Analysis failed', 'error');
      } finally {
          setIsThinking(false);
      }
  };

  const handleLaunchCampaign = (newsItem: NewsItem) => {
      updateMarketingState({
          campaignTopic: `Breaking News: ${newsItem.title}. ${newsItem.summary}`
      });
      setVerificationResult(null);
      setActiveTab('CAMPAIGN');
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGenerateCampaign = async () => {
      if (!marketingState.campaignTopic) return;
      setIsGeneratingCampaign(true);
      setVerificationResult(null);
      try {
          const result = await generateMarketingCampaign(marketingState.campaignTopic, marketingState.campaignTone);
          updateMarketingState({ campaignResult: result });
      } catch (error) {
          showToast('Failed to generate campaign', 'error');
      } finally {
          setIsGeneratingCampaign(false);
      }
  };

  const handleVerifyCampaign = async () => {
      if (!marketingState.campaignResult) return;
      setIsVerifying(true);
      try {
          const result = await verifyCampaignContent(marketingState.campaignResult);
          setVerificationResult(result);
          showToast('Verification complete', 'success');
      } catch (e) {
          console.error(e);
          showToast('Verification failed', 'error');
      } finally {
          setIsVerifying(false);
      }
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      showToast('Copied to clipboard', 'info');
  };

  // --- Render Sections ---

  const renderMarketPulse = () => (
      <div className="space-y-6 animate-fade-in">
          <div className="flex flex-row justify-between items-end">
              <div>
                  <h3 className="font-bold text-gray-800 text-lg">Market Snapshot</h3>
                  <div className="flex items-center text-xs text-gray-500 mt-1">
                      <span className="mr-2">Real-time indices & verified news</span>
                      <span className="flex items-center px-1.5 py-0.5 bg-green-50 text-green-700 rounded-full border border-green-200">
                          <ShieldCheck size={10} className="mr-1"/> Source Integrity Active
                      </span>
                  </div>
              </div>
              <button 
                  onClick={handleRefreshMarketData}
                  disabled={isFetchingData}
                  className="flex items-center space-x-2 bg-white text-gray-700 border border-gray-200 hover:border-brand-red hover:text-brand-red px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all disabled:opacity-50 disabled:cursor-wait"
              >
                  <RefreshCw size={16} className={isFetchingData ? 'animate-spin' : ''} />
                  <span>{isFetchingData ? 'Scanning...' : 'Refresh Data'}</span>
              </button>
          </div>

          {/* Ticker */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {indices.map((index, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">{index.label}</span>
                      <div className="flex items-end justify-between">
                          <span className="text-xl font-bold text-brand-dark">{index.value}</span>
                          <span className={`text-xs font-medium ${index.isUp ? 'text-green-600' : 'text-red-600'}`}>
                              {index.change}
                          </span>
                      </div>
                  </div>
              ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* News Feed */}
              <div className="lg:col-span-2 space-y-4">
                  <h3 className="font-bold text-gray-700 flex items-center">
                      <TrendingUp className="mr-2 text-brand-red" size={20}/>
                      Market Intelligence
                  </h3>
                  {newsFeed.map((news, idx) => (
                      <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow relative group">
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
                          <h4 className="font-bold text-gray-900 mb-2">{news.title}</h4>
                          <p className="text-xs text-gray-600 leading-relaxed mb-4">{news.summary}</p>
                          
                          <button 
                              onClick={() => handleLaunchCampaign(news)}
                              className="w-full py-2 bg-gray-50 hover:bg-brand-red hover:text-white text-gray-600 text-xs font-bold rounded-lg transition-colors flex items-center justify-center group-hover:bg-brand-red group-hover:text-white"
                          >
                              <Layers size={14} className="mr-2"/>
                              Launch Campaign from this News
                          </button>
                      </div>
                  ))}
              </div>

              {/* Deep Thinking Analysis */}
              <div className="lg:col-span-1 flex flex-col h-full">
                  <h3 className="font-bold text-gray-700 flex items-center mb-4">
                      {analysisMode === 'BUYER' ? (
                           <Wallet className="mr-2 text-brand-gold" size={20}/>
                      ) : (
                           <BrainCircuit className="mr-2 text-brand-gold" size={20}/>
                      )}
                      {analysisMode === 'BUYER' ? 'Buyer Impact Analysis' : 'Strategic Insight'}
                  </h3>
                  <div className="bg-brand-dark text-white rounded-xl shadow-lg p-6 flex-1 flex flex-col relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-6 opacity-10">
                          {analysisMode === 'BUYER' ? <Home size={120} /> : <BrainCircuit size={120} />}
                      </div>
                      
                      <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex-1 text-sm leading-relaxed mb-4 overflow-y-auto max-h-[400px]">
                          {isThinking ? (
                              <div className="flex flex-col items-center justify-center h-full space-y-3">
                                  <Loader2 className="animate-spin text-brand-gold" size={24} />
                                  <p className="text-xs text-brand-gold animate-pulse text-center">
                                      {analysisMode === 'BUYER' ? 'Calculating purchasing power impact...' : 'Connecting dots between Yields & Housing...'}
                                  </p>
                              </div>
                          ) : clientAnalysis ? (
                              <div className="prose prose-invert prose-sm">
                                  <MarkdownRenderer content={clientAnalysis} />
                              </div>
                          ) : (
                              <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-60 text-center">
                                  <p className="text-xs">
                                      Generate a brief to view market data impact.
                                  </p>
                              </div>
                          )}
                      </div>

                      <div className="flex gap-2 mt-auto">
                          <button 
                              onClick={() => handleGenerateAnalysis('GENERAL')}
                              disabled={isThinking}
                              className={`flex-1 py-3 font-bold text-sm rounded-lg transition-colors shadow-lg active:scale-95 disabled:opacity-50 ${
                                  analysisMode === 'GENERAL' ? 'bg-brand-gold text-brand-dark hover:bg-yellow-500' : 'bg-white/10 text-white hover:bg-white/20'
                              }`}
                          >
                              Daily Brief
                          </button>
                          <button 
                              onClick={() => handleGenerateAnalysis('BUYER')}
                              disabled={isThinking}
                              className={`flex-1 py-3 font-bold text-sm rounded-lg transition-colors shadow-lg active:scale-95 disabled:opacity-50 ${
                                  analysisMode === 'BUYER' ? 'bg-brand-gold text-brand-dark hover:bg-yellow-500' : 'bg-white/10 text-white hover:bg-white/20'
                              }`}
                          >
                              Buyer Impact
                          </button>
                      </div>
                  </div>
              </div>
          </div>

          {/* Verified Sources Footer */}
          {marketSources.length > 0 && (
            <div className="mt-8 bg-white border border-gray-200 rounded-xl p-6 shadow-sm animate-fade-in relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                    <div className="p-3 bg-green-50 text-green-700 rounded-full shrink-0">
                        <ShieldCheck size={24} />
                    </div>
                    <div className="flex-1">
                            <h4 className="font-bold text-gray-900 text-sm flex items-center mb-1">
                            Data Integrity Verified
                            <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-[10px] uppercase rounded-full font-bold tracking-wide">
                                Tier-1 Sources
                            </span>
                            </h4>
                            <p className="text-xs text-gray-500 mb-4 max-w-2xl leading-relaxed">
                            The market data displayed above has been retrieved via real-time search and cross-referenced against credible financial institutions (Bloomberg, WSJ, Fed, etc.) to ensure accuracy and compliance.
                            </p>
                            <div className="flex flex-wrap gap-2">
                            {marketSources.map((source, idx) => (
                                <a 
                                    key={idx} 
                                    href={source.uri} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="group flex items-center space-x-2 px-3 py-2 bg-gray-50 hover:bg-white border border-gray-200 hover:border-brand-gold rounded-lg transition-all shadow-sm"
                                >
                                    <div className="bg-white p-1 rounded-full border border-gray-200 group-hover:border-brand-gold/30">
                                        <ExternalLink size={10} className="text-gray-400 group-hover:text-brand-dark" />
                                    </div>
                                    <span className="text-xs font-medium text-gray-700 group-hover:text-brand-dark truncate max-w-[200px]">
                                        {source.title}
                                    </span>
                                </a>
                            ))}
                            </div>
                    </div>
                </div>
            </div>
          )}
      </div>
  );

  const renderCampaignDirector = () => (
      <div className="animate-fade-in space-y-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative">
              <div className="flex justify-between items-start mb-4">
                 <h3 className="font-bold text-gray-800 flex items-center">
                    <Layers className="mr-2 text-brand-red" size={20}/>
                    Campaign Configuration
                 </h3>
                 <button 
                    onClick={handleClearWorkspace}
                    className="text-xs text-gray-400 hover:text-red-500 flex items-center px-2 py-1 hover:bg-gray-100 rounded transition-colors"
                 >
                    <Trash2 size={12} className="mr-1"/> Clear Workspace
                 </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-3">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Campaign Topic</label>
                      <input 
                          value={marketingState.campaignTopic}
                          onChange={(e) => updateMarketingState({ campaignTopic: e.target.value })}
                          placeholder="e.g. Fed Rate Hike, New Jumbo Product, Open House Invitation"
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red outline-none text-sm"
                      />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tone Strategy</label>
                      <select 
                          value={marketingState.campaignTone}
                          onChange={(e) => updateMarketingState({ campaignTone: e.target.value })}
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-red outline-none text-sm"
                      >
                          <option>Professional & Educational</option>
                          <option>Urgent & Opportunity Focused</option>
                          <option>Warm & Relationship Building</option>
                          <option>Luxury & Exclusive</option>
                      </select>
                  </div>
              </div>
              <div className="flex gap-2 mt-4">
                  <button 
                      onClick={handleGenerateCampaign}
                      disabled={isGeneratingCampaign || !marketingState.campaignTopic}
                      className="flex-1 bg-brand-dark text-white py-3 rounded-lg font-bold text-sm hover:bg-gray-800 transition-colors flex items-center justify-center disabled:opacity-50"
                  >
                      {isGeneratingCampaign ? <Loader2 className="animate-spin mr-2" size={16}/> : <Sparkles className="mr-2 text-brand-gold" size={16}/>}
                      Generate Multi-Channel Campaign
                  </button>
                  {marketingState.campaignResult && (
                      <button 
                          onClick={handleVerifyCampaign}
                          disabled={isVerifying}
                          className="px-6 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 py-3 rounded-lg font-bold text-sm transition-colors flex items-center justify-center disabled:opacity-50"
                      >
                          {isVerifying ? <Loader2 className="animate-spin mr-2" size={16}/> : <ShieldCheck className="mr-2 text-green-600" size={16}/>}
                          Verify Facts
                      </button>
                  )}
              </div>
          </div>

          {/* Verification Result */}
          {verificationResult && (
              <div className={`p-4 rounded-xl border-l-4 shadow-sm animate-fade-in ${
                  verificationResult.status === 'VERIFIED' 
                      ? 'bg-green-50 border-green-500 text-green-900' 
                      : 'bg-red-50 border-red-500 text-red-900'
              }`}>
                  <div className="flex items-start">
                      {verificationResult.status === 'VERIFIED' ? (
                          <ShieldCheck size={20} className="mr-3 text-green-600 mt-0.5 shrink-0" />
                      ) : (
                          <AlertTriangle size={20} className="mr-3 text-red-600 mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1">
                          <h4 className="font-bold text-sm uppercase mb-2">Audit Report: {verificationResult.status === 'VERIFIED' ? 'Verified Accurate' : 'Potential Issues Found'}</h4>
                          <div className="prose prose-sm max-w-none">
                              <MarkdownRenderer content={verificationResult.text} />
                          </div>
                          {verificationResult.sources.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                  {verificationResult.sources.map((s, idx) => (
                                      <a key={idx} href={s.uri} target="_blank" rel="noopener noreferrer" className="text-[10px] flex items-center bg-white/50 hover:bg-white px-2 py-1 rounded border border-black/5 transition-colors">
                                          <LinkIcon size={10} className="mr-1 opacity-50"/> {s.title}
                                      </a>
                                  ))}
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          )}

          {marketingState.campaignResult && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* LinkedIn Card (Editable) */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[400px]">
                      <div className="bg-[#0077b5] p-3 flex justify-between items-center text-white shrink-0">
                          <div className="flex items-center space-x-2"><Linkedin size={16}/><span className="font-bold text-xs">LinkedIn Post</span></div>
                          <button onClick={() => copyToClipboard(marketingState.campaignResult?.linkedInPost || '')} className="hover:bg-white/20 p-1 rounded"><Copy size={14}/></button>
                      </div>
                      <div className="flex-1 p-2 bg-gray-50">
                          <textarea 
                             className="w-full h-full p-2 bg-transparent border-none outline-none resize-none text-sm text-gray-800 leading-relaxed"
                             value={marketingState.campaignResult.linkedInPost}
                             onChange={(e) => updateMarketingState({
                                 campaignResult: { ...marketingState.campaignResult!, linkedInPost: e.target.value }
                             })}
                          />
                      </div>
                  </div>

                  {/* Email Card (Editable) */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[400px]">
                      <div className="bg-gray-800 p-3 flex justify-between items-center text-white shrink-0">
                          <div className="flex items-center space-x-2"><Mail size={16}/><span className="font-bold text-xs">Client Email</span></div>
                          <button onClick={() => copyToClipboard(`${marketingState.campaignResult?.emailSubject}\n\n${marketingState.campaignResult?.emailBody}`)} className="hover:bg-white/20 p-1 rounded"><Copy size={14}/></button>
                      </div>
                      <div className="p-4 flex-1 bg-gray-50 flex flex-col space-y-3 overflow-hidden">
                          <div className="border-b border-gray-200 pb-2 shrink-0">
                              <span className="text-xs text-gray-500 uppercase font-bold block mb-1">Subject:</span>
                              <input 
                                className="w-full bg-transparent font-medium text-brand-dark text-sm outline-none"
                                value={marketingState.campaignResult.emailSubject}
                                onChange={(e) => updateMarketingState({
                                    campaignResult: { ...marketingState.campaignResult!, emailSubject: e.target.value }
                                })}
                              />
                          </div>
                          <textarea 
                             className="flex-1 w-full bg-transparent border-none outline-none resize-none text-sm text-gray-800 leading-relaxed"
                             value={marketingState.campaignResult.emailBody}
                             onChange={(e) => updateMarketingState({
                                 campaignResult: { ...marketingState.campaignResult!, emailBody: e.target.value }
                             })}
                          />
                      </div>
                  </div>

                  {/* SMS Card (Editable) */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[400px]">
                      <div className="bg-green-600 p-3 flex justify-between items-center text-white shrink-0">
                          <div className="flex items-center space-x-2"><MessageSquare size={16}/><span className="font-bold text-xs">SMS Blast</span></div>
                          <button onClick={() => copyToClipboard(marketingState.campaignResult?.smsTeaser || '')} className="hover:bg-white/20 p-1 rounded"><Copy size={14}/></button>
                      </div>
                      <div className="p-4 flex-1 bg-gray-50 flex items-center justify-center">
                          <div className="bg-white border border-gray-200 p-3 rounded-tr-xl rounded-tl-xl rounded-bl-xl shadow-sm max-w-[90%] w-full">
                              <textarea 
                                 className="w-full bg-transparent border-none outline-none resize-none text-sm text-gray-800 leading-relaxed text-center"
                                 rows={4}
                                 value={marketingState.campaignResult.smsTeaser}
                                 onChange={(e) => updateMarketingState({
                                     campaignResult: { ...marketingState.campaignResult!, smsTeaser: e.target.value }
                                 })}
                              />
                          </div>
                      </div>
                  </div>
              </div>
          )}
      </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-brand-dark flex items-center">
             <Megaphone className="mr-3 text-brand-red" size={32}/>
             Marketing Studio
          </h2>
          <p className="text-gray-500 mt-1">Multi-channel campaign orchestration & compliance.</p>
        </div>
        <div className="flex items-center space-x-2 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
            <button 
                onClick={() => setActiveTab('PULSE')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'PULSE' ? 'bg-brand-dark text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                Market Pulse
            </button>
            <button 
                onClick={() => setActiveTab('CAMPAIGN')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'CAMPAIGN' ? 'bg-brand-dark text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                Campaign Director
            </button>
        </div>
      </div>
      
      <div className="min-h-[500px]">
          {activeTab === 'PULSE' && renderMarketPulse()}
          {activeTab === 'CAMPAIGN' && renderCampaignDirector()}
      </div>

      {activeTab === 'PULSE' && (
           <div className="fixed bottom-6 right-6 z-20 md:hidden">
               <button 
                  onClick={handleRefreshMarketData}
                  disabled={isFetchingData}
                  className="bg-brand-red text-white p-4 rounded-full shadow-lg hover:bg-red-700 transition-colors disabled:opacity-50"
               >
                   <RefreshCw size={24} className={isFetchingData ? 'animate-spin' : ''} />
               </button>
           </div>
      )}
    </div>
  );
};
