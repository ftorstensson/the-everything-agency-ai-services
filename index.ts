import { genkit, z } from 'genkit';
import { googleAI, gemini15Pro, gemini15Flash } from '@genkit-ai/googleai';

const genkitApp = genkit({
  plugins: [
    googleAI(),
  ],
});

export const characterGeneratorFlow = genkitApp.defineFlow(
  {
    name: 'characterGeneratorFlow',
    inputSchema: z.object({ description: z.string() }),
    outputSchema: z.object({
      name: z.string(),
      strength: z.number(),
      intelligence: z.number(),
      description: z.string(),
    }),
  },
  async (input) => {
    const response = await genkitApp.generate({
      model: gemini15Flash,
      prompt: `Generate a fantasy character based on this description: ${input.description}. Provide a name, strength (1-20), intelligence (1-20), and a short description.`,
      config: {
        maxOutputTokens: 256,
      },
    });

    return JSON.parse(response.text);
  }
);

export const searchAndAnswerFlow = genkitApp.defineFlow(
  {
    name: 'searchAndAnswerFlow',
    inputSchema: z.string(),
    outputSchema: z.string(),
  },
  async (question) => {
    const response = await genkitApp.generate({
      model: gemini15Pro,
      prompt: `Answer the following question using a web search: ${question}`,
      config: {
        // Corrected tool name as per the API error message.
        tools: [{ googleSearchRetrieval: {} }],
      },
    });

    return response.text;
  }
);