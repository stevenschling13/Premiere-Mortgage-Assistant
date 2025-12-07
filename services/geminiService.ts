
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Client, CommandIntent, EmailLog, MarketIndex, NewsItem } from "../types";
import { Logger } from "./logger";
import { loadFromStorage, StorageKeys } from "./storageService";

// --- Configuration & Validation ---

const getAIClient = () => {
  // Priority: 1. User Settings (LocalStorage) 2. Environment Variable
  const storedKey = loadFromStorage<string>(StorageKeys.API_KEY, '');
  const envKey = process.env.API_KEY;
  const apiKey = storedKey || envKey;

  if (!apiKey) {
      throw new Error("API Key is missing. Please configure it in Settings.");
  }
  return new GoogleGenAI({ apiKey: apiKey });
};

// --- Cognitive Architecture: System Blueprint ---

const SYSTEM_INSTRUCTION = `
<system_instruction>
  <role>
    You are the "Premiere Private Banking Assistant", an elite AI architected for high-net-worth mortgage banking.
    You do not behave like a generic chatbot. You are a sophisticated financial analyst and relationship strategist.
  </role>

  <persona>
    <tone>Professional, Anticipatory, Concise, Exclusive.</tone>
    <expertise>
      - Jumbo & Super Jumbo Loan Structuring
      - Complex Income Analysis (RSU, Trust, Asset Depletion)
      - Bond Market Dynamics (10yr Treasury vs MBS spreads)
      - Private Wealth Relationship Management
    </expertise>
  </persona>

  <critical_constraints>
    <rule id="1">DATA INTEGRITY: Cite ONLY Tier-1 Financial Sources (Bloomberg, WSJ, Fed, Mortgage News Daily).</rule>
    <rule id="2">COMPLIANCE: Never provide binding tax or legal advice. Always append disclaimers for rates/approvals.</rule>
    <rule id="3">PRECISION: When discussing rates, specify "Indicative Par Rates" unless live data is present.</rule>
    <rule id="4">OUTPUT: Use clear formatting (Bullet points, Bold key terms) for readability.</rule>
  </critical_constraints>

  <context>
    The user is a "Unicorn" Private Mortgage Banker (Volume Arbitrage Model).
    Goals: Maximize volume, maintain white-glove service, manage risk.
  </context>
</system_instruction>
`;

// --- Text Generation & Chat ---

export const generateEmailDraft = async (client: Client, topic: string, specificDetails: string) => {
  try {
    const ai = getAIClient();
    
    // Prompt Engineering: Task-Specific Context Injection
    const prompt = `
    <task>Draft a high-touch email for a private banking client.</task>
    
    <client_profile>
      <name>${client.name}</name>
      <status>${client.status}</status>
      <loan_context>$${client.loanAmount.toLocaleString()} (${client.propertyAddress})</loan_context>
    </client_profile>
    
    <email_objective>${topic}</email_objective>
    
    <key_details>
      ${specificDetails}
    </key_details>
    
    <style_guide>
      - Opening: Warm but professional.
      - Body: Direct, value-focused, avoiding "salesy" fluff.
      - Closing: Clear next steps or Call to Action.
      - Subject Line: Compelling, implies exclusivity.
    </style_guide>
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7, // Higher for creative fluency
        topP: 0.9,
        topK: 40,
      }
    });
    return response.text;
  } catch (error) {
    Logger.error("Error generating email", error);
    throw new Error("Unable to draft email. Check API Key configuration.");
  }
};

export const generateSubjectLines = async (client: Client, topic: string): Promise<string[]> => {
  try {
    const ai = getAIClient();
    const prompt = `Generate 3 high-performing email subject lines for client ${client.name} regarding "${topic}".
    Context: Loan $${client.loanAmount.toLocaleString()}.
    Requirement: Return JSON array of strings only.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        },
        temperature: 0.8 // High creativity for marketing hooks
      }
    });

    if (response.text) {
        return JSON.parse(response.text) as string[];
    }
    return [];
  } catch (error) {
    Logger.error("Error generating subject lines", error);
    return [];
  }
};

export const generateMarketingContent = async (channel: string, topic: string, tone: string, context?: string) => {
  try {
    const ai = getAIClient();
    const prompt = `
    <role>Senior Marketing Director for Luxury Real Estate Finance</role>
    <task>Create content for ${channel}</task>
    <topic>${topic}</topic>
    <tone>${tone}</tone>
    <market_context>${context || 'General market expertise'}</market_context>
    
    <channel_rules>
       <linkedin>Professional, authoritative, 3-4 strategic hashtags, spaced paragraphs.</linkedin>
       <email>Compelling subject, value-first body, clear CTA.</email>
       <sms>Under 160 chars, urgent, personal.</sms>
    </channel_rules>
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { 
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.6 
        }
    });
    return response.text;
  } catch (error) {
    Logger.error("Error generating marketing content", error);
    throw error;
  }
};

export const chatWithAssistant = async (history: Array<{role: string, parts: Array<{text: string}>}>, message: string) => {
  try {
    const ai = getAIClient();
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash', 
      history: history,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{googleSearch: {}}],
        temperature: 0.4, // Balanced for chat
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

  } catch (error) {
    Logger.error("Error in chat", error);
    throw error; 
  }
};

// --- Thinking Mode (Gemini 3 Pro) ---

export const analyzeLoanScenario = async (scenarioData: string) => {
  try {
    const ai = getAIClient();
    
    // Chain-of-Thought Strategy
    const cotPrompt = `
    <task>Perform a Deep-Dive Risk Assessment on this Jumbo Loan Scenario.</task>
    <data>${scenarioData}</data>
    
    <reasoning_protocol>
      1. ANALYZE DTI: Calculate Front-End and Back-End ratios. Flag if > 43%.
      2. ANALYZE ASSETS: Assess post-closing liquidity requirements for Jumbo guidelines (usually 12-24 months reserves).
      3. EVALUATE COLLATERAL: Consider LTV impact on rate and risk.
      4. IDENTIFY COMPENSATING FACTORS: High credit score? Low LTV? High residual income?
      5. FORMULATE STRATEGY: Suggest structure (IO, 7/1 ARM) to mitigate risk.
    </reasoning_protocol>

    <output_format>
      Provide a structured "Underwriter's Memo":
      1. **Strengths**: 3 key positive factors.
      2. **Risk Factors**: 3 potential challenges.
      3. **Strategic Recommendation**: Actionable structuring advice.
    </output_format>
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: cotPrompt,
      config: {
        thinkingConfig: { thinkingBudget: 32768 },
        temperature: 0.2, // Low temperature for deterministic analysis
      }
    });
    return response.text;
  } catch (error) {
    Logger.error("Error in thinking analysis", error);
    throw error;
  }
}

// --- Market Pulse & Deep Thinking ---

export const fetchDailyMarketPulse = async (): Promise<{ indices: MarketIndex[], news: NewsItem[] }> => {
  try {
    const ai = getAIClient();
    const today = new Date().toLocaleDateString();
    
    const prompt = `
      Find current market data for today, ${today}.
      
      <sources>
      STRICTLY use: Bloomberg, CNBC, Mortgage News Daily, Federal Reserve, WSJ.
      </sources>

      <requirements>
      1. 10-Year Treasury Yield (Value and daily change).
      2. S&P 500 Index (Value and daily change).
      3. Average 30-Year Fixed Mortgage Rate.
      4. 3 top news headlines impacting Mortgage Rates/Housing.
      </requirements>

      <output_format>
      JSON ONLY. No markdown.
      Schema:
      {
        "indices": [
           { "label": "10-Yr Treasury", "value": "x.xx%", "change": "+/-x.xx", "isUp": boolean },
           ...
        ],
        "news": [
           { "id": "1", "source": "Source", "date": "Date", "title": "Headline", "summary": "Short summary", "category": "Rates" | "Economy" | "Housing" }
        ]
      }
      </output_format>
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.1, // Near-deterministic for data extraction
      }
    });

    if (response.text) {
       const cleanJson = response.text.replace(/```json\n?|\n?```/g, '').trim();
       try {
           const data = JSON.parse(cleanJson);
           return data;
       } catch (parseError) {
           Logger.error("Failed to parse market data JSON", parseError);
           throw new Error("Data parse error.");
       }
    }
    throw new Error("No data returned");
  } catch (error) {
    Logger.error("Error fetching daily pulse", error);
    throw error;
  }
};

export const generateClientFriendlyAnalysis = async (marketData: any) => {
  try {
    const ai = getAIClient();
    
    const prompt = `
      <role>Mortgage Market Translator</role>
      <input>${JSON.stringify(marketData)}</input>
      
      <mission>
      Translate these technical financial metrics into a "Client Brief" that a first-time homebuyer can understand.
      Use analogies (e.g., "The 10-Year Treasury is like the weather forecast for mortgage rates...").
      </mission>
      
      <output>
      - What It Means For You (Simple summary)
      - Recommendation (Lock or Float)
      </output>
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 2048 },
        temperature: 0.5
      }
    });
    return response.text;
  } catch (error) {
    Logger.error("Error generating client analysis", error);
    throw error;
  }
}

export const analyzeRateTrends = async (rates: any) => {
  try {
    const ai = getAIClient();
    const prompt = `Analyze these daily par rates:
    - 30-Yr Conforming: ${rates.conforming30}%
    - 30-Yr Jumbo: ${rates.jumbo30}%
    
    Provide a 2-sentence commentary on the Yield Curve and the Jumbo vs. Conforming spread. Advise on "Float vs. Lock".`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { systemInstruction: SYSTEM_INSTRUCTION }
    });
    return response.text;
  } catch (error) {
    Logger.error("Error analyzing rates", error);
    throw error;
  }
}

export const synthesizeMarketNews = async (newsItems: any[]) => {
  try {
    const ai = getAIClient();
    const headlines = newsItems.map(n => `- ${n.title}: ${n.summary}`).join('\n');
    const prompt = `Synthesize these headlines into a concise "Market Flash" (bullet points) for high-net-worth clients.
    ${headlines}`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { systemInstruction: SYSTEM_INSTRUCTION }
    });
    return response.text;
  } catch (error) {
    Logger.error("Error synthesizing news", error);
    throw error;
  }
}

export const analyzeIncomeProjection = async (clients: Client[], currentCommission: number) => {
    try {
        const ai = getAIClient();
        const pipelineData = clients.map(c => 
            `- ${c.name}: $${c.loanAmount} (${c.status})`
        ).join('\n');

        const prompt = `
            You are a Financial Performance Analyst.
            
            **Current Realized Commission YTD**: $${currentCommission}
            
            **Current Pipeline**:
            ${pipelineData}
            
            **Task**:
            Write a cohesive, natural-language executive summary (2-3 paragraphs) analyzing progress.
            - Estimate "Risk-Adjusted" commission.
            - Identify critical deals.

            **STYLE**: Plain text paragraphs only. No markdown.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { systemInstruction: "Plain text paragraphs only." }
        });
        return response.text;
    } catch (error) {
        Logger.error("Error analyzing compensation", error);
        throw error;
    }
};

export const transcribeAudio = async (base64Audio: string, mimeType: string = 'audio/webm'): Promise<string> => {
    try {
        const ai = getAIClient();
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
    } catch (error) {
        Logger.error("Error transcribing audio", error);
        throw new Error("Audio transcription failed.");
    }
};

export const generateSpeech = async (text: string): Promise<string> => {
    try {
        const ai = getAIClient();
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
        if (!base64Audio) throw new Error("No audio generated");
        return base64Audio;
    } catch (error) {
        Logger.error("Error generating speech", error);
        throw error;
    }
};

export const parseNaturalLanguageCommand = async (transcript: string, validStatuses?: string[]): Promise<CommandIntent> => {
  try {
    const statusList = validStatuses ? validStatuses.join("', '") : "Lead', 'Pre-Approval', 'Underwriting', 'Clear to Close', 'Closed";

    const ai = getAIClient();
    const prompt = `
      You are a command parser for a Mortgage CRM. Convert the user's natural language request into a specific JSON Action.
      
      **Available Actions**:
      1. CREATE_CLIENT
      2. UPDATE_CLIENT
      3. ADD_NOTE
      4. ADD_TASK

      **Status Values**: '${statusList}'. 

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

    if (response.text) {
      return JSON.parse(response.text) as CommandIntent;
    }
    throw new Error("No response from parser");
  } catch (error) {
    Logger.error("Error parsing command", error);
    return { action: 'UNKNOWN', payload: {} };
  }
};
