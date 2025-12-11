import { Client } from '../../types';
import { Modality, buildAgentPrompt, getAiClient, PERSONAS } from './geminiCore';

export async function* streamMorningMemo(urgentClients: Client[], marketData: any) {
  const prompt = buildAgentPrompt(
    PERSONAS.CHIEF_OF_STAFF,
    `Generate an audio-script style "Morning Memo" for the Mortgage Banker.

        Urgent Clients: ${JSON.stringify(urgentClients.map(c => ({ name: c.name, status: c.status })))}.
        Market: ${JSON.stringify(marketData.indices)}.
        News: ${JSON.stringify(marketData.news?.[0]?.title)}.

        Format: "Good morning. Here is your briefing..."`
  );

  const ai = getAiClient();
  const stream = await ai.models.generateContentStream({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: { thinkingConfig: { thinkingBudget: 2048 } }
  });

  for await (const chunk of stream) {
    yield chunk.text;
  }
}

export const generateAudioBriefing = async (text: string): Promise<string> => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: { parts: [{ text }] },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } }
      }
    }
  });

  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || '';
};
