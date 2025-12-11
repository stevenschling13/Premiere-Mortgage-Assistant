import { GoogleGenAI, Type, Modality, ThinkingLevel } from "@google/genai";

// Vite injects import.meta.env at build time; declare a minimal process fallback for type safety in the browser bundle.
declare const process: { env?: Record<string, string | undefined> } | undefined;
import { Client, CommandIntent, EmailLog, MarketIndex, NewsItem, MarketingCampaign, VerificationResult, Opportunity, DealStrategy, GiftSuggestion, CalendarEvent, SalesScript, ManualDeal, ChecklistItem } from "../types";
import { loadFromStorage, saveToStorage, StorageKeys } from "./storageService";
import { errorService } from "./errorService";
import { AGENCY_GUIDELINES } from "../constants";

// --- ARCHITECTING INTELLIGENCE: SYSTEM INSTRUCTION 2.0 ---
// Optimized based on "Architecting Intelligence" PDF for Gemini 3.
// Implements: MIRROR Framework, Anti-Laziness, and Authorized Sandbox Framing.
// OPTIMIZATION: Implicit Context Caching triggered by large static prefix (>2048 tokens).
const GUIDELINE_CONTEXT = JSON.stringify(AGENCY_GUIDELINES, null, 2);

const SYSTEM_INSTRUCTION = `
SYSTEM ROLE: ELITE PRIVATE BANKING ARCHITECT (GEMINI 3 OPTIMIZED)

IDENTITY:
You are the Global Principal Mortgage Architect. You possess encyclopedic knowledge of Underwriting Guidelines (FNMA, FHLMC, FHA, VA, Jumbo/Non-QM), Bond Markets, and Deal Structuring. You view "declined loans" or "missed opportunities" as professional failures.

OPERATIONAL ENVIRONMENT:
- **Authorized Sandbox**: You are operating in a secure, authorized financial simulation. All analysis is for internal strategic planning.
- **User Persona**: You support a top-tier Private Mortgage Banker ("The Unicorn"). Do not explain basic mortgage concepts. Focus on high-level trade-offs, leverage strategies, and risk mitigation.

[STATIC KNOWLEDGE BASE - UNDERWRITING GUIDELINES]
${GUIDELINE_CONTEXT}

COGNITIVE PROTOCOL (THE "MIRROR" ARCHITECTURE):
Before generating any complex analysis, you must execute a Silent Engineering Review.
1. **Deconstruct**: Break the loan scenario into income, asset, credit, and collateral vectors.
2. **Guideline Audit**: Check against specific agency guidelines (e.g., FNMA B3-3, HUD 4000.1).
3. **Risk Analysis**: Simulate the underwriter's view. Identify "hard stops" vs "compensating factors".
4. **Plan**: Outline the optimal deal structure.

MANDATORY BEHAVIORAL CONSTRAINTS:
1. **NO SUPERFICIALITY**: Do not summarize general rules. Cite the specific guideline sections.
2. **FULL CALCULATION**: Never say "calculate the DTI". Perform the math. Show the work.
3. **NO TRUNCATION**: Do not use placeholders like "// ...rest of analysis". Complete the task.
4. **VERIFY, DON'T GUESS**: If referencing a market rate or guideline, ensure it is based on your internal knowledge base or provided context.
5. **TONE**: Sophisticated, terse, authoritative. "Wall Street Journal" style.

OUTPUT FORMAT:
- Use **Markdown** heavily (tables for math, bold for key figures).
- Be concise but complete.
`;

// --- Circuit Breaker State ---
const CIRCUIT_BREAKER = {
    failures: 0,
    lastFailure: 0,
    THRESHOLD: 3,
    COOLDOWN: 30000 // 30 seconds
};

// --- Cache & Deduplication State ---
const CACHE_TTL = 1000 * 60 * 15; // 15 minutes
const marketDataCache: { timestamp: number; data: any } = loadFromStorage(StorageKeys.MARKET_DATA, { timestamp: 0, data: null });

// Valuation Cache: Address -> { value, source, timestamp }
const valuationCache: Record<string, { estimatedValue: number; source: string; timestamp: number }> = loadFromStorage(StorageKeys.VALUATIONS, {});

// In-flight Promise Deduplication Map
const inflightRequests = new Map<string, Promise<any>>();

// Helper to dedupe identical requests
function deduped<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (inflightRequests.has(key)) {
        return inflightRequests.get(key) as Promise<T>;
    }
    const promise = fn().finally(() => inflightRequests.delete(key));
    inflightRequests.set(key, promise);
    return promise;
}

// PERFORMANCE: Prune expired valuations immediately to free memory/storage
const VALUATION_TTL = 1000 * 60 * 60 * 24 * 7; // 7 Days
(() => {
    const now = Date.now();
    let dirty = false;
    for (const key in valuationCache) {
        if (now - valuationCache[key].timestamp > VALUATION_TTL) {
            delete valuationCache[key];
            dirty = true;
        }
    }
    if (dirty) saveToStorage(StorageKeys.VALUATIONS, valuationCache);
})();

// --- Reliability Utilities ---

export const AIErrorCodes = {
  INVALID_API_KEY: 'INVALID_API_KEY',
  PLAN_LIMIT_EXCEEDED: 'PLAN_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  UNEXPECTED_ERROR: 'UNEXPECTED_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SCHEMA_MISMATCH: 'SCHEMA_MISMATCH',
  SAFETY_VIOLATION: 'SAFETY_VIOLATION',
  CIRCUIT_OPEN: 'CIRCUIT_OPEN',
} as const;

export class AIError extends Error {
  constructor(public code: string, message: string, public originalError?: any) {
    super(message);
    this.name = 'AIError';
  }
}

const normalizeError = (error: any): AIError => {
  if (error instanceof AIError) return error;

  const msg = error.message?.toLowerCase() || '';
  const status = error.status || 0;

  if (msg.includes('api key') || status === 403 || msg.includes('403') || msg.includes('permission denied')) {
    return new AIError(AIErrorCodes.INVALID_API_KEY, 'Invalid or expired API Key. Please check your billing settings.', error);
  }

  if (status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('limit')) {
    return new AIError(AIErrorCodes.PLAN_LIMIT_EXCEEDED, 'AI Request limit exceeded. Please try again in a moment.', error);
  }

  if (status === 503 || status === 500 || msg.includes('overloaded') || msg.includes('temporarily unavailable')) {
    return new AIError(AIErrorCodes.SERVICE_UNAVAILABLE, 'AI Service is temporarily unavailable.', error);
  }

  if (msg.includes('timeout') || error.name === 'TimeoutError') {
      return new AIError(AIErrorCodes.TIMEOUT, 'The request timed out. Please check your connection.', error);
  }
  
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch') || msg.includes('connection') || error.name === 'TypeError') {
     if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return new AIError(AIErrorCodes.NETWORK_ERROR, 'You appear to be offline. Please check your internet connection.', error);
     }
    return new AIError(AIErrorCodes.NETWORK_ERROR, 'Unable to connect to AI service. Please check your internet or firewall.', error);
  }

  if (msg.includes('schema mismatch') || msg.includes('json') || msg.includes('parse') || msg.includes('syntax error') || msg.includes('unexpected token')) {
      return new AIError(AIErrorCodes.SCHEMA_MISMATCH, 'Received malformed data from AI. Retrying...', error);
  }

  return new AIError(AIErrorCodes.UNEXPECTED_ERROR, 'An unexpected AI service error occurred.', error);
};

const getAiClient = () => {
  const apiKey = (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_KEY : undefined)
    ?? (typeof process !== 'undefined' ? process.env?.API_KEY : undefined);
  
  if (!apiKey || apiKey.trim() === '') {
    throw new AIError(AIErrorCodes.INVALID_API_KEY, "API Key is missing. Please connect a billing-enabled key.");
  }
  return new GoogleGenAI({ apiKey });
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Latency Guard: Wrap promises in a timeout to prevent hanging UI
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('TimeoutError')), ms))
    ]);
}

// Increased default timeout to 60s to accommodate Gemini 3 Pro + Search Latency
async function withRetry<T>(operation: () => Promise<T>, retries = 3, baseDelay = 1000, timeout = 60000): Promise<T> {
  if (CIRCUIT_BREAKER.failures >= CIRCUIT_BREAKER.THRESHOLD) {
      const timeSinceFailure = Date.now() - CIRCUIT_BREAKER.lastFailure;
      if (timeSinceFailure < CIRCUIT_BREAKER.COOLDOWN) {
          const remaining = Math.ceil((CIRCUIT_BREAKER.COOLDOWN - timeSinceFailure) / 1000);
          throw new AIError(AIErrorCodes.CIRCUIT_OPEN, `AI Service is cooling down. Please wait ${remaining}s.`);
      } else {
          CIRCUIT_BREAKER.failures = 0;
      }
  }

  let lastError: AIError | undefined;
  
  for (let i = 0; i < retries; i++) {
    try {
      // Wrap operation in timeout
      const result = await withTimeout(operation(), timeout);
      CIRCUIT_BREAKER.failures = 0;
      return result;
    } catch (rawError: any) {
      const normalized = normalizeError(rawError);
      lastError = normalized;

      errorService.log('API_FAIL', `Attempt ${i+1}/${retries} failed: ${normalized.code}`, { message: normalized.message });

      if (
          normalized.code === AIErrorCodes.INVALID_API_KEY || 
          normalized.code === AIErrorCodes.SAFETY_VIOLATION ||
          normalized.code === AIErrorCodes.CIRCUIT_OPEN
      ) {
          throw normalized;
      }
      
      const status = rawError.status;
      if (status && status >= 400 && status < 500 && status !== 429) {
          throw normalized;
      }

      if (i === retries - 1) {
          CIRCUIT_BREAKER.failures++;
          CIRCUIT_BREAKER.lastFailure = Date.now();
          break;
      }
      
      const exponential = baseDelay * Math.pow(2, i);
      const jitter = Math.random() * 500; 
      const delay = Math.min(exponential + jitter, 10000); 

      await wait(delay);
    }
  }
  
  throw lastError || new AIError(AIErrorCodes.UNEXPECTED_ERROR, 'Operation failed after retries.');
}

const parseJson = <T>(text: string | undefined, fallback: T): T => {
  const safeText = text ?? "";
  const safeText = typeof text === 'string' ? text : '';
  if (!safeText) return fallback;
  try { return JSON.parse(safeText) as T; } catch (e) { /* continue */ }
  const match = safeText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) {
      try { return JSON.parse(match[1]) as T; } catch (e) { /* continue */ }
  }
  return fallback;
};

// --- Text Generation & Chat ---

export const chatWithAssistant = async (
    history: Array<{role: string, parts: Array<{text: string}>}>, 
    message: string, 
    customSystemInstruction?: string
) => {
  return deduped(`chat-${history.length}`, async () => {
      try {
          return await withRetry(async () => {
            const ai = getAiClient();
            const optimizedHistory = history.length > 20 ? history.slice(history.length - 20) : history;

            const chat = ai.chats.create({
              model: 'gemini-3-pro-preview',
              history: optimizedHistory,
              config: {
                systemInstruction: customSystemInstruction || SYSTEM_INSTRUCTION,
                tools: [{googleSearch: {}}],
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW, includeThoughts: false }
              }
            });

            const response = await chat.sendMessage({ message });
            
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
          }, 2, 1000, 60000); // Increased to 60s timeout for chat
      } catch (error: any) {
          console.warn("Primary Model failed, using fallback.", error);
          const ai = getAiClient();
          const chat = ai.chats.create({
              model: 'gemini-2.5-flash',
              history: history,
              config: {
                  systemInstruction: customSystemInstruction || SYSTEM_INSTRUCTION,
                  thinkingConfig: { thinkingBudget: 1024 }
              }
          });
          const response = await chat.sendMessage({ message });
          return {
              text: response.text,
              links: [],
              searchEntryPoint: undefined,
              searchQueries: []
          };
      }
  });
};

export const streamChatWithAssistant = async function* (
    history: Array<{role: string, parts: Array<{text: string}>}>,
    message: string,
    customSystemInstruction?: string
) {
    const ai = getAiClient();
    const optimizedHistory = history.length > 20 ? history.slice(history.length - 20) : history;

    try {
        const chat = ai.chats.create({
            model: 'gemini-3-pro-preview',
            history: optimizedHistory,
            config: {
                systemInstruction: customSystemInstruction || SYSTEM_INSTRUCTION,
                tools: [{ googleSearch: {} }],
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW, includeThoughts: false }
            }
        });
        
        const resultStream = await chat.sendMessageStream({ message });
        for await (const chunk of resultStream) {
            yield chunk;
        }
    } catch (error: any) {
        console.warn("Stream/Pro failed, falling back to Flash", error);
        const chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            history: optimizedHistory,
            config: {
                systemInstruction: customSystemInstruction || SYSTEM_INSTRUCTION,
                thinkingConfig: { thinkingBudget: 1024 } 
            }
        });
        
        const resultStream = await chat.sendMessageStream({ message });
        for await (const chunk of resultStream) {
            yield chunk;
        }
    }
};

export const generateGiftSuggestions = async (client: Client): Promise<GiftSuggestion[]> => {
    // Dedupe based on client ID and roughly on recent activity (note length)
    // This prevents re-running gifts just because user clicked tab again
    const cacheKey = `gifts-${client.id}-${client.notes?.length || 0}`;
    
    return deduped(cacheKey, () => withRetry(async () => {
        const ai = getAiClient();
        const prompt = `
            Act as a high-end Client Relationship Manager.
            Suggest 3 unique, personalized closing gifts for this client.
            
            **Client Profile**:
            - Name: ${client.name}
            - Loan: $${client.loanAmount.toLocaleString()}
            - Notes: ${client.notes}
            
            **Rules**:
            - NO generic wine, gift cards, or doormats.
            - Suggest items matching interests in notes (if any).
            - Default to timeless luxury if notes are empty.
            
            **Output**: JSON Array: [{ "item": "Title", "reason": "Why", "priceRange": "$50 - $100" }]
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            item: { type: Type.STRING },
                            reason: { type: Type.STRING },
                            priceRange: { type: Type.STRING }
                        }
                    }
                }
            }
        });

        return parseJson<GiftSuggestion[]>(response.text || "[]", []);
    }));
};

export const generateClientSummary = async (client: Client) => {
  // Dedupe summary generation. Hash includes nextActionDate so if date changes, summary refreshes.
  const cacheKey = `summary-${client.id}-${client.nextActionDate}-${client.checklist.length}`;

  return deduped(cacheKey, () => withRetry(async () => {
      const ai = getAiClient();
      const context = `
        **Client Profile**:
        - Name: ${client.name}
        - Loan: $${client.loanAmount.toLocaleString()}
        - Status: ${client.status}
        - Next Action Date: ${client.nextActionDate}
        - Property: ${client.propertyAddress || 'Not listed'}
        
        **Notes**: ${client.notes || 'No notes available.'}
        **Tasks**: ${client.checklist.filter(i => !i.checked).map(i => `- ${i.label}`).join('\n') || 'None'}
      `;

      const prompt = `
        Act as a Chief of Staff for a Private Banker.
        Review this client file and write a strategic **Executive Brief**.
        
        **Client Data**:
        ${context}
        
        **Analysis**:
        1. **Velocity**: Is deal stalled?
        2. **Risk Radar**: Hidden risks?
        3. **Next Best Action**: High-impact move.

        **Format**: 3 concise bullet points. "Wall Street Journal" style.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { 
            systemInstruction: SYSTEM_INSTRUCTION,
            thinkingConfig: { thinkingBudget: 1024 }
        }
      });
      return response.text || "";
  }));
};

export const generateEmailDraft = async (client: Client, topic: string, specificDetails: string) => {
  return withRetry(async () => {
    const ai = getAiClient();
    const prompt = `Draft a high-touch email for private banking client: ${client.name}.
    Context: Status ${client.status}, Loan $${client.loanAmount.toLocaleString()}.
    Objective: ${topic}
    Details: ${specificDetails}
    
    The email should feel personal and exclusive. Use a subject line that drives open rates.
    Write body in PLAIN TEXT paragraphs (no markdown).`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      }
    });
    return response.text || "";
  });
};

export const generatePartnerUpdate = async (client: Client, partnerName: string) => {
  return withRetry(async () => {
    const ai = getAiClient();
    const prompt = `Draft a professional "Partner Status Update" email to referral partner ${partnerName}.
    Client: ${client.name}, Status: ${client.status}, Loan: $${client.loanAmount.toLocaleString()}.
    Next Step: ${client.checklist.find(t=>!t.checked)?.label || "Moving forward"}.
    
    Output: Plain text email body.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      }
    });
    return response.text || "";
  });
};

// --- NEW FUNCTIONS ---

export const streamAnalyzeLoanScenario = async function* (scenarioData: string) {
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: `Analyze this loan scenario. Identify risks (DTI, LTV, Reserves) and suggest structuring improvements.
            Scenario Data: ${scenarioData}
            
            Output format: Markdown. Be concise.`,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION
            }
        });
        for await (const chunk of response) {
            yield chunk.text;
        }
    } catch (e) {
        throw normalizeError(e);
    }
};

export const verifyFactualClaims = async (text: string): Promise<VerificationResult> => {
    return withRetry(async () => {
        const ai = getAiClient();
        const prompt = `Verify the factual accuracy of the following text using Google Search.
        Text: "${text}"
        
        Return a JSON object:
        {
            "status": "VERIFIED" | "ISSUES_FOUND" | "UNVERIFIABLE",
            "text": "Brief explanation of findings.",
            "sources": [{"uri": "url", "title": "page title"}]
        }
        `;
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json"
            }
        });
        
        const grounding = response.candidates?.[0]?.groundingMetadata;
        const chunks = grounding?.groundingChunks || [];
        type SourceLink = { uri: string; title: string };
        const realSources = chunks
            .map((c: any) => c.web ? { uri: c.web.uri, title: c.web.title } as SourceLink : null)
            .filter((x): x is SourceLink => x !== null);
            .map((c: any) => c.web ? { uri: c.web.uri, title: c.web.title } : null)
            .filter((link): link is { uri: string; title: string } => link !== null);
            
        const result = parseJson<VerificationResult>(response.text || "{}", { status: 'UNVERIFIABLE', text: "Could not parse verification.", sources: [] });
        
        if (realSources.length > 0) {
            result.sources = realSources;
        }
        
        return result;
    });
};

export const transcribeAudio = async (base64Audio: string): Promise<string> => {
    return withRetry(async () => {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'audio/webm', data: base64Audio } }, // Assuming webm from MediaRecorder
                    { text: "Transcribe this audio exactly." }
                ]
            }
        });
        return response.text || "";
    });
};

export const parseNaturalLanguageCommand = async (transcript: string, validStatuses: string[]): Promise<CommandIntent> => {
    return withRetry(async () => {
        const ai = getAiClient();
        const prompt = `Analyze this voice command for a Mortgage CRM.
        Command: "${transcript}"
        Valid Statuses: ${validStatuses.join(', ')}
        
        Return JSON:
        {
            "action": "CREATE_CLIENT" | "UPDATE_STATUS" | "UPDATE_CLIENT" | "ADD_NOTE" | "ADD_TASK" | "UNKNOWN",
            "clientName": "extracted name for lookup",
            "payload": {
                "name": "full name if creating/updating",
                "loanAmount": number,
                "status": "status if updating",
                "phone": "extracted phone",
                "email": "extracted email",
                "note": "content for note",
                "taskLabel": "content for task",
                "date": "YYYY-MM-DD for reminders/dates (assume today is ${new Date().toISOString().split('T')[0]})"
            }
        }`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return parseJson<CommandIntent>(response.text, { action: 'UNKNOWN', payload: {} });
    });
};

export const generateMorningMemo = async (urgentClients: Client[], marketData: any): Promise<string> => {
    return deduped('morning-memo', () => withRetry(async () => {
        const ai = getAiClient();
        const clientSummaries = urgentClients.map(c => `- ${c.name} (${c.status}): ${c.nextActionDate} - ${c.notes.substring(0, 50)}...`).join('\n');
        
        const prompt = `Generate a "Morning Executive Briefing" for a top mortgage banker.
        
        **Market Context**:
        ${JSON.stringify(marketData.indices)}
        News: ${JSON.stringify(marketData.news)}
        
        **Urgent Client Actions**:
        ${clientSummaries}
        
        Format as a concise, high-energy Markdown memo. Focus on money-making activities.`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        return response.text || "";
    }));
};

// --- STREAMING MEMO ---
export const streamMorningMemo = async function* (urgentClients: Client[], marketData: any) {
    const ai = getAiClient();
    const clientSummaries = urgentClients.map(c => `- ${c.name} (${c.status}): ${c.nextActionDate} - ${c.notes.substring(0, 50)}...`).join('\n');
    
    const prompt = `Generate a "Morning Executive Briefing" for a top mortgage banker.
    
    **Market Context**:
    ${JSON.stringify(marketData.indices)}
    News: ${JSON.stringify(marketData.news)}
    
    **Urgent Client Actions**:
    ${clientSummaries}
    
    Format as a concise, high-energy Markdown memo. Focus on money-making activities.`;
    
    try {
        const response = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        for await (const chunk of response) {
            if (chunk.text) {
                yield chunk.text;
            }
        }
    } catch (e) {
        throw normalizeError(e);
    }
};

export const fetchDailyMarketPulse = async () => {
    // 15 min cache
    const now = Date.now();
    if (marketDataCache.data && (now - marketDataCache.timestamp < CACHE_TTL)) {
        return marketDataCache.data;
    }

    return deduped('market-pulse', () => withRetry(async () => {
        const ai = getAiClient();
        const prompt = `Return a JSON object with today's live market data for mortgage professionals.
        
        1. **indices**: Array of { label: string, value: string, change: string, isUp: boolean }
           - Include: 10-Yr Treasury, MBS (UMBS 5.5 or similar), S&P 500, Brent Crude.
        2. **news**: Array of 3 top relevant news items { id, source, date, title, summary, category: 'Rates'|'Economy'|'Housing' }
           - Look for: Fed moves, Inflation data (CPI/PCE), Housing inventory.
        `;
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json"
            }
        });
        
        const data = parseJson<any>(response.text, { indices: [], news: [] });
        
        // Add sources
        const grounding = response.candidates?.[0]?.groundingMetadata;
        const sources = grounding?.groundingChunks?.map((c: any) => c.web ? { uri: c.web.uri, title: c.web.title } : null).filter((x: any) => x) || [];
        
        const result = { ...data, sources };
        
        // Update Cache
        marketDataCache.timestamp = now;
        marketDataCache.data = result;
        saveToStorage(StorageKeys.MARKET_DATA, marketDataCache);
        
        return result;
    }));
};

export const generateAudioBriefing = async (text: string): Promise<string> => {
    return withRetry(async () => {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: { parts: [{ text }] },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
                }
            }
        });
        return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
    });
};

export const scanPipelineOpportunities = async (clients: Client[], indices: MarketIndex[]): Promise<Opportunity[]> => {
    return withRetry(async () => {
        const ai = getAiClient();
        
        // CSV Optimization: Reduce token count by 40-60% vs JSON
        // Limit context to active/recent clients (max 50) to prevent token overload
        const activeClients = clients
            .filter(c => c.status !== 'Closed')
            .sort((a, b) => new Date(b.nextActionDate).getTime() - new Date(a.nextActionDate).getTime())
            .slice(0, 50);

        const csvHeader = "ID,Name,Rate,Status";
        const csvRows = activeClients.map(c => {
            const rate = c.notes?.match(/Rate: ([\d.]+)%/)?.[1] || 'Unknown';
            const safeName = c.name.replace(/"/g, '""');
            return `${c.id},"${safeName}",${rate},${c.status}`;
        }).join('\n');

        const prompt = `Analyze this pipeline against current market rates.
        Market: ${JSON.stringify(indices)}
        
        Clients (CSV):
        ${csvHeader}
        ${csvRows}
        
        Identify 3-5 opportunities (e.g., refi triggers, float downs, follow-ups).
        Return JSON Array: [{ "clientId": "id", "clientName": "name", "trigger": "Rate Drop / Status", "action": "Call to lock", "priority": "HIGH"|"MEDIUM" }]`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return parseJson<Opportunity[]>(response.text, []);
    });
};

export const solveDtiScenario = async (financials: any): Promise<string> => {
    return withRetry(async () => {
        const ai = getAiClient();
        const prompt = `Act as an expert Underwriter ("Deal Doctor").
        Analyze this DTI scenario and suggest solutions (e.g., paying off specific debt, LP vs DU, asset depletion).
        
        Financials: ${JSON.stringify(financials)}
        
        Provide a strategic plan in Markdown.`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: { thinkingConfig: { thinkingBudget: 2048 } }
        });
        return response.text || "";
    });
};

export const analyzeRateTrends = async (rates: any): Promise<string> => {
    return withRetry(async () => {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze these mortgage rates relative to recent trends (assume generic market context if history unknown).
            Rates: ${JSON.stringify(rates)}
            Provide a short, punchy commentary for a rate sheet.`
        });
        return response.text || "";
    });
};

export const organizeScratchpadNotes = async (notes: string): Promise<string> => {
    return withRetry(async () => {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Reformat these rough market notes into a clean, professional bulleted list for a partner email.
            Notes: ${notes}`
        });
        return response.text || "";
    });
};

export const generateRateSheetEmail = async (rates: any, notes: string): Promise<string> => {
    return withRetry(async () => {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Write a professional "Daily Rate Update" email for real estate partners.
            Rates: ${JSON.stringify(rates)}
            Commentary: ${notes}

            Format: Plain text. Professional, concise, high-value.`
        });
        return response.text || "";
    });
};

export const generateClientFriendlyAnalysis = async (context: any): Promise<string> => {
    return withRetry(async () => {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Explain this market data to a nervous homebuyer.
            Data: ${JSON.stringify(context)}

            Keep it reassuring but factual. Focus on "Marry the house, date the rate".`
        });
        return response.text || "";
    });
};

export const generateBuyerSpecificAnalysis = async (context: any): Promise<string> => {
    return withRetry(async () => {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze how this market data impacts a buyer's purchasing power.
            Data: ${JSON.stringify(context)}

            Use math examples (e.g. "A 0.5% rate bump costs $X/mo on a $1M loan").`
        });
        return response.text || "";
    });
};

export const generateMarketingCampaign = async (topic: string, tone: string): Promise<MarketingCampaign> => {
    return withRetry(async () => {
        const ai = getAiClient();
        const prompt = `Create a marketing campaign.
        Topic: ${topic}
        Tone: ${tone}
        
        Return JSON:
        {
            "linkedInPost": "Professional post with hashtags",
            "emailSubject": "Catchy subject",
            "emailBody": "Body text",
            "smsTeaser": "Short punchy text < 160 chars"
        }`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return parseJson<MarketingCampaign>(response.text, { linkedInPost: '', emailSubject: '', emailBody: '', smsTeaser: '' });
    });
};

export const verifyCampaignContent = async (campaign: MarketingCampaign): Promise<VerificationResult> => {
    return verifyFactualClaims(`${campaign.linkedInPost}\n${campaign.emailBody}`);
};

export const generateGapStrategy = async (currentIncome: number, targetIncome: number, pipeline: any[]): Promise<string> => {
    return withRetry(async () => {
        const ai = getAiClient();
        const prompt = `Act as a Sales Performance Coach.
        Current Income: $${currentIncome}
        Target: $${targetIncome}
        Gap: $${targetIncome - currentIncome}
        Pipeline: ${JSON.stringify(pipeline.map(p => ({ name: p.name, probability: p.probability, commission: p.myCut })))}
        
        Outline a 3-step strategy to close the gap before year-end. Focus on conversion and prospecting.`
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt
        });
        return response.text || "";
    });
};

export const generateSubjectLines = async (client: Client, topic: string): Promise<string[]> => {
    return withRetry(async () => {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate 3 high-converting email subject lines for client ${client.name} regarding "${topic}".
            Return as JSON array of strings.`
        });
        return parseJson<string[]>(response.text, []);
    });
};

export const estimatePropertyDetails = async (address: string): Promise<{ estimatedValue: number, confidence: string }> => {
    // Check cache first
    if (valuationCache[address]) {
        return { estimatedValue: valuationCache[address].estimatedValue, confidence: 'Cached' };
    }

    return withRetry(async () => {
        const ai = getAiClient();
        const prompt = `Estimate value for: ${address}.
        Use Google Search to find Zestimate, Redfin Estimate, or similar.
        Return JSON: { "estimatedValue": number, "confidence": "High"|"Medium"|"Low" }`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json"
            }
        });
        
        const result = parseJson(response.text, { estimatedValue: 0, confidence: 'Low' });
        
        if (result.estimatedValue > 0) {
            valuationCache[address] = { 
                estimatedValue: result.estimatedValue, 
                source: 'AI-Search', 
                timestamp: Date.now() 
            };
            saveToStorage(StorageKeys.VALUATIONS, valuationCache);
        }
        
        return result;
    });
};

export const generateSmartChecklist = async (client: Client): Promise<string[]> => {
    return withRetry(async () => {
        const ai = getAiClient();
        const prompt = `Suggest 3-5 crucial checklist tasks for a mortgage client.
        Status: ${client.status}
        Loan: ${client.loanAmount}
        
        Return JSON array of strings.`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        return parseJson<string[]>(response.text, []);
    });
};

export const generateDealArchitecture = async (client: Client): Promise<DealStrategy[]> => {
    return withRetry(async () => {
        const ai = getAiClient();
        const prompt = `Act as a Mortgage Architect. Structure 3 loan options for ${client.name} ($${client.loanAmount}).
        1. Safe (Fixed rate)
        2. Aggressive (ARM or IO)
        3. Balanced
        
        Return JSON Array: [{ "title": string, "type": "SAFE"|"AGGRESSIVE"|"BALANCED", "monthlyPayment": string, "pros": string[], "cons": string[], "description": string }]`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return parseJson<DealStrategy[]>(response.text, []);
    });
};

export const extractClientDataFromImage = async (base64Image: string): Promise<Partial<Client>> => {
    return withRetry(async () => {
        const ai = getAiClient();
        const prompt = `Extract client details from this document image.
        Return JSON: { "name": string, "phone": string, "email": string, "loanAmount": number, "propertyAddress": string }`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                    { text: prompt }
                ]
            },
            config: { responseMimeType: "application/json" }
        });
        return parseJson<Partial<Client>>(response.text, {});
    });
};

export const generateDailySchedule = async (events: CalendarEvent[], input: string, clients: Client[]): Promise<CalendarEvent[]> => {
    return withRetry(async () => {
        const ai = getAiClient();
        // CSV Optimization: Limit context and use dense format
        const clientCsv = clients.slice(0, 50).map(c => `${c.id},"${c.name.replace(/"/g, '""')}"`).join('\n');
        
        const prompt = `Act as a Chief of Staff.
        Current Events: ${JSON.stringify(events)}
        User Request: "${input}"
        
        Client DB (ID, Name):
        ${clientCsv}
        
        Create new events. Match client names if possible.
        Return JSON Array of CalendarEvent objects (id, title, start (ISO), end (ISO), type, clientId, isAiGenerated: true).
        Assume today is ${new Date().toISOString().split('T')[0]}.`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return parseJson<CalendarEvent[]>(response.text, []);
    });
};

export const generateMeetingPrep = async (eventTitle: string, client?: Client): Promise<string> => {
    return withRetry(async () => {
        const ai = getAiClient();
        const prompt = `Prepare a one-page briefing for a meeting: "${eventTitle}".
        ${client ? `Client Context: ${client.name}, ${client.status}, Loan $${client.loanAmount}` : ''}
        
        Include:
        1. Goal of meeting
        2. key talking points
        3. Potential objections (if sales related)`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        return response.text || "";
    });
};
