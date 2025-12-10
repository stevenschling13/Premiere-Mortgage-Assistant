
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Client, CommandIntent, EmailLog, MarketIndex, NewsItem, MarketingCampaign, VerificationResult, Opportunity, DealStrategy, GiftSuggestion, CalendarEvent, SalesScript } from "../types";
import { loadFromStorage, saveToStorage, StorageKeys } from "./storageService";
import { errorService } from "./errorService";
import { AGENCY_GUIDELINES } from "../constants";

type GroundingLink = { uri: string; title: string };

interface AssistantResponse {
  text: string;
  links: GroundingLink[];
  searchEntryPoint?: string;
  searchQueries?: string[];
}

const SYSTEM_INSTRUCTION = `You are the "Premiere Private Banking Assistant", an elite AI designed for high-net-worth mortgage banking. 
Your demeanor is sophisticated, precise, and anticipatory.

**STYLE & FORMATTING GUIDELINES**:
1. **HUMAN TONE**: Write naturally, as if you are a senior colleague sending a quick memo. Avoid robotic transitions.
2. **FORMATTING**: Use **Markdown** to organize your thoughts.
   - Use **bold** for key figures, rates, or emphatic points.
   - Use bullet points (-) for lists or breakdowns.
3. **CLARITY**: Keep it punchy. High-net-worth clients value time.

**UNDERWRITING AUTHORITY**:
- You act as a **Direct Endorsement (DE) Underwriter**.
- **Fannie Mae (FNMA)**: Reference the Selling Guide (e.g., B3-3 for Income, B3-6 for Liabilities).
- **FHA**: Reference HUD Handbook 4000.1.
- **Data Integrity**: Use only Tier-1 Financial Sources (Bloomberg, WSJ, Fed, Mortgage News Daily).

**Your User's Context (The "Unicorn" Role)**:
- **Role**: Private Mortgage Banker (Hybrid Model).
- **Compensation**: Base Salary ($51,001/yr) + Commission.
- **Commission Structure**: You receive a 15% cut of the Gross Commission.
- **Volume Model**: "Volume Arbitrage" (High volume from bank referrals, lower bps).
- **Target Income**: ~$108,750/yr (Target Volume: $70M).

**You specialize in**:
1.  **Market Authority**: Real-time bond market movements (10yr Treasury, MBS).
2.  **Complex Deal Structuring**: Analyzing jumbo loans, trust income, and RSU/Asset depletion scenarios.
3.  **High-Touch Communication**: Drafting white-glove emails.
`;

// --- Circuit Breaker State ---
const CIRCUIT_BREAKER = {
    failures: 0,
    lastFailure: 0,
    THRESHOLD: 3,
    COOLDOWN: 30000 // 30 seconds
};

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
  const env = (typeof process !== 'undefined' && process.env) ? process.env : {};
  const apiKey = env.API_KEY;
  
  if (!apiKey || apiKey.trim() === '') {
    throw new AIError(AIErrorCodes.INVALID_API_KEY, "API Key is missing. Please connect a billing-enabled key.");
  }
  return new GoogleGenAI({ apiKey });
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(operation: () => Promise<T>, retries = 5, baseDelay = 1000): Promise<T> {
  if (CIRCUIT_BREAKER.failures >= CIRCUIT_BREAKER.THRESHOLD) {
      const timeSinceFailure = Date.now() - CIRCUIT_BREAKER.lastFailure;
      if (timeSinceFailure < CIRCUIT_BREAKER.COOLDOWN) {
          const remaining = Math.ceil((CIRCUIT_BREAKER.COOLDOWN - timeSinceFailure) / 1000);
          const error = new AIError(AIErrorCodes.CIRCUIT_OPEN, `AI Service is cooling down. Please wait ${remaining}s.`);
          errorService.log('API_FAIL', 'Circuit Breaker Open', { remaining });
          throw error;
      } else {
          CIRCUIT_BREAKER.failures = 0;
      }
  }

  let lastError: AIError | undefined;
  
  for (let i = 0; i < retries; i++) {
    try {
      const result = await operation();
      CIRCUIT_BREAKER.failures = 0;
      return result;
    } catch (rawError: any) {
      const normalized = normalizeError(rawError);
      lastError = normalized;

      errorService.log('API_FAIL', `Attempt ${i+1}/${retries} failed: ${normalized.code}`, { error: normalized.message });

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
          
          if (normalized.code === AIErrorCodes.SCHEMA_MISMATCH) {
              normalized.message = "The AI response could not be processed after multiple attempts. Please try again.";
          } else if (normalized.code === AIErrorCodes.NETWORK_ERROR) {
              normalized.message = normalized.message + " (Retries exhausted)";
          }
          break;
      }
      
      const exponential = baseDelay * Math.pow(2, i);
      const jitter = Math.random() * 500; 
      const delay = Math.min(exponential + jitter, 15000); // Cap at 15s

      await wait(delay);
    }
  }
  
  throw lastError || new AIError(AIErrorCodes.UNEXPECTED_ERROR, 'Operation failed after retries.');
}

const parseJson = <T>(text: string, fallback: T): T => {
  if (!text) return fallback;
  try { return JSON.parse(text) as T; } catch (e) { /* continue */ }
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
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
): Promise<AssistantResponse> => {
  return withRetry(async () => {
    const ai = getAiClient();
    const optimizedHistory = history.length > 30 ? history.slice(history.length - 30) : history;

    const chat = ai.chats.create({
      model: 'gemini-3-pro-preview', 
      history: optimizedHistory,
      config: {
        systemInstruction: customSystemInstruction || SYSTEM_INSTRUCTION,
        tools: [{googleSearch: {}}] 
      }
    });

    const response = await chat.sendMessage({ message });
    
    if (!response.candidates || response.candidates.length === 0) {
        throw new AIError(AIErrorCodes.SAFETY_VIOLATION, "The model blocked the response due to safety filters.");
    }
    const candidate = response.candidates[0];
    if (candidate.finishReason === 'SAFETY') {
         throw new AIError(AIErrorCodes.SAFETY_VIOLATION, "The model blocked the response due to safety filters.");
    }

    const groundingMetadata = candidate?.groundingMetadata;
    const groundingChunks = groundingMetadata?.groundingChunks || [];

    const links: GroundingLink[] = groundingChunks
      .map((chunk: any) => (chunk.web && chunk.web.uri && chunk.web.title) ? { uri: chunk.web.uri, title: chunk.web.title } : null)
      .filter((link): link is GroundingLink => link !== null);

    return {
      text: response.text || '',
      links,
      searchEntryPoint: groundingMetadata?.searchEntryPoint?.renderedContent,
      searchQueries: groundingMetadata?.webSearchQueries
    };
  });
};

export const generateGiftSuggestions = async (client: Client): Promise<GiftSuggestion[]> => {
    return withRetry(async () => {
        const ai = getAiClient();
        const prompt = `
            Act as a high-end Client Relationship Manager.
            Suggest 3 unique, personalized closing gifts for this client to build long-term loyalty.
            
            **Client Profile**:
            - Name: ${client.name}
            - Loan Amount: $${client.loanAmount.toLocaleString()}
            - Notes/Interests: ${client.notes}
            
            **Rules**:
            - NO generic wine, generic gift cards, or doormats.
            - Suggest items that show attention to detail (hobbies, pets, family, travel).
            - If notes are empty, suggest timeless, high-quality home items (e.g. Olive Oil set, Luxury Candle, Coffee Table Book).
            
            **Output**:
            JSON Array:
            [{ "item": "Title", "reason": "Why this fits", "priceRange": "$50 - $100" }]
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
    });
};

export const generateClientSummary = async (client: Client) => {
  return withRetry(async () => {
      const ai = getAiClient();
      
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
          thinkingConfig: { thinkingBudget: 2048 }
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

export const generatePartnerUpdate = async (client: Client, partnerName: string) => {
  return withRetry(async () => {
    const ai = getAiClient();
    const prompt = `Draft a professional "Partner Status Update" email to a referral partner named ${partnerName}.
    
    **Context**:
    - Mutual Client: ${client.name}
    - Current Status: ${client.status}
    - Loan Amount: $${client.loanAmount.toLocaleString()}
    - Key Next Step: ${client.checklist.find(t=>!t.checked)?.label || "Moving forward"}
    
    **Objective**:
    - Inform the partner of the deal progress.
    - Thank them for the referral (keep it classy, not cheesy).
    - Be concise and professional.
    
    **Output**: 
    Plain text email body (ready to copy). No markdown.
    `;

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

export const generateRateSheetEmail = async (rates: any, rawNotes: string) => {
  return withRetry(async () => {
    const ai = getAiClient();
    const prompt = `
      Act as a Private Mortgage Banker.
      Create a "Morning Rate & Market Update" email for your referral partners (Realtors & CPAs).
      
      **Inputs**:
      - Raw Market Notes: "${rawNotes}"
      - Today's Rates (Par/Point):
        - 30-Yr Fixed: ${rates.conforming30}%
        - Jumbo 30-Yr: ${rates.jumbo30}%
        - 7/1 ARM: ${rates.arm7_1}%
      
      **Goal**:
      1. Write a punchy Subject Line (e.g., "Rates Improve | Jobs Report Impact").
      2. Write a professional "Market Flash" paragraph synthesizing the raw notes.
      3. Format the rates in a clean text table.
      
      **Output**:
      Plain text email body. 
      Keep the tone exclusive and expert.
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
};

export const generateSubjectLines = async (client: Client, topic: string): Promise<string[]> => {
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

// --- Communications Studio ---

export const generateMarketingCampaign = async (topic: string, tone: string): Promise<MarketingCampaign> => {
  return withRetry(async () => {
    const ai = getAiClient();
    const prompt = `Act as a Senior Communications Director for a Private Wealth Mortgage Division.
    Create a cohesive 3-channel outreach strategy based on the following topic.
    
    **Topic**: ${topic}
    **Tone**: ${tone}
    
    **Requirements**:
    1. **LinkedIn Post**: Professional, authoritative market update. Max 150 words. Write in plain text.
    2. **Email**: High-touch, direct advisory to a HNW client. Needs a Subject Line and Body. Plain text.
    3. **SMS**: Urgent, punchy update, under 160 characters.

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

export const generateMarketingContent = async (channel: string, topic: string, tone: string, context?: string) => {
  return withRetry(async () => {
    const ai = getAiClient();
    const prompt = `Act as a Senior Communications Director for Private Wealth.
    Create content for: ${channel}.
    Topic: ${topic}.
    Tone: ${tone}.
    Context: ${context || 'General market expertise'}.
    
    Write in plain text only.
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

// --- Thinking Mode (Gemini 3 Pro) ---

export const analyzeLoanScenario = async (scenarioData: string): Promise<string> => {
  return withRetry(async () => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Perform a deep-dive risk assessment on this Jumbo Loan Scenario: ${scenarioData}.
      
      **VERIFICATION STEP**: Use Google Search to check current Jumbo/Non-QM guideline trends for 2024/2025 regarding reserves and DTI caps from major investors (e.g. Chase, Wells Fargo, Aggregators).

      Think step-by-step about:
      1. Debt-to-Income implications.
      2. Residual income requirements for Jumbo.
      3. Collateral risk based on the data.
      4. Potential compensating factors.

      **OUTPUT REQUIREMENT**:
      Write a cohesive, professional analysis in 2-3 paragraphs.
      - Use **bold** for strengths, risks, and key ratios.
      - Use bullet points if listing specific compensating factors.
      - Write as a human underwriter would.
      - Cite any live market data found.`,
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 32768 }
      }
    });
    return response.text || '';
  });
}

export const compareLoanScenarios = async (scenarioA: any, scenarioB: any) => {
  return withRetry(async () => {
    const ai = getAiClient();
    const prompt = `
      Act as a Mortgage Financial Advisor.
      Compare these two loan options for a client and provide a trade-off analysis.
      
      **Option A (Baseline)**:
      - Loan Amount: $${scenarioA.loanAmount}
      - Rate: ${scenarioA.interestRate}%
      - Down Payment: ${scenarioA.downPaymentPercent}%
      - Monthly P&I: $${scenarioA.monthlyPI.toFixed(0)}
      
      **Option B (Alternative)**:
      - Loan Amount: $${scenarioB.loanAmount}
      - Rate: ${scenarioB.interestRate}%
      - Down Payment: ${scenarioB.downPaymentPercent}%
      - Monthly P&I: $${scenarioB.monthlyPI.toFixed(0)}
      
      **Analysis Needed**:
      1. **Cash vs. Cash Flow**: Compare upfront cost difference vs. monthly savings.
      2. **Break-Even**: If buying points or putting more down, how long to recoup?
      3. **Strategic Advice**: Which option is safer if they plan to move in 5 years?
      
      **Output**:
      Professional Markdown comparison table + bulleted advice.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 4096 }
      }
    });
    return response.text;
  });
};

export const solveDtiScenario = async (financials: any): Promise<string> => {
  return withRetry(async () => {
    const ai = getAiClient();
    
    // Inject official agency guidelines into the prompt context for better accuracy
    const guidelineContext = JSON.stringify(AGENCY_GUIDELINES);

    const prompt = `
      Act as a Senior Direct Endorsement (DE) Underwriter. 
      Analyze this file to improve the Debt-to-Income (DTI) ratio.
      
      **Agency Guidelines Context (Reference Only)**:
      ${guidelineContext}
      
      **Loan Data**:
      - Loan Type: ${financials.loanType} (Verify current ${financials.loanType} guidelines via Google Search)
      - Monthly Income: $${financials.totalIncome}
      - Proposed Housing Payment: $${financials.proposedHousing}
      - Current Debts: ${JSON.stringify(financials.debts)}
      ${financials.hasAusApproval !== undefined ? `- AUS Status: ${financials.hasAusApproval ? 'Approve/Eligible' : 'Manual Underwrite'}` : ''}
      ${financials.liquidAssets ? `- Liquid Assets: $${financials.liquidAssets}` : ''}
      ${financials.requiredResidual ? `- VA Required Residual Income: $${financials.requiredResidual}` : ''}
      
      **Mission**:
      1. **VERIFY GUIDELINES**: Use Google Search to find the *most recent* ${financials.loanType} underwriting guidelines (FNMA Selling Guide, Freddie Mac, HUD 4000.1, or VA Lenders Handbook) regarding DTI limits, residual income, and reserve requirements for 2024/2025.
      2. **Compare**: Check if the static context matches live data. If recent changes occurred (e.g., FHA student loan calculations, VA residual updates), prioritize the live search results.
      3. **Optimize**: Find the *most efficient* path to approval.
         - Identify debts to pay off.
         - Calculate exact DTI reduction.
         - Check hard stops (e.g. FHA Manual 43% vs AUS 56.9%).
      
      **Output**:
      Provide a bulleted "Optimization Strategy" in Markdown.
      - **Current Guideline Check**: Briefly state the live guideline used (e.g., "Verified HUD 4000.1 effective [Date]...").
      - **Strategy**: Specific payoff or restructure advice.
      - **Citation**: Cite the source URL found via search.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 4096 }
      }
    });
    return response.text || '';
  });
}

// --- Market Pulse & Deep Thinking ---

export const fetchDailyMarketPulse = async (): Promise<{ indices: MarketIndex[], news: NewsItem[], sources?: any[] }> => {
  const now = Date.now();
  if (marketDataCache.data && (now - marketDataCache.timestamp < CACHE_TTL)) {
      const cache = marketDataCache.data;
      if (cache && Array.isArray(cache.indices) && Array.isArray(cache.news)) {
          return cache;
      }
  }

  if (activeMarketPulsePromise) {
      return activeMarketPulsePromise;
  }

  activeMarketPulsePromise = withRetry(async () => {
      try {
        const ai = getAiClient();
        const today = new Date().toLocaleDateString();
        
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
          model: 'gemini-3-pro-preview',
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }]
          }
        });

        const rawData = parseJson<any>(response.text || "{}", null);
        
        if (!rawData || !Array.isArray(rawData.indices) || !Array.isArray(rawData.news)) {
             throw new Error("Schema mismatch: Expected 'indices' and 'news' arrays in Market Pulse response.");
        }
        
        const safeData = {
            indices: rawData.indices,
            news: rawData.news
        };
        
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const sources = groundingChunks
          .map((chunk: any) => chunk.web ? { uri: chunk.web.uri, title: chunk.web.title } : null)
          .filter((link: any) => link !== null);

        const result = { ...safeData, sources };

        marketDataCache.timestamp = Date.now();
        marketDataCache.data = result;
        
        saveToStorage(StorageKeys.MARKET_DATA, marketDataCache);

        return result;
      } finally {
          activeMarketPulsePromise = null; 
      }
  });

  return activeMarketPulsePromise;
};

// --- Morning Briefing Service ---

export const generateMorningMemo = async (urgentClients: Client[], marketData: any): Promise<string> => {
  return withRetry(async () => {
    const ai = getAiClient();
    
    const clientContext = urgentClients.map(c => 
      `- ${c.name} (${c.status}): Loan $${c.loanAmount.toLocaleString()}. Action: ${c.checklist.find(t=>!t.checked)?.label || "Review file"}`
    ).join('\n');

    const indices = marketData?.indices?.map((i: any) => `${i.label}: ${i.value} (${i.change})`).join(', ') || "Market data unavailable";
    const news = marketData?.news?.[0]?.title || "No major headlines";

    const prompt = `
      You are the Chief Strategy Officer for a Private Banker. It is morning.
      
      **Market Snapshot**: ${indices}. Top News: ${news}.
      **Urgent Client Actions (Today)**:
      ${clientContext || "No urgent tasks."}
      
      **Mission**:
      Write a concise "Executive Brief".
      1. **Market Stance**: 1 sentence on whether to Lock or Float based on the data.
      2. **Priorities**: Identify the single most important client action.
      3. **Talking Point**: Give me one smart sentence to say to clients today about rates/economy.
      
      **Format**: Markdown. Keep it under 150 words. Use emojis sparingly.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 2048 }
      }
    });
    return response.text || '';
  });
};

export const generateClientFriendlyAnalysis = async (marketData: any): Promise<string> => {
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
      model: 'gemini-3-pro-preview', 
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 2048 } 
      }
    });
    return response.text || '';
  });
}

export const generateBuyerSpecificAnalysis = async (marketData: any): Promise<string> => {
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
    return response.text || '';
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

export const analyzeIncomeProjection = async (clients: any[], currentCommission: number) => {
    return withRetry(async () => {
        const ai = getAiClient();
        
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

export const generateGapStrategy = async (currentTotalIncome: number, targetIncome: number, pipeline: any[]): Promise<string> => {
  return withRetry(async () => {
    const ai = getAiClient();
    const gap = targetIncome - currentTotalIncome;
    
    // Filter for active pipeline opportunities
    const candidates = pipeline.filter(d => d.probability < 0.9 && d.probability > 0).slice(0, 15);
    const candidateStr = candidates.map(c => `- ${c.name}: Loan $${c.loanAmount.toLocaleString()} (${c.status})`).join('\n');

    const prompt = `
      Act as a high-performance Sales Coach.
      
      **The Gap**: The banker is currently **$${gap.toLocaleString()}** short of their annual income goal ($${targetIncome.toLocaleString()}).
      
      **The Pipeline**:
      ${candidateStr}
      
      **Mission**:
      Analyze the pipeline and identify the "Path to Goal".
      1. **Select the top 2 "Must-Win" deals** that would bridge the largest chunk of this gap.
      2. **Prescribe a Tactic** for each (e.g., "Schedule face-to-face," "Leverage 7/1 ARM pricing").
      
      **Format**:
      - **Strategy Header**: One motivating sentence.
      - **Action Plan**: Bullet points for the deals.
      - **Tone**: Urgent, precise, professional.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 2048 }
      }
    });
    return response.text || '';
    });
};

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
    const sources: GroundingLink[] = groundingChunks
      .map((chunk: any) => (chunk.web && chunk.web.uri && chunk.web.title) ? { uri: chunk.web.uri, title: chunk.web.title } : null)
      .filter((link): link is GroundingLink => link !== null);

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
      sources
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
      return { estimatedValue: cached.estimatedValue, source: cached.source };
  }

  // Deduplication: Check in-flight requests
  if (activeValuationPromises.has(normalizedAddress)) {
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

// --- Auto-Organization & Task Generation ---

export const organizeScratchpadNotes = async (rawText: string) => {
  return withRetry(async () => {
    const ai = getAiClient();
    const prompt = `
      Act as an Executive Assistant. Reformat these rough notes into a clean, structured record.
      
      **Raw Notes**:
      "${rawText}"
      
      **Required Format**:
      - **Executive Summary**: 1 sentence overview.
      - **Key Details**: Bullet points of facts (names, amounts, rates, dates).
      - **Action Items**: Checklist of things to do next.
      
      Keep it professional and concise. Output strictly Markdown.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { systemInstruction: SYSTEM_INSTRUCTION }
    });
    return response.text;
  });
};

export const generateSmartChecklist = async (client: Client): Promise<string[]> => {
  return withRetry(async () => {
    const ai = getAiClient();
    const prompt = `
      Act as a Mortgage Underwriting Assistant. 
      Generate a specific list of required documents/tasks to close this deal based on the client profile.
      
      **Client Profile**:
      - Name: ${client.name}
      - Loan Amount: $${client.loanAmount}
      - Notes: ${client.notes}
      
      **Rules**:
      - If loan > $2M, include "2nd Appraisal".
      - If notes mention "Self Employed", include "2 Years Tax Returns" and "CPA Letter".
      - If notes mention "Trust", include "Trust Agreement".
      - Always include standard items like "Pay Stubs (30 days)" and "Bank Statements (2 months)" if likely applicable.
      
      **Output**:
      Return strictly a JSON array of strings (e.g., ["Item 1", "Item 2"]). No markdown blocks.
    `;

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

export const generateAudioBriefing = async (text: string): Promise<string> => {
    // Re-use standard speech generation but potentially with a different voice/instruction
    return generateSpeech(text);
};

export const extractClientDataFromImage = async (base64Image: string): Promise<Partial<Client>> => {
    return withRetry(async () => {
        const ai = getAiClient();
        const prompt = `
            Extract client information from this document/image.
            Look for Name, Email, Phone, Address, and Loan Amount.
            Return a JSON object.
        `;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        email: { type: Type.STRING },
                        phone: { type: Type.STRING },
                        propertyAddress: { type: Type.STRING },
                        loanAmount: { type: Type.NUMBER }
                    }
                }
            }
        });
        
        return parseJson<Partial<Client>>(response.text || "{}", {});
    });
};

export const scanPipelineOpportunities = async (clients: Client[], marketIndices: MarketIndex[]): Promise<Opportunity[]> => {
    return withRetry(async () => {
        const ai = getAiClient();
        
        // Prepare context
        const marketContext = marketIndices.map(i => `${i.label}: ${i.value} (${i.change})`).join(', ');
        const clientData = clients
            .filter(c => c.status !== 'Closed')
            .map(c => `ID: ${c.id}, Name: ${c.name}, Loan: $${c.loanAmount}, Status: ${c.status}, Notes: ${c.notes.substring(0, 50)}`)
            .join('\n');

        const prompt = `
            Act as a Strategic Pipeline Manager.
            
            **Market Data**: ${marketContext}
            **Active Clients**:
            ${clientData}
            
            **Mission**:
            Scan the client list against the market data to find opportunities.
            - If rates dropped (10yr Treasury down), suggest refinancing or locking floaters.
            - If jumbo spread narrowed, suggest specific product switches.
            - Identify high-value clients stalled in "Lead" status.
            
            **Output**:
            Return a JSON array of opportunities.
            Schema: { clientId: string, clientName: string, trigger: string, action: string, priority: "HIGH" | "MEDIUM" | "LOW" }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            clientId: { type: Type.STRING },
                            clientName: { type: Type.STRING },
                            trigger: { type: Type.STRING },
                            action: { type: Type.STRING },
                            priority: { type: Type.STRING, enum: ["HIGH", "MEDIUM", "LOW"] }
                        }
                    }
                }
            }
        });

        return parseJson<Opportunity[]>(response.text || "[]", []);
    });
};

export const generateDealArchitecture = async (client: Client): Promise<DealStrategy[]> => {
    return withRetry(async () => {
        const ai = getAiClient();
        
        const prompt = `
            Act as a Deal Architect for a Private Bank.
            Structure 3 distinct loan options for this client.
            
            **Client**: ${client.name}, Loan: $${client.loanAmount}
            
            **Strategies Required**:
            1. **The Safety Play**: Fixed rate, stability focused.
            2. **The Cash Flow Play**: Interest Only or ARM to minimize monthly payment.
            3. **The Asset Play**: Leverage vs Liquidation strategy.
            
            **Output**:
            JSON Array of strategies.
            Schema: { title: string, type: "SAFE" | "AGGRESSIVE" | "BALANCED", monthlyPayment: string, pros: string[], cons: string[], description: string }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            type: { type: Type.STRING, enum: ["SAFE", "AGGRESSIVE", "BALANCED"] },
                            monthlyPayment: { type: Type.STRING },
                            pros: { type: Type.ARRAY, items: { type: Type.STRING } },
                            cons: { type: Type.ARRAY, items: { type: Type.STRING } },
                            description: { type: Type.STRING }
                        }
                    }
                },
                thinkingConfig: { thinkingBudget: 4096 }
            }
        });

        return parseJson<DealStrategy[]>(response.text || "[]", []);
    });
};

// --- Calendar & Chief of Staff ---

export const generateDailySchedule = async (events: CalendarEvent[], rawInput: string, clientList?: Client[]): Promise<CalendarEvent[]> => {
    return withRetry(async () => {
        const ai = getAiClient();
        const today = new Date().toISOString().split('T')[0];
        const existingSchedule = events.map(e => `- ${e.start.split('T')[1]} - ${e.end.split('T')[1]}: ${e.title}`).join('\n');
        
        // Contextualize Clients
        const clientContext = clientList ? 
            clientList.map(c => `ID: ${c.id}, Name: ${c.name}`).join('\n') 
            : "No active clients.";

        const prompt = `
            Act as an Executive Chief of Staff.
            Optimize the user's daily schedule.
            
            **Existing Schedule**:
            ${existingSchedule}
            
            **Client Database (for linking)**:
            ${clientContext}
            
            **User Request/Tasks**:
            "${rawInput}"
            
            **Mission**:
            1. Parse the user's request for meetings, calls, or blocks.
            2. Slot them intelligently into the day (8 AM - 6 PM).
            3. **INTELLIGENT LINKING**: If the user mentions a name like "Call John", find "John Doe" in the database and include his ID in the 'clientId' field.
            4. If there are conflicts, resolve them by moving non-urgent tasks.
            
            **Output**:
            JSON Array of NEW events to add (do not return existing ones unless modified).
            Schema: { title: string, start: "YYYY-MM-DDTHH:MM", end: "YYYY-MM-DDTHH:MM", type: "MEETING" | "CALL" | "TASK" | "BLOCK", notes: string, clientId?: string }
            Assume date is ${today}.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            start: { type: Type.STRING },
                            end: { type: Type.STRING },
                            type: { type: Type.STRING, enum: ["MEETING", "CALL", "TASK", "BLOCK"] },
                            notes: { type: Type.STRING },
                            clientId: { type: Type.STRING }
                        }
                    }
                }
            }
        });

        const newEvents = parseJson<CalendarEvent[]>(response.text || "[]", []);
        return newEvents.map(e => ({...e, id: Date.now() + Math.random().toString(), isAiGenerated: true}));
    });
};

export const generateMeetingPrep = async (clientName: string, clientData?: Client): Promise<string> => {
    return withRetry(async () => {
        const ai = getAiClient();
        
        let context = "";
        if (clientData) {
            context = `
                Client: ${clientData.name}
                Loan: ${clientData.loanAmount}
                Status: ${clientData.status}
                Last Notes: ${clientData.notes}
            `;
        } else {
            context = "Client not found in database. Provide general high-net-worth prep.";
        }

        const prompt = `
            Act as a Private Banking Chief of Staff.
            Prepare a "Cheat Sheet" for a meeting/call with ${clientName}.
            
            **Client Context**:
            ${context}
            
            **Output**:
            Markdown format.
            - **Objective**: 1 sentence goal.
            - **Key Stats**: Bullet points (Loan amt, rate if known).
            - **Talking Points**: 2-3 strategic questions or updates.
            - **Missing Items**: If status is active, list likely missing docs based on loan stage.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: 2048 }
            }
        });
        return response.text || '';
    });
};

// --- Knowledge Base Tools ---

export const generateObjectionScript = async (objection: string): Promise<SalesScript> => {
    return withRetry(async () => {
        const ai = getAiClient();
        const prompt = `
            Act as a Master Sales Coach for high-net-worth mortgage banking.
            
            **Client Objection**: "${objection}"
            
            **Mission**:
            Write a powerful, psychological script to overcome this objection.
            - Tone: Empathetic but authoritative.
            - Technique: Use "Feel, Felt, Found" or "Reframing".
            
            **Output**:
            JSON format.
            {
                "title": "Short catchy title",
                "content": "The actual script text...",
                "tags": ["Tag1", "Tag2"]
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
                        title: { type: Type.STRING },
                        content: { type: Type.STRING },
                        tags: { type: Type.ARRAY, items: { type: Type.STRING } }
                    }
                }
            }
        });

        const data = parseJson<Partial<SalesScript>>(response.text || "{}", {});
        return {
            id: Date.now().toString(),
            category: 'Objection',
            title: data.title || 'Custom Rebuttal',
            content: data.content || 'Script generation failed.',
            tags: data.tags || ['Custom']
        };
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
    
    if (!result || !result.action) {
        throw new Error("Schema mismatch: Invalid command structure.");
    }

    if (!result.payload) {
        result.payload = {};
    }
    
    return result;
  });
};
