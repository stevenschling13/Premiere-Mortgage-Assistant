import { Type } from '@google/genai';
import { CommandIntent, VerificationResult, Client, MarketIndex, Opportunity } from '../../types';
import {
  buildAgentPrompt,
  dedupedWithTTL,
  generateContentWithFallback,
  getAiClient,
  PERSONAS,
  retrieveRelevantContext,
  SAFETY_SETTINGS,
  safeParseJson,
  smartCache
} from './geminiCore';

export async function* streamChatWithAssistant(
  history: Array<{ role: string; parts: Array<{ text: string }> }>,
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
    console.warn('Pro Chat failed, fallback to Flash');
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
  return dedupedWithTTL(`verify-${text.substring(0, 30)}`, async () => {
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
    const sources = groundingChunks.flatMap((c: any) => {
      if (!c.web) return [];
      return [{ uri: String(c.web.uri || ''), title: String(c.web.title || '') }];
    });

    const parsed = safeParseJson<any>(response.text, { status: 'UNVERIFIABLE', text: response.text });

    return {
      status: parsed.status || 'UNVERIFIABLE',
      text: parsed.text || response.text || '',
      sources: sources.length > 0 ? sources : (parsed.sources || [])
    };
  }, smartCache.TTL.CLIENT_ANALYSIS);
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

  return safeParseJson<CommandIntent>(response.text, { action: 'UNKNOWN', payload: {} as any } as CommandIntent);
};

export const scanPipelineOpportunities = async (clients: Client[], marketIndices: MarketIndex[]): Promise<Opportunity[]> => {
  return dedupedWithTTL('pipeline-scan', async () => {
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
            1. **Rate Differential**: Identify clients whose 'currentRate' is significantly higher (>0.5%) than today's market rates (estimate market rate from 10yr yield/MBS data).
            2. **Cash-Out Triggers**: Identify 'Equity' or 'Debt Consolidation' plays based on notes.
            3. **Stale Leads**: Identify active clients with no action in > 14 days.

            Return JSON array of Opportunity objects.`
    );

    const response = await generateContentWithFallback(
      'gemini-3-pro-preview',
      prompt,
      {
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 4096 }
      }
    );
    return safeParseJson<Opportunity[]>(response.text, []);
  }, smartCache.TTL.CLIENT_ANALYSIS);
};
