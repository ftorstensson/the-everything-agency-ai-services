import { genkit, z } from 'genkit';
// The CORRECT import for search functionality
import { vertexAI, gemini15Pro, gemini15Flash } from '@genkit-ai/vertexai';
import { startFlowServer } from '@genkit-ai/express';

// Configure Genkit to use the Vertex AI plugin.
// This plugin will automatically use the application's default credentials in Cloud Run.
const genkitApp = genkit({
  plugins: [vertexAI()],
});

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
      prompt: `Generate a fantasy character based on this description: ${input.description}. Return ONLY a valid JSON object.`,
      config: {
        maxOutputTokens: 256,
        temperature: 0.1,
      },
    });
    
    try {
      return JSON.parse(response.text);
    } catch (parseError) {
      return { name: "Unknown", strength: 10, intelligence: 10, description: response.text };
    }
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
      prompt: `Answer the following question using web search results: ${question}`,
      config: {
        // This is the correct syntax, and it will work with the vertexAI plugin.
        googleSearchRetrieval: {},
        maxOutputTokens: 1000,
      },
    });
    return response.text;
  }
);

// Start the production-ready server using the correct Genkit helper.
startFlowServer({
  flows: [characterGeneratorFlow, searchAndAnswerFlow],
  port: parseInt(process.env.PORT || '3400'),
});