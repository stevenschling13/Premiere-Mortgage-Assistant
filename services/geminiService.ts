import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Client, CommandIntent } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const SYSTEM_INSTRUCTION = `You are the "Premiere Private Banking Assistant", an elite AI designed for high-net-worth mortgage banking. 
Your demeanor is sophisticated, precise, and anticipatory.
You specialize in:
1.  **Complex Deal Structuring**: Analyzing jumbo loans, trust income, and RSU/Asset depletion scenarios.
2.  **High-Touch Communication**: Drafting white-glove emails that are concise yet warm.
3.  **Market Authority**: Synthesizing bond market movements (10yr Treasury, MBS) into actionable advice.

**Guidelines**:
-   **Tone**: Professional, confident, concise. Avoid fluff.
-   **Formatting**: Use bullet points for readability in analysis.
-   **Compliance**: Never provide binding tax or legal advice. Always add a disclaimer when discussing specific rates or approvals.
`;

// --- Text Generation & Chat ---

export const generateEmailDraft = async (client: Client, topic: string, specificDetails: string) => {
  try {
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

export const generateMarketingContent = async (channel: string, topic: string, tone: string, context?: string) => {
  try {
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

export const chatWithAssistant = async (history: Array<{role: string, parts: Array<{text: string}>}>, message: string) => {
  try {
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash', // Flash is best for Search Grounding per guidelines
      history: history,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{googleSearch: {}}] 
      }
    });

    const response = await chat.sendMessage({ message });
    
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const links = groundingChunks
      .map((chunk: any) => chunk.web ? { uri: chunk.web.uri, title: chunk.web.title } : null)
      .filter((link: any) => link !== null);

    return {
      text: response.text,
      links: links
    };

  } catch (error) {
    console.error("Error in chat:", error);
    throw new Error("I'm currently unable to access the live market network. Please try again shortly.");
  }
};

// --- Thinking Mode (Gemini 3 Pro) ---

export const analyzeLoanScenario = async (scenarioData: string) => {
  try {
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

export const analyzeRateTrends = async (rates: any) => {
  try {
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
            1. Estimate the "Risk-Adjusted" commission value of the pipeline (Status probabilities: Lead=10%, Pre-Approval=30%, Underwriting=70%, Clear to Close=95%).
            2. Identify which 2 deals are most critical to close this month to boost the "Wealth Check".
            3. Provide a brief strategy to accelerate the "Volume Arbitrage" game.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { systemInstruction: SYSTEM_INSTRUCTION }
        });
        return response.text;
    } catch (error) {
        console.error("Error analyzing compensation:", error);
        throw error;
    }
};

// --- Audio Services (Transcription & TTS) ---

export const transcribeAudio = async (base64Audio: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'audio/wav', data: base64Audio } },
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
export const parseNaturalLanguageCommand = async (transcript: string): Promise<CommandIntent> => {
  try {
    const prompt = `
      You are a command parser for a Mortgage CRM. Convert the user's natural language request into a specific JSON Action.
      
      **Available Actions**:
      1. CREATE_CLIENT: User wants to add a new person. Extract 'name', 'loanAmount' (number), 'status'.
      2. UPDATE_CLIENT: User wants to change details of a deal. Extract 'clientName' and any of: 'status', 'loanAmount', 'phone', 'email'.
      3. ADD_NOTE: User wants to append a note. Extract 'clientName' and 'note'.
      4. ADD_TASK: User wants to add a checklist item. Extract 'clientName', 'taskLabel', and 'date' (YYYY-MM-DD) if mentioned.

      **Status Values**: 'Lead', 'Pre-Approval', 'Underwriting', 'Clear to Close', 'Closed'. Map close variants to these.

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