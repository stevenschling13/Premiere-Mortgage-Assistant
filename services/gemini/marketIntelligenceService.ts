import { Type } from "@google/genai";
import { MarketIndex, NewsItem, MarketingCampaign, VerificationResult } from "../../types";
import {
    buildAgentPrompt,
    PERSONAS,
    generateContentWithFallback,
    deduped
} from "./geminiCore";

export const fetchDailyMarketPulse = async (): Promise<{ indices: MarketIndex[]; news: NewsItem[]; sources: { uri: string; title: string }[] }> => {
    return deduped("market-pulse", async () => {
        const prompt = buildAgentPrompt(
            PERSONAS.SCOUT,
            `Get current LIVE market data.
            1. Values: 10-Year Treasury, S&P 500, UMBS 5.5, Brent Crude.
            2. News: 3 most important mortgage headlines today.

            Output JSON: { "indices": [...], "news": [...] }`
        );

        const response = await generateContentWithFallback("gemini-3-pro-preview", prompt, {
            tools: [{ googleSearch: {} }],
            thinkingConfig: { thinkingBudget: 2048 },
            responseMimeType: "application/json"
        }, "gemini-2.5-flash");

        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const sources = groundingChunks
            .map((c: any) => (c.web ? { uri: c.web.uri, title: c.web.title } : null))
            .filter((source): source is { uri: string; title: string } => source !== null);

        let data = { indices: [], news: [] };
        try {
            data = JSON.parse(response.text || "{}");
        } catch (e) {
            console.error("Failed to parse market data JSON", e);
        }

        return {
            indices: (data as any).indices || [],
            news: (data as any).news || [],
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
    const response = await generateContentWithFallback("gemini-2.5-flash", prompt, {});
    return response.text || "";
};

export const generateBuyerSpecificAnalysis = async (context: any): Promise<string> => {
    const prompt = buildAgentPrompt(
        PERSONAS.ARCHITECT,
        `Analyze impact for active buyers (Purchasing Power focus).
        Data: ${JSON.stringify(context)}.
        Explain if today is a good day to lock or float.`
    );
    const response = await generateContentWithFallback("gemini-2.5-flash", prompt, {});
    return response.text || "";
};

export const generateMarketingCampaign = async (topic: string, tone: string): Promise<MarketingCampaign> => {
    const prompt = buildAgentPrompt(
        PERSONAS.MARKETER,
        `Create a multi-channel marketing campaign about: "${topic}". Tone: ${tone}.`
    );

    const response = await generateContentWithFallback("gemini-3-pro-preview", prompt, {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                linkedInPost: { type: Type.STRING },
                emailSubject: { type: Type.STRING },
                emailBody: { type: Type.STRING },
                smsTeaser: { type: Type.STRING }
            },
            required: ["linkedInPost", "emailSubject", "emailBody", "smsTeaser"]
        },
        thinkingConfig: { thinkingBudget: 2048 }
    });

    return JSON.parse(response.text || "{}");
};

export const verifyCampaignContent = async (campaign: MarketingCampaign): Promise<VerificationResult> => {
    const { verifyFactualClaims } = await import("./assistantService");
    return verifyFactualClaims(campaign.emailBody + " " + campaign.linkedInPost);
};

export const analyzeRateTrends = async (context: any): Promise<string> => {
    const prompt = buildAgentPrompt(
        PERSONAS.SCOUT,
        `Analyze rate trends using today's data: ${JSON.stringify(context)}.
        Provide trading desk style commentary.`
    );
    const response = await generateContentWithFallback("gemini-3-pro-preview", prompt, { thinkingConfig: { thinkingBudget: 2048 } });
    return response.text || "";
};

export const generateRateSheetEmail = async (context: { rates: any; notes: string }): Promise<string> => {
    const prompt = buildAgentPrompt(
        PERSONAS.MARKETER,
        `Write a "Rate Sheet Alert" email with actionable guidance.
        Context: ${JSON.stringify(context)}.`
    );
    const response = await generateContentWithFallback("gemini-2.5-flash", prompt, {});
    return response.text || "";
};
