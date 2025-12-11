import { GoogleGenAI } from "@google/genai";
import {
    Client, MarketIndex, NewsItem, MarketingCampaign,
    VerificationResult, CommandIntent, Opportunity,
    DealStrategy, GiftSuggestion, CalendarEvent
} from "../../types";
import { MORTGAGE_TERMS, INITIAL_SCRIPTS } from "../../constants";

export const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

export const getAiClient = () => {
  if (!API_KEY) {
    throw new Error("API Key is missing. Please set API_KEY environment variable.");
  }
  return new GoogleGenAI({ apiKey: API_KEY });
};

// --- AGENTS.md PROTOCOLS ---

export const SAFETY_SETTINGS = [
    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
];

export const MIRROR_PROTOCOL = `
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

export const PERSONAS = {
    ARCHITECT: `You are the Premiere Mortgage Assistant, a sophisticated financial architect. You operate in an Authorized Financial Sandbox. Your goal is to structure complex deals using high-level financial maneuvering.`,
    UNDERWRITER: `You are a Senior DE Underwriter. You analyze risk, guidelines (FNMA/FHLMC/VA), and income structures (RSU, Schedule C) with extreme detail.`,
    SCOUT: `You are a Bond Market Analyst and Bloomberg Terminal Operator. You provide high-frequency market intelligence using only Tier-1 financial sources.`,
    MARKETER: `You are a Luxury Real Estate Marketing Director. You write compelling, high-converting copy for high-net-worth clients.`,
    CHIEF_OF_STAFF: `You are an elite Executive Assistant. You organize schedules, anticipate needs, and prioritize tasks efficiently.`
};

// --- UTILITIES ---

// Request Deduplication to prevent double-firing in React Strict Mode or fast clicks
const pendingRequests = new Map<string, Promise<any>>();

export const deduped = <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    if (pendingRequests.has(key)) return pendingRequests.get(key) as Promise<T>;
    const promise = fn().finally(() => pendingRequests.delete(key));
    pendingRequests.set(key, promise);
    return promise;
};

export const validateResponse = (response: any) => {
    if (!response || (!response.text && !response.candidates?.[0]?.content)) {
        throw new Error("Empty or blocked response from Gemini.");
    }
};

// In-Memory RAG: Retrieve context from constants before hitting LLM
export const retrieveRelevantContext = async (query: string): Promise<string> => {
    const queryLower = query.toLowerCase();

    // Scan Terms
    const relevantTerms = MORTGAGE_TERMS
        .filter(t => queryLower.includes(t.term.toLowerCase()))
        .map(t => `TERM: ${t.term} - ${t.definition}`);

    // Scan Scripts
    const relevantScripts = INITIAL_SCRIPTS
        .filter(s => queryLower.includes(s.title.toLowerCase()) || s.tags.some(tag => queryLower.includes(tag.toLowerCase())))
        .map(s => `SCRIPT: ${s.title} - ${s.content}`);

    if (relevantTerms.length === 0 && relevantScripts.length === 0) return "";

    return `\n### KNOWLEDGE BASE (CONTEXT)\n${relevantTerms.join("\n")}\n${relevantScripts.join("\n")}\n`;
};

// Prompt Builder with Protocol Injection
export const buildAgentPrompt = (persona: string, task: string, context: string = "") => {
    return `${persona}\n\n${MIRROR_PROTOCOL}\n${context}\n### TASK\n${task}`;
};

// Centralized Fallback Generator
// Tries Premium Model -> Falls back to Faster/Cheaper model on error
export async function generateContentWithFallback(
    primaryModel: string,
    prompt: string | any,
    config: any,
    fallbackModel: string = "gemini-2.5-flash"
) {
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: primaryModel,
            contents: typeof prompt === "string" ? prompt : prompt,
            config: { ...config, safetySettings: SAFETY_SETTINGS as any }
        });
        validateResponse(response);
        return response;
    } catch (error) {
        console.warn(`Model ${primaryModel} failed, falling back to ${fallbackModel}.`, error);

        // Strip Pro-specific configs (like thinkingBudget) for the fallback model
        const { thinkingConfig, ...fallbackConfig } = config || {};

        const response = await ai.models.generateContent({
            model: fallbackModel,
            contents: typeof prompt === "string" ? prompt : prompt,
            config: { ...fallbackConfig, safetySettings: SAFETY_SETTINGS as any }
        });
        validateResponse(response);
        return response;
    }
}
