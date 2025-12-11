import { buildAgentPrompt, generateContentWithFallback, getAiClient, PERSONAS } from './geminiCore';

export async function* streamAnalyzeLoanScenario(scenarioText: string) {
  const prompt = buildAgentPrompt(
    PERSONAS.ARCHITECT,
    `Analyze this Jumbo Loan Scenario for risk and structure.
        Scenario: ${scenarioText}.

        Cover:
        1. DTI/LTV Risk Assessment.
        2. Reserve Requirements (typical).
        3. Potential pitfalls (appraisal, large deposits).

        Format: Markdown.`
  );

  const ai = getAiClient();
  const stream = await ai.models.generateContentStream({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: { thinkingConfig: { thinkingBudget: 4096 } }
  });

  for await (const chunk of stream) {
    yield chunk.text;
  }
}

export const solveDtiScenario = async (financials: any): Promise<string> => {
  const prompt = buildAgentPrompt(
    PERSONAS.UNDERWRITER,
    `Act as "Deal Doctor". Solve this high DTI scenario.
        Financials: ${JSON.stringify(financials)}.

        Suggest:
        1. Paying off specific debts (calculate DTI impact).
        2. Borrower removal (if applicable).
        3. Income grossing up (if applicable).

        Show math.`
  );

  const response = await generateContentWithFallback('gemini-3-pro-preview', prompt, {
    thinkingConfig: { thinkingBudget: 8192 }
  });
  return response.text || '';
};
