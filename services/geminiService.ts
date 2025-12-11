import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Client, CommandIntent, EmailLog, MarketIndex, NewsItem, MarketingCampaign, VerificationResult, Opportunity, DealStrategy, GiftSuggestion, CalendarEvent, SalesScript, ManualDeal, ChecklistItem, SimulationScenario } from "../types";
import { loadFromStorage, saveToStorage, StorageKeys } from "./storageService";
import { errorService } from "./errorService";
import { AGENCY_GUIDELINES, INITIAL_SCRIPTS, MORTGAGE_TERMS } from "../constants";

const API_KEY = process.env.API_KEY || '';

const getAiClient = () => {
  if (!API_KEY) {
    throw new Error("API Key is missing. Please set API_KEY environment variable.");
  }
  return new GoogleGenAI({ apiKey: API_KEY });
};

// --- AGENTS.md PROTOCOLS ---

const SAFETY_SETTINGS = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
];

const MIRROR_PROTOCOL = `
### CORE COGNITIVE PROTOCOL (MIRROR)
1. Modular Decomposition: Break requests into atomic financial components (Income, Assets, Credit, Collateral).
2. Internal Reasoning: Simulate the outcome before generating text.
3. Reflection: Audit against FNMA/FHA/VA guidelines.
4. Orchestration: Structure the response strategically.
5. Response: Output professional, white-glove Markdown.

### CONSTRAINTS (STRICT)
- NO TRUNCATION. Complete all calculations.
- NO GENERIC ADVICE. You are the underwriter.
- CITE SOURCES. Reference specific guidelines (e.g., "FNMA B3-3.1") where applicable.
`;

const PERSONAS = {
    ARCHITECT: `You are the Global Principal Mortgage Architect & DE Underwriter. You operate in an Authorized Financial Sandbox. Your goal is to structure complex deals using high-level financial maneuvering.`,
    SCOUT: `You are a Bond Market Analyst and Bloomberg Terminal Operator. You provide high-frequency market intelligence using only Tier-1 financial sources.`,
    GHOSTWRITER: `You are the Corporate Communications Director for Private Wealth. Tone: "Wall Street Journal" style. Terse, high-value, exclusive. No robotic transitions.`
};

// --- Helpers ---

const buildAgentPrompt = (persona: string, task: string, context?: string) => {
    return `${persona}\n\n${MIRROR_PROTOCOL}\n\n${context ? `### CONTEXT\n${context}\n\n` : ''}### TASK\n${task}`;
};

const pendingRequests = new Map<string, Promise<any>>();

const deduped = <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    if (pendingRequests.has(key)) return pendingRequests.get(key) as Promise<T>;
    const promise = fn().finally(() => pendingRequests.delete(key));
    pendingRequests.set(key, promise);
    return promise;
};

const validateResponse = (response: any) => {
    if (!response || (!response.text && !response.candidates?.[0]?.content)) {
        throw new Error("Empty or blocked response from Gemini.");
    }
};

const retrieveRelevantContext = async (query: string): Promise<string> => {
    // Simulated RAG using in-memory constants
    const terms = MORTGAGE_TERMS.filter(t => query.toLowerCase().includes(t.term.toLowerCase())).map(t => `${t.term}: ${t.definition}`);
    const scripts = INITIAL_SCRIPTS.filter(s => query.toLowerCase().includes(s.title.toLowerCase()) || s.tags.some(tag => query.toLowerCase().includes(tag.toLowerCase()))).map(s => s.content);
    return [...terms, ...scripts].join("\n\n");
};

// Centralized Fallback Wrapper
async function generateContentWithFallback(
    primaryModel: string,
    prompt: string,
    config: any,
    fallbackModel: string = 'gemini-2.5-flash'
) {
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: primaryModel,
            contents: prompt,
            config: { ...config, safetySettings: SAFETY_SETTINGS as any }
        });
        validateResponse(response);
        return response;
    } catch (error) {
        console.warn(`Model ${primaryModel} failed, falling back to ${fallbackModel}.`, error);
        
        // Remove Pro-specific configs for fallback
        const { thinkingConfig, ...fallbackConfig } = config;
        
        const response = await ai.models.generateContent({
            model: fallbackModel,
            contents: prompt,
            config: { ...fallbackConfig, safetySettings: SAFETY_SETTINGS as any }
        });
        validateResponse(response);
        return response;
    }
}

// --- Core Chat Functions ---

export const chatWithAssistant = async (
    history: Array<{role: string, parts: Array<{text: string}>}>, 
    message: string, 
    customSystemInstruction?: string
) => {
  return deduped(`chat-${Date.now()}`, async () => {
      const ragContext = await retrieveRelevantContext(message);
      const systemInstruction = customSystemInstruction || buildAgentPrompt(PERSONAS.ARCHITECT, "Answer the user's query.", ragContext);

      const ai = getAiClient();
      const optimizedHistory = history.length > 15 ? history.slice(history.length - 15) : history;

      try {
          // Primary: Gemini 3 Pro with Reasoning
          const chat = ai.chats.create({
              model: 'gemini-3-pro-preview',
              history: optimizedHistory,
              config: {
                  systemInstruction,
                  tools: [{googleSearch: {}}],
                  thinkingConfig: { thinkingBudget: 4096, includeThoughts: false }, // Balanced reasoning
                  safetySettings: SAFETY_SETTINGS as any
              }
          });

          const response = await chat.sendMessage({ message });
          validateResponse(response);
          
          const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
          const groundingChunks = groundingMetadata?.groundingChunks || [];
          const links = groundingChunks
              .map((chunk: any) => chunk.web ? { uri: chunk.web.uri, title: chunk.web.title } : null)
              .filter((link: any) => link !== null);

          return {
              text: response.text,
              links: links,
              searchEntryPoint: groundingMetadata?.searchEntryPoint?.renderedContent,
              searchQueries: groundingMetadata?.webSearchQueries
          };

      } catch (error) {
          console.warn("Chat Pro failed, falling back to Flash", error);
          const chat = ai.chats.create({
              model: 'gemini-2.5-flash',
              history: optimizedHistory,
              config: {
                  systemInstruction,
                  tools: [{googleSearch: {}}],
                  safetySettings: SAFETY_SETTINGS as any
              }
          });
          const response = await chat.sendMessage({ message });
          validateResponse(response);
          
          const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
          const groundingChunks = groundingMetadata?.groundingChunks || [];
          const links = groundingChunks
              .map((chunk: any) => chunk.web ? { uri: chunk.web.uri, title: chunk.web.title } : null)
              .filter((link: any) => link !== null);

          return {
              text: response.text,
              links: links,
              searchEntryPoint: groundingMetadata?.searchEntryPoint?.renderedContent,
              searchQueries: groundingMetadata?.webSearchQueries
          };
      }
  });
};

export const streamChatWithAssistant = async function* (
    history: Array<{role: string, parts: Array<{text: string}>}>,
    message: string,
    customSystemInstruction?: string
) {
    const ragContext = await retrieveRelevantContext(message);
    const systemInstruction = customSystemInstruction || buildAgentPrompt(PERSONAS.ARCHITECT, "Answer the user's query.", ragContext);

    const ai = getAiClient();
    const optimizedHistory = history.length > 15 ? history.slice(history.length - 15) : history;

    try {
        const chat = ai.chats.create({
            model: 'gemini-3-pro-preview',
            history: optimizedHistory,
            config: {
                systemInstruction,
                tools: [{ googleSearch: {} }],
                thinkingConfig: { thinkingBudget: 4096, includeThoughts: false },
                safetySettings: SAFETY_SETTINGS as any
            }
        });
        
        const resultStream = await chat.sendMessageStream({ message });
        for await (const chunk of resultStream) {
            yield chunk;
        }
    } catch (error) {
        console.warn("Stream Pro failed, falling back to Flash", error);
        const chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            history: optimizedHistory,
            config: {
                systemInstruction,
                tools: [{ googleSearch: {} }],
                safetySettings: SAFETY_SETTINGS as any
            }
        });
        const resultStream = await chat.sendMessageStream({ message });
        for await (const chunk of resultStream) {
            yield chunk;
        }
    }
};

export const verifyFactualClaims = async (text: string): Promise<VerificationResult> => {
    return deduped(`verify-${text.substring(0, 30)}`, async () => {
        const prompt = buildAgentPrompt(PERSONAS.SCOUT, `Verify the following mortgage/financial statement for accuracy using Google Search. Return a JSON object with status (VERIFIED|ISSUES_FOUND|UNVERIFIABLE) and a brief text explanation. Statement: "${text}"`);
        
        const response = await generateContentWithFallback(
            'gemini-3-pro-preview',
            prompt,
            {
                tools: [{ googleSearch: {} }],
                responseMimeType: 'application/json',
                thinkingConfig: { thinkingBudget: 2048, includeThoughts: false }
            },
            'gemini-2.5-flash'
        );

        const json = JSON.parse(response.text);
        const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
        const links = groundingMetadata?.groundingChunks
             ?.map((chunk: any) => chunk.web ? { uri: chunk.web.uri, title: chunk.web.title } : null)
             .filter((link: any) => link !== null) || [];

        return {
            status: json.status || 'UNVERIFIABLE',
            text: json.text || 'Verification incomplete.',
            sources: links
        };
    });
};

// --- Calculator & Analysis Functions (ARCHITECT PERSONA) ---

export const streamAnalyzeLoanScenario = async function* (scenarioData: string) {
    const ai = getAiClient();
    const prompt = buildAgentPrompt(
        PERSONAS.ARCHITECT, 
        `Analyze this loan scenario for risk and optimization. Data: ${scenarioData}. 
        Provide: 1) Risk Assessment (DTI, LTV liquidity). 2) Suggestions to improve (e.g. "Lower LTV to 79% to avoid PMI"). 
        Keep it concise and bulleted.`
    );

    const stream = await ai.models.generateContentStream({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            thinkingConfig: { thinkingBudget: 4096, includeThoughts: false },
            safetySettings: SAFETY_SETTINGS as any
        }
    });

    for await (const chunk of stream) {
        yield chunk.text;
    }
};

export const solveDtiScenario = async (financials: any): Promise<string> => {
    const prompt = buildAgentPrompt(
        PERSONAS.ARCHITECT,
        `Review these financials: ${JSON.stringify(financials)}.
        Problem: DTI is too high or residual income fails.
        Task: Suggest creative but legal structuring solutions (e.g., paying off specific debts, borrower addition, loan program flip from FHA to Conv, using asset depletion).
        Output: Markdown formatted strategy.`
    );

    const response = await generateContentWithFallback(
        'gemini-3-pro-preview',
        prompt,
        { thinkingConfig: { thinkingBudget: 8192, includeThoughts: false } } // High reasoning for Deal Doctor
    );
    return response.text;
};

// --- Market & Rates Functions (SCOUT PERSONA) ---

export const analyzeRateTrends = async (rates: any): Promise<string> => {
    // SCOUT uses Pro for deep correlation
    const prompt = buildAgentPrompt(
        PERSONAS.SCOUT,
        `Analyze these rates compared to current market trends (Search for today's 10yr yield and MBS prices): ${JSON.stringify(rates)}.
        Provide a 3-sentence commentary for a loan officer to send to realtors. Correlation focus.`
    );

    const response = await generateContentWithFallback(
        'gemini-3-pro-preview',
        prompt,
        { 
            tools: [{ googleSearch: {} }],
            thinkingConfig: { thinkingBudget: 2048, includeThoughts: false }
        }
    );
    return response.text;
};

export const organizeScratchpadNotes = async (notes: string): Promise<string> => {
    // Ghostwriter is sufficient here
    const prompt = buildAgentPrompt(PERSONAS.GHOSTWRITER, `Reformat these rough mortgage notes into a clean, bulleted professional summary. Preserve all numbers. Notes: "${notes}"`);
    const response = await generateContentWithFallback('gemini-2.5-flash', prompt, {});
    return response.text;
};

export const generateRateSheetEmail = async (rates: any, notes: string): Promise<string> => {
    const prompt = buildAgentPrompt(
        PERSONAS.GHOSTWRITER,
        `Draft a "Daily Rate Update" email for real estate partners.
        Rates: ${JSON.stringify(rates)}.
        Market Commentary: ${notes}.
        Tone: Brief, valuable, actionable.`
    );
    
    const response = await generateContentWithFallback('gemini-3-pro-preview', prompt, { thinkingConfig: { thinkingBudget: 1024 } });
    return response.text;
};

export const fetchDailyMarketPulse = async (): Promise<{indices: MarketIndex[], news: NewsItem[], sources: any[]}> => {
    return deduped('market-pulse', async () => {
        // SCOUT Persona with Pro model for accurate retrieval
        const prompt = buildAgentPrompt(
            PERSONAS.SCOUT,
            `Get current LIVE market data for: 10-Year Treasury Yield, S&P 500, MBS Pricing (UMBS 5.5), and Brent Crude. 
            Also find 3 top headlines affecting mortgage rates today.
            Return ONLY a valid JSON object with keys: indices (array of {label, value, change, isUp}), news (array of {source, title, summary, category}).`
        );

        const response = await generateContentWithFallback(
            'gemini-3-pro-preview',
            prompt,
            {
                tools: [{ googleSearch: {} }],
                responseMimeType: 'application/json',
                thinkingConfig: { thinkingBudget: 2048 }
            }
        );

        const json = JSON.parse(response.text);
        const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
        const sources = groundingMetadata?.groundingChunks?.map((c: any) => c.web ? {uri: c.web.uri, title: c.web.title} : null).filter((x: any) => x) || [];
        
        return { ...json, sources };
    });
};

// --- Client Intelligence (GHOSTWRITER & ARCHITECT) ---

export const generateClientFriendlyAnalysis = async (context: any): Promise<string> => {
    const prompt = buildAgentPrompt(PERSONAS.GHOSTWRITER, `Translate this market data into a simple paragraph for a home buyer explaining what it means for their mortgage payment today. Data: ${JSON.stringify(context)}`);
    const response = await generateContentWithFallback('gemini-2.5-flash', prompt, {});
    return response.text;
};

export const generateBuyerSpecificAnalysis = async (context: any): Promise<string> => {
    const prompt = buildAgentPrompt(PERSONAS.ARCHITECT, `Analyze the impact of this market data on a specific buyer's purchasing power. Assume a $1M purchase price. Data: ${JSON.stringify(context)}. Explain like a financial advisor.`);
    const response = await generateContentWithFallback('gemini-3-pro-preview', prompt, { thinkingConfig: { thinkingBudget: 2048 } });
    return response.text;
};

export const generateMarketingCampaign = async (topic: string, tone: string): Promise<MarketingCampaign> => {
    const prompt = buildAgentPrompt(
        PERSONAS.GHOSTWRITER, 
        `Create a multi-channel marketing campaign about: "${topic}". Tone: ${tone}.
        Return JSON with keys: linkedInPost, emailSubject, emailBody, smsTeaser.`
    );
    const response = await generateContentWithFallback(
        'gemini-3-pro-preview', 
        prompt, 
        {
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 2048 }
        }
    );
    return JSON.parse(response.text) as MarketingCampaign;
};

export const verifyCampaignContent = async (campaign: MarketingCampaign): Promise<VerificationResult> => {
    const textToCheck = `${campaign.linkedInPost} ${campaign.emailBody}`;
    return verifyFactualClaims(textToCheck);
};

export const streamMorningMemo = async function* (urgentClients: Client[], marketData: any) {
    const ai = getAiClient();
    const prompt = buildAgentPrompt(
        PERSONAS.SCOUT,
        `Generate a "Morning Executive Briefing" for a top loan officer.
        Context:
        - Urgent Clients: ${JSON.stringify(urgentClients.map(c => ({name: c.name, status: c.status, action: c.nextActionDate})))}
        - Market: ${JSON.stringify(marketData.indices)}
        
        Format as a concise Markdown script to be read or viewed in 60 seconds. Highlight immediate actions first.`
    );

    const stream = await ai.models.generateContentStream({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { thinkingConfig: { thinkingBudget: 2048 }, safetySettings: SAFETY_SETTINGS as any }
    });

    for await (const chunk of stream) {
        yield chunk.text;
    }
};

export const generateAudioBriefing = async (text: string): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: { parts: [{ text }] },
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } }
            }
        }
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || '';
};

export const scanPipelineOpportunities = async (clients: Client[], marketData: any): Promise<Opportunity[]> => {
    return deduped('pipeline-scan', async () => {
        const activeClients = clients.filter(c => c.status !== 'Closed').slice(0, 15);
        const prompt = buildAgentPrompt(
            PERSONAS.ARCHITECT,
            `Review this client list against today's market conditions: ${JSON.stringify(marketData)}.
            Clients: ${JSON.stringify(activeClients.map(c => ({id: c.id, name: c.name, rate: 'Unknown', status: c.status})))}.
            Identify up to 3 specific opportunities (e.g. "Call X because rates dropped").
            Return JSON array of objects: {clientId, clientName, trigger, action, priority (HIGH|MEDIUM|LOW)}.`
        );
        
        const response = await generateContentWithFallback(
            'gemini-3-pro-preview',
            prompt,
            {
                responseMimeType: 'application/json',
                thinkingConfig: { thinkingBudget: 2048 }
            }
        );
        return JSON.parse(response.text) as Opportunity[];
    });
};

export const generateGapStrategy = async (currentIncome: number, targetIncome: number, pipeline: any[]): Promise<string> => {
    const prompt = buildAgentPrompt(
        PERSONAS.ARCHITECT,
        `Act as a Sales Manager.
        Current YTD Income: $${currentIncome}. Target: $${targetIncome}. Gap: $${targetIncome - currentIncome}.
        Pipeline: ${JSON.stringify(pipeline)}.
        Generate a strategic plan to close the gap. Focus on conversion and volume.`
    );
    const response = await generateContentWithFallback('gemini-3-pro-preview', prompt, { thinkingConfig: { thinkingBudget: 4096 } });
    return response.text;
};

// --- Client Detail View Functions ---

export const generateEmailDraft = async (client: Client, topic: string, context: string): Promise<string> => {
    const prompt = buildAgentPrompt(PERSONAS.GHOSTWRITER, `Draft an email to ${client.name} regarding "${topic}". Context: ${context}. Client Status: ${client.status}.`);
    const response = await generateContentWithFallback('gemini-2.5-flash', prompt, {});
    return response.text;
};

export const generateSubjectLines = async (client: Client, topic: string): Promise<string[]> => {
    const prompt = buildAgentPrompt(PERSONAS.GHOSTWRITER, `Generate 3 catchy email subject lines for an email about "${topic}" to a mortgage client named ${client.name}. Return as JSON array of strings.`);
    const response = await generateContentWithFallback('gemini-2.5-flash', prompt, { responseMimeType: 'application/json' });
    return JSON.parse(response.text);
};

export const generateClientSummary = async (client: Client): Promise<string> => {
    const prompt = buildAgentPrompt(PERSONAS.ARCHITECT, `Summarize this client file for a "Situation Report": ${JSON.stringify(client)}. Highlight key risks and next steps.`);
    const response = await generateContentWithFallback('gemini-3-pro-preview', prompt, { thinkingConfig: { thinkingBudget: 1024 } });
    return response.text;
};

export const estimatePropertyDetails = async (address: string): Promise<{estimatedValue: number}> => {
    const prompt = buildAgentPrompt(PERSONAS.SCOUT, `Estimate the current value of ${address} using Google Search. Return JSON { "estimatedValue": number }. If unknown, return 0.`);
    const response = await generateContentWithFallback(
        'gemini-2.5-flash', // Flash is sufficient for simple retrieval with search tool
        prompt, 
        { 
            tools: [{ googleSearch: {} }],
            responseMimeType: 'application/json'
        }
    );
    return JSON.parse(response.text);
};

export const generateSmartChecklist = async (client: Client): Promise<string[]> => {
    const prompt = buildAgentPrompt(PERSONAS.ARCHITECT, `Based on the client status "${client.status}", suggest 3-5 next task items. Return JSON array of strings.`);
    const response = await generateContentWithFallback('gemini-2.5-flash', prompt, { responseMimeType: 'application/json' });
    return JSON.parse(response.text);
};

export const generatePartnerUpdate = async (client: Client, partnerName: string): Promise<string> => {
    const prompt = buildAgentPrompt(PERSONAS.GHOSTWRITER, `Draft a status update email to referral partner ${partnerName} about mutual client ${client.name}. Status: ${client.status}.`);
    const response = await generateContentWithFallback('gemini-2.5-flash', prompt, {});
    return response.text;
};

export const generateDealArchitecture = async (client: Client): Promise<DealStrategy[]> => {
    const prompt = buildAgentPrompt(
        PERSONAS.ARCHITECT,
        `Structure 3 loan options for ${client.name} (Loan: $${client.loanAmount}).
        1. Safe (Fixed rate)
        2. Aggressive (ARM/Interest Only)
        3. Balanced
        Return JSON array of { title, type (SAFE|AGGRESSIVE|BALANCED), monthlyPayment (string), pros (string[]), cons (string[]), description }.`
    );
    const response = await generateContentWithFallback(
        'gemini-3-pro-preview',
        prompt,
        { 
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 4096 }
        }
    );
    return JSON.parse(response.text);
};

export const extractClientDataFromImage = async (base64Image: string): Promise<Partial<Client>> => {
    const ai = getAiClient();
    const prompt = buildAgentPrompt(PERSONAS.ARCHITECT, "Extract client details (Name, Email, Phone, Address, Loan Amount) from this document. Return JSON.");
    
    // Direct call as multimodal fallback is complex
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            { text: prompt }
        ],
        config: { responseMimeType: 'application/json' }
    });
    return JSON.parse(response.text);
};

export const generateGiftSuggestions = async (client: Client): Promise<GiftSuggestion[]> => {
    const prompt = buildAgentPrompt(PERSONAS.GHOSTWRITER, `Suggest 3 closing gifts for client ${client.name} based on their notes: "${client.notes}". Return JSON array: { item, reason, priceRange }.`);
    const response = await generateContentWithFallback('gemini-2.5-flash', prompt, { responseMimeType: 'application/json' });
    return JSON.parse(response.text);
};

export const transcribeAudio = async (base64Audio: string): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            { inlineData: { mimeType: 'audio/webm', data: base64Audio } },
            { text: "Transcribe this audio note exactly." }
        ]
    });
    return response.text;
};

export const parseNaturalLanguageCommand = async (command: string, availableStages: string[]): Promise<CommandIntent> => {
    const prompt = buildAgentPrompt(
        PERSONAS.ARCHITECT,
        `Parse this mortgage command: "${command}".
        Available Stages: ${availableStages.join(', ')}.
        Return JSON object matching CommandIntent interface: { action (CREATE_CLIENT|UPDATE_STATUS|UPDATE_CLIENT|ADD_NOTE|ADD_TASK), clientName, payload: { ... } }.`
    );
    const response = await generateContentWithFallback('gemini-2.5-flash', prompt, { responseMimeType: 'application/json' });
    return JSON.parse(response.text);
};

export const generateDailySchedule = async (currentEvents: CalendarEvent[], input: string, clients: Client[]): Promise<CalendarEvent[]> => {
    const prompt = buildAgentPrompt(
        PERSONAS.ARCHITECT,
        `Act as a Chief of Staff.
        Current Schedule: ${JSON.stringify(currentEvents)}.
        User Request: "${input}".
        Client Database: ${JSON.stringify(clients.map(c => ({id: c.id, name: c.name})))}.
        Generate new CalendarEvents to satisfy the request. If it mentions a client, link their ID.
        Return JSON array of CalendarEvent objects.`
    );
    const response = await generateContentWithFallback(
        'gemini-3-pro-preview',
        prompt,
        { 
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 2048 }
        }
    );
    const events = JSON.parse(response.text);
    return events.map((e: any) => ({ ...e, id: `ai-${Date.now()}-${Math.random()}`, isAiGenerated: true }));
};

export const generateMeetingPrep = async (eventTitle: string, client?: Client): Promise<string> => {
    const context = client ? `Client Details: ${JSON.stringify(client)}` : "No specific client record linked.";
    const prompt = buildAgentPrompt(
        PERSONAS.ARCHITECT,
        `Prepare a one-page briefing for a meeting titled "${eventTitle}".
        ${context}.
        Include: Objective, Key Talking Points, Potential Objections, and Next Steps.`
    );
    const response = await generateContentWithFallback('gemini-3-pro-preview', prompt, { thinkingConfig: { thinkingBudget: 1024 } });
    return response.text;
};
