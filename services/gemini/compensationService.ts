import { buildAgentPrompt, generateContentWithFallback, PERSONAS } from './geminiCore';

export const generateGapStrategy = async (current: number, target: number, pipeline: any[]): Promise<string> => {
  const gap = target - current;
  const prompt = buildAgentPrompt(
    PERSONAS.ARCHITECT,
    `Develop a strategy to close the income gap of $${gap.toLocaleString()}.
        Current Pipeline: ${JSON.stringify(pipeline)}.

        Advise on:
        1. Which pipeline deals to prioritize.
        2. How many new leads needed based on typical conversion.`
  );

  const response = await generateContentWithFallback('gemini-3-pro-preview', prompt, {
    thinkingConfig: { thinkingBudget: 4096 }
  });
  return response.text || '';
};
