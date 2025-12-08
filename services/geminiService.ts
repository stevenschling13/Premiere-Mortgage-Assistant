import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Client, CommandIntent, EmailLog, MarketIndex, NewsItem, MarketingCampaign, VerificationResult } from "../types";
import { loadFromStorage, saveToStorage, StorageKeys } from "./storageService";

const SYSTEM_INSTRUCTION = `You are the "Premiere Private Banking Assistant", an elite AI designed for high-net-worth mortgage banking. 
Your demeanor is sophisticated, precise, and anticipatory.

**STYLE & FORMATTING GUIDELINES**:
1. **HUMAN TONE**: Write naturally, as if you are a senior colleague sending a quick memo. Avoid robotic transitions like "Here is the output".
2. **FORMATTING**: Use **Markdown** to organize your thoughts.
   - Use **bold** for key figures, rates, or emphatic points.
   - Use bullet points (-) for lists or breakdowns.
   - Use paragraphs for narrative.
3. **CLARITY**: Keep it punchy. High-net-worth clients value time.

**CRITICAL DATA INTEGRITY RULE**:
- You must **ONLY** rely on and cite data from Tier-1 Financial Sources.
- **Allowed Sources**: Bloomberg, Wall Street Journal (WSJ), CNBC, Federal Reserve (.gov), Mortgage News Daily, HousingWire, Redfin/Zillow Research, U.S. Treasury Department.
- If data is ambiguous or unavailable from these sources, explicitly state: "Data verification unavailable from Tier-1 sources."

**Your User's Context (The "Unicorn" Role)**:
- **Role**: Private Mortgage Banker (Hybrid Model).
- **Compensation**: Base Salary ($51,001/yr) + Commission.
- **Commission Structure**: You receive a 15% cut of the Gross Commission.
- **Volume Model**: "Volume Arbitrage" (High volume from bank referrals, lower bps).
- **Target Income**: ~$108,750/yr (Target Volume: $70M).

**You specialize in**:
1.  **Market Authority**: Use Google Search to provide real-time bond market movements (10yr Treasury, MBS) and synthesize this into actionable advice.
2.  **Complex Deal Structuring**: Analyzing jumbo loans, trust income, and RSU/Asset depletion scenarios.
3.  **High-Touch Communication**: Drafting white-glove emails.
`;

// --- Cache State ---
const CACHE_TTL = 1000 * 60 * 15; // 15 minutes
const marketDataCache: { timestamp: number; data: any } = loadFromStorage(StorageKeys.MARKET_DATA, { timestamp: 0, data: null });

// Valuation Cache: Address -> { value, source, timestamp }
const valuationCache: Record<string, { estimatedValue: number; source: string; timestamp: number }> = loadFromStorage(StorageKeys.VALUATIONS, {});

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

// In-flight promise tracking
let activeMarketPulsePromise: Promise<{ indices: MarketIndex[], news: NewsItem[], sources?: any[] }> | null = null;
const activeValuationPromises = new Map<string, Promise<{ estimatedValue: number, source: string }>>();

// --- Reliability Utilities ---

// Standardized Error Codes
export const AIErrorCodes = {
  INVALID_API_KEY: 'INVALID_API_KEY',
  PLAN_LIMIT_EXCEEDED: 'PLAN_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  UNEXPECTED_ERROR: 'UNEXPECTED_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SCHEMA_MISMATCH: 'SCHEMA_MISMATCH',
} as const;

export class AIError extends Error {
  constructor(public code: string, message: string, public originalError?: any) {
    super(message);
    this.name = 'AIError';
  }
}

const normalizeError = (error: any): AIError => {
  const msg = error.message?.toLowerCase() || '';
  const status = error.status || 0;

  // Auth / Permissions
  if (msg.includes('api key') || status === 403 || msg.includes('403') || msg.includes('permission denied')) {
    return new AIError(AIErrorCodes.INVALID_API_KEY, 'Invalid or expired API Key. Please check your billing settings.', error);
  }

  // Quotas / Limits
  if (status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('limit')) {
    return new AIError(AIErrorCodes.PLAN_LIMIT_EXCEEDED, 'AI Request limit exceeded. Please try again in a moment.', error);
  }

  // Availability
  if (status === 503 || status === 500 || msg.includes('overloaded') || msg.includes('temporarily unavailable')) {
    return new AIError(AIErrorCodes.SERVICE_UNAVAILABLE, 'AI Service is temporarily unavailable.', error);
  }

  // Network / Timeout
  if (msg.includes('timeout') || error.name === 'TimeoutError') {
      return new AIError(AIErrorCodes.TIMEOUT, 'The request timed out. Please check your connection.', error);
  }
  
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch') || msg.includes('connection') || error.name === 'TypeError') {
     if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return new AIError(AIErrorCodes.NETWORK_ERROR, 'You appear to be offline. Please check your internet connection.', error);
     }
    return new AIError(AIErrorCodes.NETWORK_ERROR, 'Unable to connect to AI service. Please check your internet or firewall.', error);
  }

  // Schema Mismatch
  if (msg.includes('schema mismatch') || msg.includes('json') || msg.includes('parse') || msg.includes('syntax error') || msg.includes('unexpected token')) {
      return new AIError(AIErrorCodes.SCHEMA_MISMATCH, 'Received malformed data from AI. Retrying...', error);
  }

  // Fallback
  return new AIError(AIErrorCodes.UNEXPECTED_ERROR, 'An unexpected AI service error occurred.', error);
};

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new AIError(AIErrorCodes.INVALID_API_KEY, "API Key is missing. Please connect a billing-enabled key.");
  }
  return new GoogleGenAI({ apiKey });
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(operation: () => Promise<T>, retries = 5, baseDelay = 1000): Promise<T> {
  let lastError: AIError | undefined;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (rawError: any) {
      const normalized = normalizeError(rawError);
      lastError = normalized;

      // Fail Fast conditions:
      // 1. Invalid API Key (Retrying won't fix it)
      // 2. Client Errors (400-499) except 429 (Rate Limit)
      if (normalized.code === AIErrorCodes.INVALID_API_KEY) throw normalized;
      
      const status = rawError.status;
      if (status && status >= 400 && status < 500 && status !== 429) {
          throw normalized;
      }

      // If we've exhausted retries, throw
      if (i === retries - 1) {
          if (normalized.code === AIErrorCodes.SCHEMA_MISMATCH) {
              normalized.message = "The AI response could not be processed after multiple attempts. Please try again.";
          } else if (normalized.code === AIErrorCodes.NETWORK_ERROR) {
              normalized.message = normalized.message + " (Retries exhausted)";
          }
          break;
      }
      
      // Exponential Backoff with Jitter
      // Formula: base * 2^i + random_jitter
      const exponential = baseDelay * Math.pow(2, i);
      const jitter = Math.random() * 500; 
      const delay = Math.min(exponential + jitter, 15000); // Cap at 15s

      console.warn(`AI Attempt ${i + 1} failed (${normalized.code}). Retrying in ${Math.round(delay)}ms...`);
      await wait(delay);
    }
  }
  
  throw lastError || new AIError(AIErrorCodes.UNEXPECTED_ERROR, 'Operation failed after retries.');
}

// Helper for defensive JSON parsing with stack balancing
const parseJson = <T>(text: string, fallback: T): T => {
  if (!text) return fallback;

  // 1. FAST PATH: Try direct parse first (O(1) setup vs Regex O(N))
  // This optimizes for the "Happy Path" where the model returns clean JSON.
  try { return JSON.parse(text) as T; } catch (e) { /* continue */ }

  // 2. Try extracting from markdown blocks
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) {
      try { return JSON.parse(match[1]) as T; } catch (e) { /* continue to other methods */ }
  }
    
  // 3. Robust Stack-Based Extractor (Heavy, use as last resort)
  try {
        // Safety guard: Don't scan massive hallucinations which could freeze the main thread
        if (text.length > 100000) throw new Error("Output too large for stack parser");

        const firstCurly = text.indexOf('{');
        const firstSquare = text.indexOf('[');
        
        let start = -1;
        let mode: 'object' | 'array' | null = null;

        // Determine starting point
        if (firstCurly !== -1 && (firstSquare === -1 || firstCurly < firstSquare)) {
            start = firstCurly;
            mode = 'object';
        } else if (firstSquare !== -1) {
            start = firstSquare;
            mode = 'array';
        }

        if (start !== -1 && mode) {
            let balance = 0;
            let inString = false;
            let escape = false;
            
            for (let i = start; i < text.length; i++) {
                const char = text[i];
                
                if (escape) {
                    escape = false;
                    continue;
                }
                
                if (char === '\\') {
                    escape = true;
                    continue;
                }
                
                if (char === '"') {
                    inString = !inString;
                    continue;
                }
                
                if (!inString) {
                    if (mode === 'object') {
                        if (char === '{') balance++;
                        if (char === '}') balance--;
                    } else {
                        if (char === '[') balance++;
                        if (char === ']') balance--;
                    }
                    
                    if (balance === 0) {
                        // Found valid balanced end
                        const candidate = text.substring(start, i + 1);
                        return JSON.parse(candidate) as T;
                    }
                }
            }
        }
  } catch (e3) {
      console.warn("JSON Parse Exhausted", e3);
  }
    
  return fallback;
};

// --- Text Generation & Chat ---

export const generateClientSummary = async (client: Client) => {
  return withRetry(async () => {
      const ai = getAiClient();
      
      // Construct a context-rich prompt
      const context = `
        **Client Profile**:
        - Name: ${client.name}
        - Loan Amount: $${client.loanAmount.toLocaleString()}
        - Status: ${client.status}
        - Next Action Date: ${client.nextActionDate}
        - Property Address: ${client.propertyAddress || 'Not listed'}
        
        **Notes Log**:
        ${client.notes || 'No notes available.'}
        
        **Pending Tasks**:
        ${client.checklist.filter(i => !i.checked).map(i => `- ${i.label}`).join('\n') || 'No pending tasks.'}
      `;

      const prompt = `
        Act as a Chief of Staff for a Private Banker.
        Review this client file and write a strategic **Executive Brief**.
        
        **Client Data**:
        ${context}
        
        **Analysis Requirements**:
        1. **Deal Velocity**: Is the deal moving or stalled? (Check dates vs status).
        2. **Risk Radar**: Identify hidden risks in notes, missing items, or staleness.
        3. **Next Best Action**: The single most high-impact move to close this deal.

        **Format**:
        - 3 concise bullet points.
        - Use **bold** for key insights.
        - Tone: "Wall Street Journal" style - terse, professional, high-value.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingBudget: 2048 } // Deep thinking for risk analysis
        }
      });
      return response.text;
  });
};

export const generateEmailDraft = async (client: Client, topic: string, specificDetails: string) => {
  return withRetry(async () => {
    const ai = getAiClient();
    const prompt = `Draft a high-touch email for private banking client: ${client.name}.
    
    **Client Context**:
    - Status: ${client.status}
    - Loan: $${client.loanAmount.toLocaleString()} (${client.propertyAddress})
    
    **Objective**: ${topic}
    **Key Details to Cover**: ${specificDetails}
    
    The email should feel personal and exclusive. Use a subject line that drives open rates.
    **IMPORTANT**: Write the body in PLAIN TEXT paragraphs (no markdown) so it can be easily copied into Outlook.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      }
    });
    return response.text;
  });
};

export const generateSubjectLines = async (client: Client, topic: string): Promise<string[]> => {
  // Note: We handle error inside to return empty array for non-critical UI features
  try {
      return await withRetry(async () => {
        const ai = getAiClient();
        const prompt = `Generate 3 high-performing email subject lines for a private banking client named ${client.name}.
        
        **Topic**: ${topic}
        **Context**:
        - Loan Amount: $${client.loanAmount.toLocaleString()}
        - Status: ${client.status}
        
        **Requirements**:
        - Professional yet compelling.
        - High open rate potential.
        - Concise.
        
        Return ONLY the 3 subject lines as a JSON array of strings.`;

        const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        }
        });

        return parseJson<string[]>(response.text || "[]", []);
      });
  } catch (error) {
    console.error("Error generating subject lines:", error);
    return [];
  }
};

// --- Marketing Studio ---

export const generateMarketingCampaign = async (topic: string, tone: string): Promise<MarketingCampaign> => {
  return withRetry(async () => {
    const ai = getAiClient();
    const prompt = `Act as a Luxury Mortgage Marketing Director. Create a cohesive 3-channel marketing campaign based on the following topic.
    
    **Topic**: ${topic}
    **Tone**: ${tone}
    
    **Requirements**:
    1. **LinkedIn Post**: Professional, authoritative. Max 150 words. Write in plain text (no markdown) suitable for posting.
    2. **Email**: High-touch, direct to client. Needs a Subject Line and Body. Plain text.
    3. **SMS**: Urgent, punchy, under 160 characters.

    **Output Format**:
    Return strictly JSON with the following schema:
    {
      "linkedInPost": "string",
      "emailSubject": "string",
      "emailBody": "string",
      "smsTeaser": "string"
    }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            linkedInPost: { type: Type.STRING },
            emailSubject: { type: Type.STRING },
            emailBody: { type: Type.STRING },
            smsTeaser: { type: Type.STRING },
          }
        }
      }
    });

    return parseJson<MarketingCampaign>(response.text || "{}", {
      linkedInPost: "",
      emailSubject: "",
      emailBody: "",
      smsTeaser: ""
    });
  });
};

export const generateSocialImage = async (promptText: string): Promise<string> => {
  return withRetry(async () => {
    const ai = getAiClient();
    
    const refinedPrompt = `A high-end, photorealistic, luxury real estate or finance aesthetic image representing: ${promptText}. 
    Cinematic lighting, 8k resolution, professional photography style, architectural digest quality. No text overlay.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview', // High-quality image generation
      contents: {
        parts: [
          { text: refinedPrompt }
        ]
      },
      config: {
        imageConfig: {
            aspectRatio: "1:1",
            imageSize: "1K"
        }
      }
    });

    // Iterate through parts to find the image
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new AIError(AIErrorCodes.UNEXPECTED_ERROR, "No image generated by model.");
  });
};


export const generateMarketingContent = async (channel: string, topic: string, tone: string, context?: string) => {
  return withRetry(async () => {
    const ai = getAiClient();
    const prompt = `Act as a Senior Marketing Director for a Luxury Mortgage Division.
    Create content for: ${channel}.
    Topic: ${topic}.
    Tone: ${tone}.
    Context: ${context || 'General market expertise'}.
    
    Write in plain text only (suitable for copy-pasting).
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { systemInstruction: SYSTEM_INSTRUCTION }
    });
    return response.text;
  });
};

export const analyzeCommunicationHistory = async (clientName: string, history: EmailLog[]) => {
  return withRetry(async () => {
    const ai = getAiClient();
    // Sort chronologically for analysis context to understand the arc
    const sortedHistory = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const historyText = sortedHistory.map(h => `[${new Date(h.date).toLocaleDateString()}] ${h.subject}: ${h.body.substring(0, 200)}...`).join('\n');
    
    const prompt = `You are a strategic communication advisor. Analyze the communication history for client ${clientName}.
    
    **Communication Log (Chronological)**:
    ${historyText}
    
    **Task**:
    Provide a brief strategic summary.
    Use **bold** to highlight the next best action.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { systemInstruction: SYSTEM_INSTRUCTION }
    });
    return response.text;
  });
}

export const chatWithAssistant = async (history: Array<{role: string, parts: Array<{text: string}>}>, message: string) => {
  return withRetry(async () => {
    const ai = getAiClient();
    
    // PERFORMANCE: Truncate history to last 30 turns to maintain context window efficiency
    // while preserving the most relevant recent conversation.
    const optimizedHistory = history.length > 30 ? history.slice(history.length - 30) : history;

    const chat = ai.chats.create({
      model: 'gemini-3-pro-preview', // Upgraded to Gemini 3 Pro
      history: optimizedHistory,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{googleSearch: {}}] 
      }
    });

    const response = await chat.sendMessage({ message });
    
    const candidate = response.candidates?.[0];
    const groundingMetadata = candidate?.groundingMetadata;
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
  });
};

// --- Thinking Mode (Gemini 3 Pro) ---

export const analyzeLoanScenario = async (scenarioData: string) => {
  return withRetry(async () => {
    const ai = getAiClient();
    // Using Gemini 3 Pro with Thinking Budget for complex risk assessment
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Perform a deep-dive risk assessment on this Jumbo Loan Scenario: ${scenarioData}.
      
      Think step-by-step about:
      1. Debt-to-Income implications.
      2. Residual income requirements for Jumbo.
      3. Collateral risk based on the data.
      4. Potential compensating factors.

      **OUTPUT REQUIREMENT**:
      Write a cohesive, professional analysis in 2-3 paragraphs.
      - Use **bold** for strengths, risks, and key ratios.
      - Use bullet points if listing specific compensating factors.
      - Write as a human underwriter would.`,
      config: {
        thinkingConfig: { thinkingBudget: 32768 } // Max thinking budget for Pro
      }
    });
    return response.text;
  });
}

// --- Market Pulse & Deep Thinking ---

export const fetchDailyMarketPulse = async (): Promise<{ indices: MarketIndex[], news: NewsItem[], sources?: any[] }> => {
  const now = Date.now();
  if (marketDataCache.data && (now - marketDataCache.timestamp < CACHE_TTL)) {
      // Validate cached data structure before returning
      // This prevents UI crashes if localStorage has stale/malformed schema
      const cache = marketDataCache.data;
      if (cache && Array.isArray(cache.indices) && Array.isArray(cache.news)) {
          console.log("Serving Market Pulse from Cache");
          return cache;
      }
      console.warn("Cached market data malformed, refetching.");
  }

  // Deduplication: Return existing in-flight request if active
  if (activeMarketPulsePromise) {
      console.log("Joining active Market Pulse request");
      return activeMarketPulsePromise;
  }

  // Start new request
  activeMarketPulsePromise = withRetry(async () => {
      try {
        const ai = getAiClient();
        const today = new Date().toLocaleDateString();
        
        // We utilize Google Search to get REAL data
        const prompt = `
          Find current market data for today, ${today}.
          
          **STRICT SOURCE CONSTRAINT**: Use ONLY the following credible sources: Bloomberg, CNBC, Mortgage News Daily, Federal Reserve, WSJ, HousingWire.
          Do not use unverified blogs.

          1. 10-Year Treasury Yield (Value and daily change).
          2. S&P 500 Index (Value and daily change).
          3. Average 30-Year Fixed Mortgage Rate (Source: Mortgage News Daily or Freddie Mac).
          4. Brent Crude Oil Price.

          Also find 3 top news headlines from today or yesterday specifically impacting Mortgage Rates, Housing Inventory, or The Fed.

          Output strictly valid JSON with this schema (no markdown, just the JSON):
          {
            "indices": [
               { "label": "10-Yr Treasury", "value": "4.xx%", "change": "+0.xx", "isUp": true/false },
               { "label": "S&P 500", "value": "5,xxx", "change": "-xx", "isUp": true/false },
               ...
            ],
            "news": [
               { "id": "1", "source": "Source", "date": "Today", "title": "Headline", "summary": "1 sentence summary", "category": "Rates" | "Economy" | "Housing" }
            ]
          }
        `;

        const response = await ai.models.generateContent({
          model: 'gemini-3-pro-preview', // Upgraded to Pro for better adherence to source constraints
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }]
            // responseMimeType is not allowed when using the googleSearch tool
          }
        });

        const rawData = parseJson<any>(response.text || "{}", null);
        
        // Strict Schema Validation to ensure we have expected arrays
        if (!rawData || !Array.isArray(rawData.indices) || !Array.isArray(rawData.news)) {
             throw new Error("Schema mismatch: Expected 'indices' and 'news' arrays in Market Pulse response.");
        }
        
        const safeData = {
            indices: rawData.indices,
            news: rawData.news
        };
        
        // Extract grounding chunks required by policy when using Google Search
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const sources = groundingChunks
          .map((chunk: any) => chunk.web ? { uri: chunk.web.uri, title: chunk.web.title } : null)
          .filter((link: any) => link !== null);

        const result = { ...safeData, sources };

        // Update Cache
        marketDataCache.timestamp = Date.now();
        marketDataCache.data = result;
        
        // Persist to storage to survive reloads
        saveToStorage(StorageKeys.MARKET_DATA, marketDataCache);

        return result;
      } finally {
          activeMarketPulsePromise = null; // Clear promise on completion
      }
  });

  return activeMarketPulsePromise;
};

export const generateClientFriendlyAnalysis = async (marketData: any) => {
  return withRetry(async () => {
    const ai = getAiClient();
    
    const prompt = `
      You are a Mortgage Translator.
      
      **Input Data (Verified Sources)**:
      ${JSON.stringify(marketData)}
      
      **Goal**:
      Use deep thinking to analyze how these specific data points interact (e.g., Yields rising -> Rates rising -> Buying power falling).
      Then, translate this into a "Client Brief" that a first-time homebuyer can understand.
      
      **Output Format**:
      Write a warm, clear explanation.
      - Use **bold** for the bottom-line advice (Lock or Float).
      - Use bullet points to list the 2 main drivers of the market today.
      - Keep it under 200 words.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Deep Thinking Model
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 2048 } // Allow significant thought for simplification
      }
    });
    return response.text;
  });
}

export const generateBuyerSpecificAnalysis = async (marketData: any) => {
  return withRetry(async () => {
    const ai = getAiClient();
    
    const prompt = `
      You are a Mortgage Advisor analyzing today's market for a homebuyer.
      
      **Market Data**:
      ${JSON.stringify(marketData)}
      
      **Goal**:
      Explain specifically how today's data affects a buyer's **Purchasing Power** and **Monthly Payment**.
      
      **Requirements**:
      1. **Purchasing Power**: Is it eroding or improving?
      2. **Urgency**: "Lock Now" or "Float"?
      3. **Real World Impact**: Translate the rate change into approximate monthly cost difference for a $500k loan compared to yesterday/last week.
      
      Keep it warm, actionable, and under 150 words. Use **bold** for the specific advice.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', 
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 2048 }
      }
    });
    return response.text;
  });
}

export const analyzeRateTrends = async (rates: any) => {
  return withRetry(async () => {
    const ai = getAiClient();
    const prompt = `Analyze these daily par rates for a Morning Rate Sheet header:
    - 30-Yr Conforming: ${rates.conforming30}%
    - 30-Yr Jumbo: ${rates.jumbo30}%
    - 7/1 ARM: ${rates.arm7_1}%
    
    Provide a natural, conversational commentary on the Yield Curve and the Jumbo vs. Conforming spread. 
    Use **bold** for your final "Float vs. Lock" recommendation.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { systemInstruction: SYSTEM_INSTRUCTION }
    });
    return response.text;
  });
}

export const synthesizeMarketNews = async (newsItems: any[]) => {
  return withRetry(async () => {
    const ai = getAiClient();
    const headlines = newsItems.map(n => `- ${n.title}: ${n.summary}`).join('\n');
    const prompt = `Synthesize these headlines into a concise "Market Flash" paragraph for high-net-worth clients.
    Use **bold** for key impacts.
    ${headlines}`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { systemInstruction: SYSTEM_INSTRUCTION }
    });
    return response.text;
  });
}

// --- Verification Service ---

export const verifyFactualClaims = async (text: string): Promise<VerificationResult> => {
  return withRetry(async () => {
    const ai = getAiClient();
    const prompt = `
      Act as a strict Compliance & Data Auditor for a financial institution.
      
      **TASK**:
      Perform a real-time fact-check on the provided text.
      
      **TEXT TO VERIFY**:
      "${text}"
      
      **REQUIRED SOURCES (TIER-1 ONLY)**:
      - Bloomberg, Wall Street Journal (WSJ), CNBC
      - Federal Reserve (.gov), Mortgage News Daily, HousingWire
      - US Treasury, Fred St. Louis
      
      **PROTOCOL**:
      1. Identify every specific factual claim (dates, rates, statistics, quotes).
      2. Use Google Search to find corroborating evidence from the Tier-1 list.
      3. Flag any discrepancies or outdated information.
      
      **OUTPUT FORMAT**:
      Return a professional "Audit Report" in markdown.
      - Header: "✅ Verified Accurate" OR "⚠️ Potential Discrepancies" OR "❌ Inaccurate".
      - Findings: Bullet points listing verified facts with specific dates.
      - Corrections: Explicitly correct any wrong numbers using the source data.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Strongest model for reasoning + search
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const candidate = response.candidates?.[0];
    const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks
      .map((chunk: any) => chunk.web ? { uri: chunk.web.uri, title: chunk.web.title } : null)
      .filter((link: any) => link !== null);

    // Determine status based on text content (simple heuristic for UI color coding)
    const textLower = response.text?.toLowerCase() || "";
    let status: 'VERIFIED' | 'ISSUES_FOUND' | 'UNVERIFIABLE' = 'UNVERIFIABLE';
    
    if (textLower.includes("verified accurate") || textLower.includes("consistent with")) {
        status = 'VERIFIED';
    } else if (textLower.includes("discrepancies") || textLower.includes("inaccurate") || textLower.includes("correction")) {
        status = 'ISSUES_FOUND';
    }

    return {
      status,
      text: response.text || "Verification complete.",
      sources: sources
    };
  });
};

export const verifyCampaignContent = async (campaign: MarketingCampaign): Promise<VerificationResult> => {
    const textToVerify = `
      SUBJECT: ${campaign.emailSubject}
      EMAIL_BODY: ${campaign.emailBody}
      LINKEDIN_POST: ${campaign.linkedInPost}
      SMS_TEASER: ${campaign.smsTeaser}
    `;
    return verifyFactualClaims(textToVerify);
};

// --- Property Valuation Service ---

export const estimatePropertyDetails = async (address: string): Promise<{ estimatedValue: number, source: string }> => {
  const normalizedAddress = address.trim().toLowerCase();
  
  // Check Cache (Valid for 7 days for valuations)
  const cached = valuationCache[normalizedAddress];
  const VALUATION_TTL = 1000 * 60 * 60 * 24 * 7; 
  if (cached && (Date.now() - cached.timestamp < VALUATION_TTL)) {
      console.log("Serving Valuation from Cache");
      return { estimatedValue: cached.estimatedValue, source: cached.source };
  }

  // Deduplication: Check in-flight requests
  if (activeValuationPromises.has(normalizedAddress)) {
      console.log("Joining active Valuation request");
      return activeValuationPromises.get(normalizedAddress)!;
  }

  const promise = withRetry(async () => {
    try {
        const ai = getAiClient();
        const prompt = `
        Search for the current estimated property value (Zestimate, Redfin Estimate, or similar) for the following address:
        "${address}"

        **Requirements**:
        - Use Google Search to find the most recent listing or estimate from Zillow, Redfin, or Realtor.com.
        - If an exact match isn't found, estimate based on recent sales in that specific neighborhood for similar luxury properties.
        
        **Output Format**:
        Return strictly JSON:
        {
            "estimatedValue": number (e.g., 1250000),
            "source": string (e.g., "Zillow Estimate")
        }
        `;

        const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            tools: [{ googleSearch: {} }]
        }
        });

        const data = parseJson(response.text || "{}", { estimatedValue: 0, source: "Unknown" });
        
        // Update Cache
        if (data.estimatedValue > 0) {
            valuationCache[normalizedAddress] = {
                ...data,
                timestamp: Date.now()
            };
            saveToStorage(StorageKeys.VALUATIONS, valuationCache);
        }
        
        return data;
    } finally {
        activeValuationPromises.delete(normalizedAddress);
    }
  });

  activeValuationPromises.set(normalizedAddress, promise);
  return promise;
};

// --- Compensation Analysis ---

export const analyzeIncomeProjection = async (clients: any[], currentCommission: number) => {
    return withRetry(async () => {
        const ai = getAiClient();
        
        // Performance: Truncate list if too large
        const dealsToAnalyze = clients.slice(0, 25);
        
        const pipelineData = dealsToAnalyze.map(c => 
            `- ${c.name}: $${c.loanAmount} (${c.status})`
        ).join('\n');

        const prompt = `
            You are a Financial Performance Analyst for a Mortgage Professional.
            Analyze the user's pipeline to see if they are on track to hit their "Unicorn Role" target of $108,750/year.
            
            **Compensation Rules**:
            - Base Salary: $51,001/year (Fixed)
            - Target Annual Commission: $57,750
            - Current Realized Commission YTD: $${currentCommission}
            
            **Top Pipeline Deals (Active)**:
            ${pipelineData}
            
            **Task**:
            Write a cohesive, natural-language executive summary.
            - Use bullet points to list the "Top 3 Critical Deals".
            - Use **bold** for the estimated commission value at risk.
            - Write conversationally.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { systemInstruction: SYSTEM_INSTRUCTION }
        });
        return response.text;
    });
};

// --- Audio Services (Transcription & TTS) ---

export const transcribeAudio = async (base64Audio: string, mimeType: string = 'audio/webm'): Promise<string> => {
    return withRetry(async () => {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType, data: base64Audio } },
                    { text: "Transcribe this audio exactly as spoken." }
                ]
            }
        });
        return response.text || "";
    });
};

export const generateSpeech = async (text: string): Promise<string> => {
    return withRetry(async () => {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: { parts: [{ text: text }] },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            },
        });
        
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) throw new AIError(AIErrorCodes.UNEXPECTED_ERROR, "No audio generated by model.");
        return base64Audio;
    });
};

// --- Voice Command Parser ---
export const parseNaturalLanguageCommand = async (transcript: string, validStatuses?: string[]): Promise<CommandIntent> => {
  return withRetry(async () => {
    const statusList = validStatuses ? validStatuses.join("', '") : "Lead', 'Pre-Approval', 'Underwriting', 'Clear to Close', 'Closed";

    const ai = getAiClient();
    const prompt = `
      You are a command parser for a Mortgage CRM. Convert the user's natural language request into a specific JSON Action.
      
      **Available Actions**:
      1. CREATE_CLIENT: User wants to add a new person. Extract 'name', 'loanAmount' (number), 'status', 'email', 'phone'.
      2. UPDATE_CLIENT: User wants to change details of an EXISTING deal.
         - Triggers: "Update", "Change", "Set", "Move", "Edit".
         - Supports MULTIPLE updates in one phrase (e.g., "Update John's loan to 1.5M and move him to Closed").
         - Extract 'clientName' (who to update) and any fields to change: 'status', 'loanAmount', 'phone', 'email', 'name' (if renaming).
      3. ADD_NOTE: User wants to append a note. Extract 'clientName' and 'note'.
      4. ADD_TASK: User wants to add a checklist item. Extract 'clientName', 'taskLabel', and 'date' (YYYY-MM-DD) if mentioned.

      **Status Values**: '${statusList}'. 
      - Map "Closing" or "CTC" to "Clear to Close".
      - Map "Approved" to "Pre-Approval" or "Underwriting" based on context.

      **User Request**: "${transcript}"
      **Today's Date**: ${new Date().toISOString().split('T')[0]}

      **Output Format**: JSON only.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
           type: Type.OBJECT,
           properties: {
             action: { type: Type.STRING, enum: ["CREATE_CLIENT", "UPDATE_STATUS", "UPDATE_CLIENT", "ADD_NOTE", "ADD_TASK", "UNKNOWN"] },
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
                 date: { type: Type.STRING }
               }
             }
           }
        }
      }
    });

    const result = parseJson<CommandIntent | null>(response.text || "{}", null);
    
    // Strict schema check
    if (!result || !result.action) {
        throw new Error("Schema mismatch: Invalid command structure.");
    }

    if (!result.payload) {
        result.payload = {};
    }
    
    return result;
  });
};