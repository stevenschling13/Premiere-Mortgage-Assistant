import { CalendarEvent, Client } from '../../types';
import { buildAgentPrompt, generateContentWithFallback, PERSONAS, safeParseJson } from './geminiCore';

export const generateDailySchedule = async (currentEvents: CalendarEvent[], input: string, clients: Client[]): Promise<CalendarEvent[]> => {
  const prompt = buildAgentPrompt(
    PERSONAS.CHIEF_OF_STAFF,
    `Act as Chief of Staff. Update the schedule based on: "${input}".
        Current Schedule: ${JSON.stringify(currentEvents)}.
        Available Clients: ${JSON.stringify(clients.map(c => ({ id: c.id, name: c.name })))}.

        If input implies meeting a client, link clientId.
        Return JSON array of NEW CalendarEvents to add.`
  );

  const response = await generateContentWithFallback('gemini-3-pro-preview', prompt, {
    responseMimeType: 'application/json',
    thinkingConfig: { thinkingBudget: 2048 }
  });

  const events: CalendarEvent[] = safeParseJson<CalendarEvent[]>(response.text, []);
  const today = new Date().toISOString().split('T')[0];
  return events.map(e => ({
    ...e,
    start: e.start.includes('T') ? e.start : `${today}T${e.start}`,
    end: e.end.includes('T') ? e.end : `${today}T${e.end}`,
    isAiGenerated: true
  }));
};

export const generateMeetingPrep = async (eventTitle: string, client?: Client): Promise<string> => {
  const prompt = buildAgentPrompt(
    PERSONAS.CHIEF_OF_STAFF,
    `Prepare a 1-page briefing for meeting: "${eventTitle}".
        Client Context: ${client ? JSON.stringify(client) : "Unknown"}.

        Include:
        1. Objective.
        2. Key talking points.
        3. Potential objections (if client).`
  );
  const response = await generateContentWithFallback('gemini-2.5-flash', prompt, {});
  return response.text || '';
};
