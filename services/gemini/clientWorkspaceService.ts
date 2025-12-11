import { Type } from "@google/genai";
import { Client, DealStrategy, GiftSuggestion } from "../../types";
import {
    getAiClient,
    buildAgentPrompt,
    generateContentWithFallback,
    PERSONAS
} from "./geminiCore";

export const generateClientSummary = async (client: Client): Promise<string> => {
    const recentEmails = client.emailHistory?.slice(0, 5).map(e => ({ date: e.date, subject: e.subject })) || [];
    const recentTasks = client.checklist?.filter(t => t.checked).slice(0, 5).map(t => t.label) || [];

    const context = {
        profile: {
            name: client.name,
            loanAmount: client.loanAmount,
            status: client.status,
            currentRate: client.currentRate || "Unknown",
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

    const response = await generateContentWithFallback("gemini-3-pro-preview", prompt, {
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
    const response = await generateContentWithFallback("gemini-2.5-flash", prompt, {});
    return response.text || "";
};

export const generateSubjectLines = async (client: Client, topic: string): Promise<string[]> => {
    const prompt = buildAgentPrompt(
        PERSONAS.MARKETER,
        `Generate 3 catchy email subject lines for: ${topic} to client ${client.name}.
        Return as JSON array of strings.`
    );
    const response = await generateContentWithFallback("gemini-2.5-flash", prompt, {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
    });
    try {
        return JSON.parse(response.text || "[]");
    } catch {
        return [];
    }
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
    const response = await generateContentWithFallback("gemini-2.5-flash", prompt, {});
    return response.text || "";
};

export const estimatePropertyDetails = async (address: string): Promise<{ estimatedValue: number }> => {
    const prompt = buildAgentPrompt(PERSONAS.SCOUT, `Estimate value for: ${address}. Return JSON: { "estimatedValue": number }.`);
    const response = await generateContentWithFallback("gemini-2.5-flash", prompt, {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json"
    });

    try {
        const clean = response.text?.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(clean || "{\"estimatedValue\": 0}");
    } catch {
        return { estimatedValue: 0 };
    }
};

export const generateSmartChecklist = async (client: Client): Promise<string[]> => {
    const prompt = buildAgentPrompt(PERSONAS.ARCHITECT, `Generate 3-5 specific checklist tasks for a mortgage client in "${client.status}" stage.
    Client info: ${client.name}, ${client.loanAmount}.
    Return JSON array of strings.`);

    const response = await generateContentWithFallback("gemini-2.5-flash", prompt, {
        responseMimeType: "application/json",
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

    const response = await generateContentWithFallback("gemini-3-pro-preview", prompt, {
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
                },
                required: ["title", "type", "monthlyPayment", "pros", "cons", "description"]
            }
        },
        thinkingConfig: { thinkingBudget: 4096 }
    });
    return JSON.parse(response.text || "[]");
};

export const extractClientDataFromImage = async (base64Image: string): Promise<Partial<Client>> => {
    const ai = getAiClient();
    const prompt = "Extract client details (Name, Address, Loan Amount, Rate, Phone, Email) from this document. Return JSON.";

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: {
            parts: [
                { inlineData: { mimeType: "image/jpeg", data: base64Image } },
                { text: prompt }
            ]
        },
        config: { responseMimeType: "application/json" }
    });

    return JSON.parse(response.text || "{}");
};

export const generateGiftSuggestions = async (client: Client): Promise<GiftSuggestion[]> => {
    const prompt = buildAgentPrompt(PERSONAS.MARKETER, `Suggest 3 closing gifts for client ${client.name}, loan size $${client.loanAmount}. Return JSON.`);
    const response = await generateContentWithFallback("gemini-2.5-flash", prompt, {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    item: { type: Type.STRING },
                    reason: { type: Type.STRING },
                    priceRange: { type: Type.STRING }
                },
                required: ["item", "reason", "priceRange"]
            }
        }
    });
    return JSON.parse(response.text || "[]");
};

export const transcribeAudio = async (base64Audio: string): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: {
            parts: [
                { inlineData: { mimeType: "audio/webm", data: base64Audio } },
                { text: "Transcribe this audio exactly." }
            ]
        }
    });
    return response.text || "";
};

export const organizeScratchpadNotes = async (notes: string): Promise<string> => {
    const prompt = buildAgentPrompt(
        PERSONAS.ARCHITECT,
        `Organize these scratchpad notes into bullet points and next steps. Notes: ${notes}`
    );
    const response = await generateContentWithFallback("gemini-2.5-flash", prompt, {});
    return response.text || "";
};
