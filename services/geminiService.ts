import { GoogleGenAI, Type, Modality } from "@google/genai";
import { 
    Client, MarketIndex, NewsItem, MarketingCampaign, 
    VerificationResult, CommandIntent, Opportunity, 
    DealStrategy, GiftSuggestion, CalendarEvent 
} from '../types';
import { MORTGAGE_TERMS, INITIAL_SCRIPTS } from '../constants';

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
    ARCHITECT: `You are the Premiere Mortgage Assistant, a sophisticated financial architect. You operate in an Authorized Financial Sandbox. Your goal is to structure complex deals using high-level financial maneuvering.`,
    UNDERWRITER: `You are a Senior DE Underwriter. You analyze risk, guidelines (FNMA/FHLMC/VA), and income structures (RSU, Schedule C) with extreme detail.`,
    SCOUT: `You are a Bond Market Analyst and Bloomberg Terminal Operator. You provide high-frequency market intelligence using only Tier-1 financial sources.`,
    MARKETER: `You are a Luxury Real Estate Marketing Director. You write compelling, high-converting copy for high-net-worth clients.`,
    CHIEF_OF_STAFF: `You are an elite Executive Assistant. You organize schedules, anticipate needs, and prioritize tasks efficiently.`
};

// --- UTILITIES ---

// Request Deduplication to prevent double-firing in React Strict Mode
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

// In-Memory RAG: Retrieve context from constants
const retrieveRelevantContext = async (query: string): Promise<string> => {
    const queryLower = query.toLowerCase();
    
    const relevantTerms = MORTGAGE_TERMS
        .filter(t => queryLower.includes(t.term.toLowerCase()))
        .map(t => `TERM: ${t.term} - ${t.definition}`);
        
    const relevantScripts = INITIAL_SCRIPTS
        .filter(s => queryLower.includes(s.title.toLowerCase()) || s.tags.some(tag => queryLower.includes(tag.toLowerCase())))
        .map(s => `SCRIPT: ${s.title} - ${s.content}`);

    if (relevantTerms.length === 0 && relevantScripts.length === 0) return "";

    return `\n### KNOWLEDGE BASE\n${relevantTerms.join('\n')}\n${relevantScripts.join('\n')}\n`;
};

const buildAgentPrompt = (persona: string, task: string, context: string = "") => {
    return `${persona}\n\n${MIRROR_PROTOCOL}\n${context}\n### TASK\n${task}`;
};

// Centralized Fallback Generator
async function generateContentWithFallback(
    primaryModel: string,
    prompt: string | any,
    config: any,
    fallbackModel: string = 'gemini-2.5-flash'
) {
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: primaryModel,
            contents: typeof prompt === 'string' ? prompt : prompt,
            config: { ...config, safetySettings: SAFETY_SETTINGS as any }
        });
        validateResponse(response);
        return response;
    } catch (error) {
        console.warn(`Model ${primaryModel} failed, falling back to ${fallbackModel}.`, error);
        
        // Strip Pro-specific configs (like thinkingBudget) for fallback
        const { thinkingConfig, ...fallbackConfig } = config || {};
        
        const response = await ai.models.generateContent({
            model: fallbackModel,
            contents: typeof prompt === 'string' ? prompt : prompt,
            config: { ...fallbackConfig, safetySettings: SAFETY_SETTINGS as any }
        });
        validateResponse(response);
        return response;
    }
}

// ------------------------------------------------------------------
// CLIENT MANAGEMENT & SUMMARY
// ------------------------------------------------------------------

export const generateClientSummary = async (client: Client): Promise<string> => {
    const recentEmails = client.emailHistory?.slice(0, 5).map(e => ({ date: e.date, subject: e.subject })) || [];
    const recentTasks = client.checklist?.filter(t => t.checked).slice(0, 5).map(t => t.label) || [];
    
    const context = {
        profile: { 
            name: client.name, 
            loanAmount: client.loanAmount, 
            status: client.status, 
            currentRate: client.currentRate || 'Unknown',
            lastContact: client.nextActionDate
        },
        notes: client.notes?.substring(0, 800),
        recentActivity: { emails: recentEmails, completedTasks: recentTasks }
    };

    const prompt = buildAgentPrompt(
        PERSONAS.ARCHITECT, 
        `Generate an "Executive Status & Activity Summary" for this client.
        Input Data: ${JSON.stringify(context)}.
        
        Requirements:
        1. **Status Health**: Current deal standing.
        2. **Recent Activity**: Narrative summary of recent comms.
        3. **Action Plan**: Next steps.
        
        Output: Concise Markdown.`
    );
    
    const response = await generateContentWithFallback('gemini-3-pro-preview', prompt, { 
        thinkingConfig: { thinkingBudget: 1024 } 
    });
    return response.text || "Summary unavailable.";
};

export const generateEmailDraft = async (client: Client, topic: string, contextStr: string): Promise<string> => {
    const prompt = buildAgentPrompt(
        PERSONAS.MARKETER,
        `Draft a client email.
        Client: ${client.name}, Loan: $${client.loanAmount}, Status: ${client.status}.
        Topic: ${topic}
        Context: ${contextStr}
        
        Return ONLY the email body text.`
    );
    const response = await generateContentWithFallback('gemini-2.5-flash', prompt, {});
    return response.text || "";
};

export const generateSubjectLines = async (client: Client, topic: string): Promise<string[]> => {
    const prompt = buildAgentPrompt(
        PERSONAS.MARKETER,
        `Generate 3 catchy email subject lines for: ${topic} to client ${client.name}.
        Return as JSON array of strings.`
    );
    const response = await generateContentWithFallback('gemini-2.5-flash', prompt, {
        responseMimeType: 'application/json',
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
    });
    try {
        return JSON.parse(response.text || "[]");
    } catch { return []; }
};

export const generatePartnerUpdate = async (client: Client, partnerName: string): Promise<string> => {
    const prompt = buildAgentPrompt(
        PERSONAS.ARCHITECT,
        `Write a professional status update email to referral partner ${partnerName} regarding mutual client ${client.name}.
        Status: ${client.status}.
        Loan: $${client.loanAmount}.
        Notes: ${client.notes?.substring(0, 200)}.
        
        Keep it brief, professional, and confidence-inspiring.`
    );
    const response = await generateContentWithFallback('gemini-2.5-flash', prompt, {});
    return response.text || "";
};

// ------------------------------------------------------------------
// ASSISTANT & CHAT
// ------------------------------------------------------------------

export async function* streamChatWithAssistant(
    history: Array<{role: string, parts: Array<{text: string}>}>, 
    message: string, 
    systemInstruction?: string
) {
    const ai = getAiClient();
    const ragContext = await retrieveRelevantContext(message);
    const finalSystemInstruction = systemInstruction || buildAgentPrompt(PERSONAS.ARCHITECT, "Answer the user's query.", ragContext);

    const optimizedHistory = history.length > 15 ? history.slice(history.length - 15) : history;

    try {
        const chat = ai.chats.create({
            model: 'gemini-3-pro-preview',
            history: optimizedHistory,
            config: {
                systemInstruction: finalSystemInstruction,
                thinkingConfig: { thinkingBudget: 4096, includeThoughts: false },
                tools: [{ googleSearch: {} }],
                safetySettings: SAFETY_SETTINGS as any
            }
        });

        const result = await chat.sendMessageStream({ message });
        for await (const chunk of result) {
            yield chunk;
        }
    } catch (e) {
        console.warn("Pro Chat failed, fallback to Flash");
        const chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            history: optimizedHistory,
            config: {
                systemInstruction: finalSystemInstruction,
                tools: [{ googleSearch: {} }],
                safetySettings: SAFETY_SETTINGS as any
            }
        });
        const result = await chat.sendMessageStream({ message });
        for await (const chunk of result) {
            yield chunk;
        }
    }
}

export const verifyFactualClaims = async (text: string): Promise<VerificationResult> => {
    return deduped(`verify-${text.substring(0, 30)}`, async () => {
        const prompt = buildAgentPrompt(
            PERSONAS.SCOUT,
            `Verify the factual accuracy of this text using Google Search.
            Text: "${text}"
            
            Output strictly in this JSON format:
            {
                "status": "VERIFIED" | "ISSUES_FOUND" | "UNVERIFIABLE",
                "text": "Brief audit report explaining any inaccuracies.",
                "sources": [{"uri": "url", "title": "title"}]
            }`
        );

        const response = await generateContentWithFallback('gemini-3-pro-preview', prompt, {
            tools: [{ googleSearch: {} }],
            thinkingConfig: { thinkingBudget: 2048 }
        }, 'gemini-2.5-flash');

        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const sources = groundingChunks
            .map((c: any) => c.web ? { uri: c.web.uri, title: c.web.title } : null)
            .filter((x: any) => x !== null);

        let parsed: any = { status: 'UNVERIFIABLE', text: 'Could not parse verification result.' };
        try {
            const cleaned = response.text?.replace(/```json/g, '').replace(/```/g, '').trim();
            parsed = JSON.parse(cleaned || "{}");
        } catch (e) {
            parsed.text = response.text;
        }

        return {
            status: parsed.status || 'UNVERIFIABLE',
            text: parsed.text || response.text || '',
            sources: sources.length > 0 ? sources : (parsed.sources || [])
        };
    });
};

export const parseNaturalLanguageCommand = async (input: string, validStages: string[]): Promise<CommandIntent> => {
    const prompt = buildAgentPrompt(
        PERSONAS.ARCHITECT,
        `Parse this mortgage assistant command: "${input}".
        Valid Stages: ${validStages.join(', ')}.
        Return JSON object matching CommandIntent interface.
        Key Mappings: "Rate" -> payload.rate (number). "Scan" -> SCAN_PIPELINE.`
    );

    const response = await generateContentWithFallback('gemini-2.5-flash', prompt, {
        responseMimeType: 'application/json',
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                action: { type: Type.STRING, enum: ['CREATE_CLIENT', 'UPDATE_STATUS', 'UPDATE_CLIENT', 'ADD_NOTE', 'ADD_TASK', 'SCAN_PIPELINE', 'UNKNOWN'] },
                clientName: { type: Type.STRING },
                payload: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        loanAmount: { type: Type.NUMBER },
                        status: { type: Type.STRING },
                        phone: { type: Type.STRING },
                        email: { type: Type.STRING },
                        note: { type: Type.STRING },
                        taskLabel: { type: Type.STRING },
                        date: { type: Type.STRING },
                        rate: { type: Type.NUMBER }
                    }
                }
            },
            required: ['action', 'payload']
        }
    });

    return JSON.parse(response.text || "{}");
};

// ------------------------------------------------------------------
// MARKET INTELLIGENCE
// ------------------------------------------------------------------

export const fetchDailyMarketPulse = async (): Promise<{ indices: MarketIndex[], news: NewsItem[], sources: {uri:string, title:string}[] }> => {
    return deduped('market-pulse', async () => {
        const prompt = buildAgentPrompt(
            PERSONAS.SCOUT,
            `Get current LIVE market data.
            1. Values: 10-Year Treasury, S&P 500, UMBS 5.5, Brent Crude.
            2. News: 3 most important mortgage headlines.
            
            Output JSON: { "indices": [...], "news": [...] }`
        );

        const response = await generateContentWithFallback('gemini-3-pro-preview', prompt, {
            tools: [{ googleSearch: {} }],
            thinkingConfig: { thinkingBudget: 2048 },
            responseMimeType: 'application/json'
        }, 'gemini-2.5-flash');

        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const sources = groundingChunks
            .map((c: any) => c.web ? { uri: c.web.uri, title: c.web.title } : null)
            .filter((x: any) => x !== null);

        let data = { indices: [], news: [] };
        try {
            data = JSON.parse(response.text || "{}");
        } catch (e) {
            console.error("Failed to parse market data JSON", e);
        }

        return {
            indices: data.indices || [],
            news: data.news || [],
            sources
        };
    });
};

export const generateClientFriendlyAnalysis = async (context: any): Promise<string> => {
    const prompt = buildAgentPrompt(
        PERSONAS.ARCHITECT,
        `Write a "Daily Brief" for clients explaining how today's market data impacts mortgage rates.
        Data: ${JSON.stringify(context)}.
        Keep it simple, advisory, and reassuring.`
    );
    const response = await generateContentWithFallback('gemini-2.5-flash', prompt, {});
    return response.text || "";
};

export const generateBuyerSpecificAnalysis = async (context: any): Promise<string> => {
    const prompt = buildAgentPrompt(
        PERSONAS.ARCHITECT,
        `Analyze impact for active buyers (Purchasing Power focus).
        Data: ${JSON.stringify(context)}.
        Explain if today is a good day to lock or float.`
    );
    const response = await generateContentWithFallback('gemini-2.5-flash', prompt, {});
    return response.text || "";
};

export const generateMarketingCampaign = async (topic: string, tone: string): Promise<MarketingCampaign> => {
    const prompt = buildAgentPrompt(
        PERSONAS.MARKETER,
        `Create a multi-channel marketing campaign about: "${topic}". Tone: ${tone}.`
    );
    
    const response = await generateContentWithFallback('gemini-3-pro-preview', prompt, {
        responseMimeType: 'application/json',
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                linkedInPost: { type: Type.STRING },
                emailSubject: { type: Type.STRING },
                emailBody: { type: Type.STRING },
                smsTeaser: { type: Type.STRING }
            },
            required: ['linkedInPost', 'emailSubject', 'emailBody', 'smsTeaser']
        },
        thinkingConfig: { thinkingBudget: 2048 }
    });
    
    return JSON.parse(response.text || "{}");
};

export const verifyCampaignContent = async (campaign: MarketingCampaign): Promise<VerificationResult> => {
    return verifyFactualClaims(campaign.emailBody + " " + campaign.linkedInPost);
};

// ------------------------------------------------------------------
// PIPELINE & CALCULATORS
// ------------------------------------------------------------------

export const scanPipelineOpportunities = async (clients: Client[], marketIndices: MarketIndex[]): Promise<Opportunity[]> => {
    return deduped('pipeline-scan', async () => {
        const activeClients = clients.filter(c => c.status !== 'Closed').slice(0, 20);
        const prompt = buildAgentPrompt(
            PERSONAS.ARCHITECT,
            `Analyze this client pipeline against LIVE market data: ${JSON.stringify(marketIndices)}.
            
            Clients: ${JSON.stringify(activeClients.map(c => ({
                id: c.id, 
                name: c.name, 
                currentRate: c.currentRate || 'Unknown', 
                status: c.status,
                balance: c.loanAmount,
                notes: c.notes?.substring(0, 100)
            })))}.

            TASK:
            1. Identify clients whose 'currentRate' is significantly higher (>0.5%) than today's market rates (estimate market rate from 10yr yield/MBS data).
            2. Identify 'Equity' or 'Cash-Out' plays based on notes.
            3. Ignore clients with 'Unknown' rates unless notes suggest urgency.

            Return JSON array of Opportunity objects.`
        );
        
        const response = await generateContentWithFallback(
            'gemini-3-pro-preview',
            prompt,
            {
                responseMimeType: 'application/json',
                thinkingConfig: { thinkingBudget: 4096 } // Higher budget for rate math
            }
        );
        return JSON.parse(response.text || "[]");
    });
};

export async function* streamMorningMemo(urgentClients: Client[], marketData: any) {
    const ai = getAiClient();
    const prompt = buildAgentPrompt(
        PERSONAS.CHIEF_OF_STAFF,
        `Generate an audio-script style "Morning Memo" for the Mortgage Banker.
        
        Urgent Clients: ${JSON.stringify(urgentClients.map(c => ({ name: c.name, status: c.status })))}.
        Market: ${JSON.stringify(marketData.indices)}.
        News: ${JSON.stringify(marketData.news?.[0]?.title)}.
        
        Format: "Good morning. Here is your briefing..."`
    );

    const stream = await ai.models.generateContentStream({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { thinkingConfig: { thinkingBudget: 2048 } }
    });

    for await (const chunk of stream) {
        yield chunk.text;
    }
}

export const generateAudioBriefing = async (text: string): Promise<string> => {
    const ai = getAiClient();
    try {
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
        return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
    } catch (e) {
        console.error("TTS Failed", e);
        return "";
    }
};

export async function* streamAnalyzeLoanScenario(scenarioText: string) {
    const ai = getAiClient();
    const prompt = buildAgentPrompt(
        PERSONAS.ARCHITECT,
        `Analyze this Jumbo Loan Scenario for risk and structure.
        Scenario: ${scenarioText}.
        
        Cover:
        1. DTI/LTV Risk Assessment.
        2. Reserve Requirements (typical).
        3. Potential pitfalls (appraisal, large deposits).
        
        Format: Markdown.`
    );
    
    const stream = await ai.models.generateContentStream({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { thinkingConfig: { thinkingBudget: 4096 } }
    });

    for await (const chunk of stream) {
        yield chunk.text;
    }
}

export const solveDtiScenario = async (financials: any): Promise<string> => {
    const prompt = buildAgentPrompt(
        PERSONAS.UNDERWRITER,
        `Act as "Deal Doctor". Solve this high DTI scenario.
        Financials: ${JSON.stringify(financials)}.
        
        Suggest:
        1. Paying off specific debts (calculate DTI impact).
        2. Borrower removal (if applicable).
        3. Income grossing up (if applicable).
        
        Show math.`
    );

    const response = await generateContentWithFallback('gemini-3-pro-preview', prompt, {
        thinkingConfig: { thinkingBudget: 8192 }
    });
    return response.text || "";
};

// ------------------------------------------------------------------
// RATES & NOTES
// ------------------------------------------------------------------

export const analyzeRateTrends = async (rates: any): Promise<string> => {
    const prompt = buildAgentPrompt(
        PERSONAS.SCOUT,
        `Analyze these rates compared to typical market spread: ${JSON.stringify(rates)}. Comment on the yield curve implication.`
    );
    const response = await generateContentWithFallback('gemini-3-pro-preview', prompt, {
        thinkingConfig: { thinkingBudget: 2048 }
    });
    return response.text || "";
};

export const organizeScratchpadNotes = async (notes: string): Promise<string> => {
    const prompt = buildAgentPrompt(
        PERSONAS.CHIEF_OF_STAFF,
        `Reformat these raw mortgage notes into bullet points grouped by topic (Rates, Clients, To-Do).
        Notes: "${notes}"`
    );
    const response = await generateContentWithFallback('gemini-2.5-flash', prompt, {});
    return response.text || "";
};

export const generateRateSheetEmail = async (rates: any, notes: string): Promise<string> => {
    const prompt = buildAgentPrompt(
        PERSONAS.MARKETER,
        `Draft a "Partner Rate Update" email.
        Rates: ${JSON.stringify(rates)}.
        Market Notes: ${notes}.
        
        Style: Professional, concise, authoritative.`
    );
    const response = await generateContentWithFallback('gemini-3-pro-preview', prompt, {
        thinkingConfig: { thinkingBudget: 1024 }
    });
    return response.text || "";
};

// ------------------------------------------------------------------
// COMPENSATION
// ------------------------------------------------------------------

export const generateGapStrategy = async (current: number, target: number, pipeline: any[]): Promise<string> => {
    const gap = target - current;
    const prompt = buildAgentPrompt(
        PERSONAS.ARCHITECT,
        `Develop a strategy to close the income gap of $${gap.toLocaleString()}.
        Current Pipeline: ${JSON.stringify(pipeline)}.
        
        Advise on:
        1. Which pipeline deals to prioritize.
        2. How many new leads needed based on typical conversion.`
    );
    
    const response = await generateContentWithFallback('gemini-3-pro-preview', prompt, {
        thinkingConfig: { thinkingBudget: 4096 }
    });
    return response.text || "";
};

// ------------------------------------------------------------------
// CLIENT DETAILS (Architect, Images, etc)
// ------------------------------------------------------------------

export const estimatePropertyDetails = async (address: string): Promise<{ estimatedValue: number }> => {
    const prompt = buildAgentPrompt(PERSONAS.SCOUT, `Estimate value for: ${address}. Return JSON: { "estimatedValue": number }.`);
    // Using search to find Zillow/Redfin data implicitly via model knowledge + search tool
    const response = await generateContentWithFallback('gemini-2.5-flash', prompt, {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json'
    });
    
    try {
        const clean = response.text?.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(clean || "{\"estimatedValue\": 0}");
    } catch { return { estimatedValue: 0 }; }
};

export const generateSmartChecklist = async (client: Client): Promise<string[]> => {
    const prompt = buildAgentPrompt(PERSONAS.ARCHITECT, `Generate 3-5 specific checklist tasks for a mortgage client in "${client.status}" stage.
    Client info: ${client.name}, ${client.loanAmount}.
    Return JSON array of strings.`);
    
    const response = await generateContentWithFallback('gemini-2.5-flash', prompt, {
        responseMimeType: 'application/json',
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
    });
    return JSON.parse(response.text || "[]");
};

export const generateDealArchitecture = async (client: Client): Promise<DealStrategy[]> => {
    const prompt = buildAgentPrompt(
        PERSONAS.ARCHITECT,
        `Generate 3 mortgage loan structuring options (Safe, Balanced, Aggressive) for:
        ${JSON.stringify({ loan: client.loanAmount, rate: client.currentRate, status: client.status })}.
        Return JSON array of DealStrategy objects.`
    );
    
    const response = await generateContentWithFallback('gemini-3-pro-preview', prompt, {
        responseMimeType: 'application/json',
        responseSchema: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ['SAFE', 'AGGRESSIVE', 'BALANCED'] },
                    monthlyPayment: { type: Type.STRING },
                    pros: { type: Type.ARRAY, items: { type: Type.STRING } },
                    cons: { type: Type.ARRAY, items: { type: Type.STRING } },
                    description: { type: Type.STRING }
                },
                required: ['title', 'type', 'monthlyPayment', 'pros', 'cons', 'description']
            }
        },
        thinkingConfig: { thinkingBudget: 4096 }
    });
    return JSON.parse(response.text || "[]");
};

export const extractClientDataFromImage = async (base64Image: string): Promise<Partial<Client>> => {
    const prompt = "Extract client details (Name, Address, Loan Amount, Rate, Phone, Email) from this document. Return JSON.";
    
    // Robust fallback handling
    const response = await generateContentWithFallback(
        'gemini-2.5-flash',
        {
            parts: [
                { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                { text: prompt }
            ]
        },
        { responseMimeType: 'application/json' }
    );
    
    return JSON.parse(response.text || "{}");
};

export const generateGiftSuggestions = async (client: Client): Promise<GiftSuggestion[]> => {
    const prompt = buildAgentPrompt(PERSONAS.MARKETER, `Suggest 3 closing gifts for client ${client.name}, loan size $${client.loanAmount}. Return JSON.`);
    const response = await generateContentWithFallback('gemini-2.5-flash', prompt, {
        responseMimeType: 'application/json',
        responseSchema: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    item: { type: Type.STRING },
                    reason: { type: Type.STRING },
                    priceRange: { type: Type.STRING }
                },
                required: ['item', 'reason', 'priceRange']
            }
        }
    });
    return JSON.parse(response.text || "[]");
};

export const transcribeAudio = async (base64Audio: string): Promise<string> => {
    const response = await generateContentWithFallback(
        'gemini-2.5-flash',
        {
            parts: [
                { inlineData: { mimeType: 'audio/webm', data: base64Audio } },
                { text: "Transcribe this audio exactly." }
            ]
        },
        {}
    );
    return response.text || "";
};

// ------------------------------------------------------------------
// PLANNER
// ------------------------------------------------------------------

export const generateDailySchedule = async (currentEvents: CalendarEvent[], input: string, clients: Client[], targetDate?: string): Promise<CalendarEvent[]> => {
    const dateContext = targetDate || new Date().toISOString().split('T')[0];

    const prompt = buildAgentPrompt(
        PERSONAS.CHIEF_OF_STAFF,
        `Act as Chief of Staff. Update the schedule for ${dateContext} based on: "${input}".
        Current Schedule for ${dateContext}: ${JSON.stringify(currentEvents)}.
        Available Clients: ${JSON.stringify(clients.map(c => ({ id: c.id, name: c.name })))}.
        
        If input implies meeting a client, link clientId.
        Return JSON array of NEW CalendarEvents to add.
        IMPORTANT: Ensure all ISO timestamps use the date ${dateContext} (e.g. "${dateContext}T09:00:00").`
    );
    
    const response = await generateContentWithFallback('gemini-3-pro-preview', prompt, {
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 2048 }
    });
    
    // Helper to ensure dates are correct if not specified by LLM
    const events: CalendarEvent[] = JSON.parse(response.text || "[]");
    return events.map(e => ({
        ...e,
        // Guard against LLM returning time-only or wrong date
        start: e.start.includes('T') ? e.start : `${dateContext}T${e.start}`,
        end: e.end.includes('T') ? e.end : `${dateContext}T${e.end}`,
        isAiGenerated: true
    }));
};

export const generateMeetingPrep = async (eventTitle: string, client?: Client): Promise<string> => {
    const prompt = buildAgentPrompt(
        PERSONAS.CHIEF_OF_STAFF,
        `Prepare a 1-page briefing for meeting: "${eventTitle}".
        Client Context: ${client ? JSON.stringify(client) : "Unknown"}.
        
        Include:
        1. Objective.
        2. Key talking points.
        3. Potential objections (if client).`
    );
    const response = await generateContentWithFallback('gemini-2.5-flash', prompt, {});
    return response.text || "";
};
