import { Type } from '@google/genai';
import { MarketIndex, MarketingCampaign, NewsItem, VerificationResult } from '../../types';
import {
  buildAgentPrompt,
  dedupedWithTTL,
  generateContentWithFallback,
  PERSONAS,
  safeParseJson,
  smartCache
} from './geminiCore';
import { verifyFactualClaims } from './assistantService';

export const fetchDailyMarketPulse = async (): Promise<{ indices: MarketIndex[]; news: NewsItem[]; sources: { uri: string; title: string }[] }> => {
  return dedupedWithTTL('market-pulse', async () => {
    const prompt = buildAgentPrompt(
      PERSONAS.SCOUT,
      `Get current LIVE market data.
            1. Values: 10-Year Treasury, S&P 500, UMBS 5.5, Brent Crude.
            2. News: 3 most important mortgage headlines today.

            Output JSON: { "indices": [...], "news": [...] }`
    );

    const response = await generateContentWithFallback('gemini-3-pro-preview', prompt, {
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingBudget: 2048 },
      responseMimeType: 'application/json'
    }, 'gemini-2.5-flash');

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources: { uri: string; title: string }[] = groundingChunks.reduce((acc: { uri: string; title: string }[], chunk: any) => {
      if (chunk?.web?.uri && chunk?.web?.title) {
        acc.push({ uri: chunk.web.uri, title: chunk.web.title });
      }
      return acc;
    }, []);

    const data = safeParseJson<{ indices?: MarketIndex[]; news?: NewsItem[] }>(response.text, { indices: [], news: [] });

    return {
      indices: data.indices || [],
      news: data.news || [],
      sources
    };
  }, smartCache.TTL.MARKET_DATA);
};

export const generateClientFriendlyAnalysis = async (context: any): Promise<string> => {
  const prompt = buildAgentPrompt(
    PERSONAS.ARCHITECT,
    `Write a "Daily Brief" for clients explaining how today's market data impacts mortgage rates.
        Data: ${JSON.stringify(context)}.
        Keep it simple, advisory, and reassuring.`
  );
  const response = await generateContentWithFallback('gemini-2.5-flash', prompt, {});
  return response.text || '';
};

export const generateBuyerSpecificAnalysis = async (context: any): Promise<string> => {
  const prompt = buildAgentPrompt(
    PERSONAS.ARCHITECT,
    `Analyze impact for active buyers (Purchasing Power focus).
        Data: ${JSON.stringify(context)}.
        Explain if today is a good day to lock or float.`
  );
  const response = await generateContentWithFallback('gemini-2.5-flash', prompt, {});
  return response.text || '';
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

  return safeParseJson<MarketingCampaign>(response.text, {
    linkedInPost: '',
    emailSubject: '',
    emailBody: '',
    smsTeaser: ''
  });
};

export const verifyCampaignContent = async (campaign: MarketingCampaign): Promise<VerificationResult> => {
  return verifyFactualClaims(campaign.emailBody + ' ' + campaign.linkedInPost);
};

export const analyzeRateTrends = async (rates: any): Promise<string> => {
  const prompt = buildAgentPrompt(
    PERSONAS.SCOUT,
    `Analyze these rates compared to typical market spread: ${JSON.stringify(rates)}. Comment on the yield curve implication.`
  );
  const response = await generateContentWithFallback('gemini-3-pro-preview', prompt, {
    thinkingConfig: { thinkingBudget: 2048 }
  });
  return response.text || '';
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
  return response.text || '';
};
