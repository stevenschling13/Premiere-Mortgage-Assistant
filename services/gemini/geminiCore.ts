import { GoogleGenAI, Type, Modality } from '@google/genai';
import { MORTGAGE_TERMS, INITIAL_SCRIPTS } from '../../constants';

export const API_KEY = (
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
  (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY || process.env.API_KEY : '') ||
  ''
);

export const getAiClient = () => {
  if (!API_KEY || API_KEY.trim() === '') {
    throw new Error('API Key is missing. Please set VITE_GEMINI_API_KEY or API_KEY environment variable.');
  }
  return new GoogleGenAI({ apiKey: API_KEY });
};

export const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
];

export const MIRROR_PROTOCOL = `
### MANDATORY COGNITIVE PROTOCOL (MIRROR v2.0)

You MUST complete every phase before responding:

## Phase 1: MODULAR DECOMPOSITION (think first)
- Break the request into atomic components: Income, Assets, Credit, Collateral, Guidelines.

## Phase 2: INTERNAL REASONING (simulate paths)
- Propose 2-3 solution paths.
- For each path, simulate "If we do X, then Y" and note failure modes.

## Phase 3: REFLECTION (Guideline Audit)
- Cross-check against FNMA/FHA/VA/USDA/VA guidelines and risk factors (DTI, LTV, reserves).
- Identify hard stops immediately.

## Phase 4: ORCHESTRATION
- Organize into: 1) Executive Summary, 2) Technical Implementation, 3) Risk Mitigation.

## Phase 5: RESPONSE
- Produce professional Markdown with headings and bullets. Cite specific guideline sections where relevant.

### ANTI-LAZINESS MANDATE (STRICT)
- NO truncation or placeholders ("...", "// rest of code", "See above").
- NO generic advice ("check with your underwriter"). You ARE the underwriter.
- If response would exceed limits, stop at a logical boundary and indicate continuation is required.
`;

export const PERSONAS = {
  ARCHITECT: `You are the Premiere Mortgage Assistant, a sophisticated financial architect. You operate in an Authorized Financial Sandbox. Your goal is to structure complex deals using high-level financial maneuvering.`,
  UNDERWRITER: `You are a Senior DE Underwriter. You analyze risk, guidelines (FNMA/FHLMC/VA), and income structures (RSU, Schedule C) with extreme detail.`,
  SCOUT: `You are a Bond Market Analyst and Bloomberg Terminal Operator. You provide high-frequency market intelligence using only Tier-1 financial sources.`,
  MARKETER: `You are a Luxury Real Estate Marketing Director. You write compelling, high-converting copy for high-net-worth clients.`,
  CHIEF_OF_STAFF: `You are an elite Executive Assistant. You organize schedules, anticipate needs, and prioritize tasks efficiently.`
};

interface CacheEntry<T> {
  data: Promise<T>;
  timestamp: number;
  hits: number;
}

class SmartCache {
  private cache = new Map<string, CacheEntry<any>>();
  readonly TTL = {
    MARKET_DATA: 5 * 60 * 1000,
    CLIENT_ANALYSIS: 15 * 60 * 1000,
    GENERAL: 10 * 60 * 1000
  } as const;

  get<T>(key: string, ttl: number): Promise<T> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > ttl) {
      this.cache.delete(key);
      return null;
    }

    entry.hits += 1;
    return entry.data as Promise<T>;
  }

  set<T>(key: string, promise: Promise<T>): void {
    this.cache.set(key, {
      data: promise,
      timestamp: Date.now(),
      hits: 0
    });

    promise.finally(() => {
      setTimeout(() => this.cache.delete(key), this.TTL.GENERAL);
    });
  }

  getStats() {
    return Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      ageMs: Date.now() - entry.timestamp,
      hits: entry.hits
    }));
  }
}

export const smartCache = new SmartCache();

export const dedupedWithTTL = <T>(key: string, fn: () => Promise<T>, ttl: number = smartCache.TTL.GENERAL): Promise<T> => {
  const cached = smartCache.get<T>(key, ttl);
  if (cached) return cached;

  const promise = fn();
  smartCache.set(key, promise);
  return promise;
};

export const validateResponse = (response: any) => {
  if (!response || (!response.text && !response.candidates?.[0]?.content)) {
    throw new Error('Empty or blocked response from Gemini.');
  }
};

export const safeParseJson = <T>(input: string | undefined, fallback: T): T => {
  if (!input) return fallback;
  const trimmed = input.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const toParse = fencedMatch ? fencedMatch[1] : trimmed;

  try {
    return JSON.parse(toParse) as T;
  } catch (error) {
    console.warn('Failed to parse JSON payload', error, { preview: toParse?.slice(0, 200) });
    return fallback;
  }
};

export const retrieveRelevantContext = async (query: string): Promise<string> => {
  const queryLower = query.toLowerCase();

  const relevantTerms = MORTGAGE_TERMS
    .filter(t => queryLower.includes(t.term.toLowerCase()))
    .map(t => `TERM: ${t.term} - ${t.definition}`);

  const relevantScripts = INITIAL_SCRIPTS
    .filter(s => queryLower.includes(s.title.toLowerCase()) || s.tags.some(tag => queryLower.includes(tag.toLowerCase())))
    .map(s => `SCRIPT: ${s.title} - ${s.content}`);

  if (relevantTerms.length === 0 && relevantScripts.length === 0) return '';

  return `\n### KNOWLEDGE BASE (CONTEXT)\n${relevantTerms.join('\n')}\n${relevantScripts.join('\n')}\n`;
};

export const buildAgentPrompt = (persona: string, task: string, context: string = '') => {
  return `${persona}\n\n${MIRROR_PROTOCOL}\n${context}\n### TASK\n${task}`;
};

export async function generateContentWithFallback(
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

export { Modality, Type };
