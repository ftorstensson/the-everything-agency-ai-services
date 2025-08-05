import { genkit, z } from 'genkit';
import { googleAI, gemini15Pro, gemini15Flash } from '@genkit-ai/googleai';
import { startFlowServer } from '@genkit-ai/express';

// Define the genkitApp instance. The API key is handled by the environment.
const genkitApp = genkit({
  plugins: [googleAI()],
});

// Define our flows exactly as before.
const characterGeneratorFlow = genkitApp.defineFlow(
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

const searchAndAnswerFlow = genkitApp.defineFlow(
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
        tools: [{ googleSearchRetrieval: {} }],
      },
    });
    return response.text;
  }
);

// This is the correct, official way to start a production server.
startFlowServer({
  flows: [characterGeneratorFlow, searchAndAnswerFlow],
  port: parseInt(process.env.PORT || '3400'),
});