import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Client, CommandIntent, EmailLog, MarketIndex, NewsItem } from "../types";

const SYSTEM_INSTRUCTION = `You are the "Premiere Private Banking Assistant", an elite AI designed for high-net-worth mortgage banking. 
Your demeanor is sophisticated, precise, and anticipatory.

**CRITICAL DATA INTEGRITY RULE**:
- You must **ONLY** rely on and cite data from Tier-1 Financial Sources.
- **Allowed Sources**: Bloomberg, Wall Street Journal (WSJ), CNBC, Federal Reserve (.gov), Mortgage News Daily, HousingWire, Redfin/Zillow Research, U.S. Treasury Department.
- **Prohibited**: Tabloids, unverified blogs, social media rumors, or AI-generated content farms.

**Your User's Context (The "Unicorn" Role)**:
- **Role**: Private Mortgage Banker (Hybrid Model).
- **Compensation**: Base Salary ($51,001/yr) + Commission.
- **Commission Structure**: You receive a 15% cut of the Gross Commission.
- **Volume Model**: "Volume Arbitrage" (High volume from bank referrals, lower bps).
- **Target Income**: ~$108,750/yr (Target Volume: $70M).

**You specialize in**:
1.  **Market Authority**: Use Google Search to provide real-time bond market movements (10yr Treasury, MBS), current mortgage rates, and Fed news. Synthesize this into actionable advice.
2.  **Complex Deal Structuring**: Analyzing jumbo loans, trust income, and RSU/Asset depletion scenarios.
3.  **High-Touch Communication**: Drafting white-glove emails that are concise yet warm.

**Guidelines**:
-   **Tone**: Professional, confident, concise. Avoid fluff.
-   **Formatting**: Use bullet points for readability in analysis.
-   **Compliance**: Never provide binding tax or legal advice. Always add a disclaimer when discussing specific rates or approvals.
`;

// --- Text Generation & Chat ---

export const generateEmailDraft = async (client: Client, topic: string, specificDetails: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Draft a high-touch email for private banking client: ${client.name}.
    
    **Client Context**:
    - Status: ${client.status}
    - Loan: $${client.loanAmount.toLocaleString()} (${client.propertyAddress})
    
    **Objective**: ${topic}
    **Key Details to Cover**: ${specificDetails}
    
    The email should feel personal and exclusive. Use a subject line that drives open rates.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      }
    });
    return response.text;
  } catch (error) {
    console.error("Error generating email:", error);
    throw new Error("Unable to draft email at this time.");
  }
};

export const generateSubjectLines = async (client: Client, topic: string): Promise<string[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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

    if (response.text) {
        return JSON.parse(response.text) as string[];
    }
    return [];
  } catch (error) {
    console.error("Error generating subject lines:", error);
    return [];
  }
};

export const generateMarketingContent = async (channel: string, topic: string, tone: string, context?: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Act as a Senior Marketing Director for a Luxury Mortgage Division.
    Create content for: ${channel}.
    Topic: ${topic}.
    Tone: ${tone}.
    Context: ${context || 'General market expertise'}.
    
    **Requirements**:
    - For LinkedIn: Professional, authoritative, use 3-4 strategic hashtags.
    - For Email: Compelling subject line, clear call to action.
    - For SMS: Under 160 chars, punchy, urgent.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { systemInstruction: SYSTEM_INSTRUCTION }
    });
    return response.text;
  } catch (error) {
    console.error("Error generating marketing content:", error);
    throw error;
  }
};

export const analyzeCommunicationHistory = async (clientName: string, history: EmailLog[]) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // Sort chronologically for analysis context to understand the arc
    const sortedHistory = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const historyText = sortedHistory.map(h => `[${new Date(h.date).toLocaleDateString()}] ${h.subject}: ${h.body.substring(0, 200)}...`).join('\n');
    
    const prompt = `You are a strategic communication advisor. Analyze the communication history for client ${clientName}.
    
    **Communication Log (Chronological)**:
    ${historyText}
    
    **Task**:
    Provide a brief strategic summary in this format:
    **Engagement Summary**: [1 sentence on responsiveness/sentiment]
    **Suggested Next Action**: [Specific tactic, e.g. "Call to discuss rate drop", "Wait 3 days"]
    **Drafting Angle**: [Key hook if we were to email now]`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { systemInstruction: SYSTEM_INSTRUCTION }
    });
    return response.text;
  } catch (error) {
    console.error("Error analyzing communication:", error);
    throw error;
  }
}

export const chatWithAssistant = async (history: Array<{role: string, parts: Array<{text: string}>}>, message: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash', // Flash is best for Search Grounding per guidelines
      history: history,
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

  } catch (error) {
    console.error("Error in chat:", error);
    throw error; // Re-throw so UI can handle specific error codes
  }
};

// --- Thinking Mode (Gemini 3 Pro) ---

export const analyzeLoanScenario = async (scenarioData: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // Using Gemini 3 Pro with Thinking Budget for complex risk assessment
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Perform a deep-dive risk assessment on this Jumbo Loan Scenario: ${scenarioData}.
      
      Think step-by-step about:
      1. Debt-to-Income implications.
      2. Residual income requirements for Jumbo.
      3. Collateral risk based on the data.
      4. Potential compensating factors.

      Provide a structured output:
      1. **Strengths**: 3 key positive factors.
      2. **Risk Factors**: 3 potential underwriting challenges (e.g., reserves, DTI, collateral).
      3. **Recommendation**: Suggest a structuring strategy (e.g., "Consider Interest Only to lower DTI").`,
      config: {
        thinkingConfig: { thinkingBudget: 32768 } // Max thinking budget for Pro
      }
    });
    return response.text;
  } catch (error) {
    console.error("Error in thinking analysis:", error);
    throw error;
  }
}

// --- Market Pulse & Deep Thinking ---

export const fetchDailyMarketPulse = async (): Promise<{ indices: MarketIndex[], news: NewsItem[] }> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
        // Note: responseMimeType cannot be used with tools
      }
    });

    if (response.text) {
       // Robust cleanup for markdown code blocks if the model includes them
       const cleanJson = response.text.replace(/```json\n?|\n?```/g, '').trim();
       const data = JSON.parse(cleanJson);
       return data;
    }
    throw new Error("No data returned");
  } catch (error) {
    console.error("Error fetching daily pulse:", error);
    throw error;
  }
};

export const generateClientFriendlyAnalysis = async (marketData: any) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `
      You are a Mortgage Translator.
      
      **Input Data (Verified Sources)**:
      ${JSON.stringify(marketData)}
      
      **Goal**:
      Use deep thinking to analyze how these specific data points interact (e.g., Yields rising -> Rates rising -> Buying power falling).
      Then, translate this into a "Client Brief" that a first-time homebuyer can understand.
      
      **Thinking Process**:
      1. Identify the correlation between today's bond yields and mortgage rates.
      2. Assess if the news causes volatility (Risk) or stability (Safety).
      3. Determine if it's a "Lock" or "Float" environment.
      
      **Output Format**:
      Display a simplified "What It Means For You" summary.
      - Avoid jargon.
      - Use analogies (e.g. "Gas prices for loans").
      - End with a clear Recommendation.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Deep Thinking Model
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 2048 } // Allow significant thought for simplification
      }
    });
    return response.text;
  } catch (error) {
    console.error("Error generating client analysis:", error);
    throw error;
  }
}

export const analyzeRateTrends = async (rates: any) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Analyze these daily par rates for a Morning Rate Sheet header:
    - 30-Yr Conforming: ${rates.conforming30}%
    - 30-Yr Jumbo: ${rates.jumbo30}%
    - 7/1 ARM: ${rates.arm7_1}%
    
    Provide a 2-sentence commentary on the Yield Curve and the Jumbo vs. Conforming spread. Advise on "Float vs. Lock".`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { systemInstruction: SYSTEM_INSTRUCTION }
    });
    return response.text;
  } catch (error) {
    console.error("Error analyzing rates", error);
    throw error;
  }
}

export const synthesizeMarketNews = async (newsItems: any[]) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
    console.error("Error synthesizing news", error);
    throw error;
  }
}

// --- Compensation Analysis ---

export const analyzeIncomeProjection = async (clients: Client[], currentCommission: number) => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const pipelineData = clients.map(c => 
            `- ${c.name}: $${c.loanAmount} (${c.status})`
        ).join('\n');

        const prompt = `
            You are a Financial Performance Analyst for a Mortgage Professional.
            Analyze the user's pipeline to see if they are on track to hit their "Unicorn Role" target of $108,750/year.
            
            **Compensation Rules**:
            - Base Salary: $51,001/year (Fixed)
            - Target Annual Commission: $57,750
            - Current Realized Commission YTD: $${currentCommission}
            
            **Current Pipeline**:
            ${pipelineData}
            
            **Task**:
            Write a cohesive, natural-language executive summary (2-3 paragraphs) analyzing their progress.
            - Estimate the "Risk-Adjusted" commission value of the pipeline.
            - Identify which 2 deals are most critical to close this month to boost the "Wealth Check".
            - Provide a brief strategy to accelerate the "Volume Arbitrage" game.

            **STYLE GUIDELINES**:
            - DO NOT use markdown symbols like **, ##, or bullet points.
            - Write in standard, plain-text paragraphs.
            - Write as if you are sending a professional text message or short email memo to the user.
            - Do not use headers. Keep it conversational but professional.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            // Override global system instruction to prevent forced bullet points
            config: { systemInstruction: "You are a helpful assistant who writes in plain text paragraphs only. No markdown formatting." }
        });
        return response.text;
    } catch (error) {
        console.error("Error analyzing compensation:", error);
        throw error;
    }
};

// --- Audio Services (Transcription & TTS) ---

export const transcribeAudio = async (base64Audio: string, mimeType: string = 'audio/webm'): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
        console.error("Error transcribing audio:", error);
        throw new Error("Audio transcription failed.");
    }
};

export const generateSpeech = async (text: string): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
        console.error("Error generating speech:", error);
        throw error;
    }
};

// --- Voice Command Parser ---
export const parseNaturalLanguageCommand = async (transcript: string, validStatuses?: string[]): Promise<CommandIntent> => {
  try {
    const statusList = validStatuses ? validStatuses.join("', '") : "Lead', 'Pre-Approval', 'Underwriting', 'Clear to Close', 'Closed";

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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

    if (response.text) {
      return JSON.parse(response.text) as CommandIntent;
    }
    throw new Error("No response from parser");
  } catch (error) {
    console.error("Error parsing command", error);
    return { action: 'UNKNOWN', payload: {} };
  }
};