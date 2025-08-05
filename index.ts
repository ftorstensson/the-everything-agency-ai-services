import { genkit, z } from 'genkit';
import { vertexAI, gemini15Pro, gemini15Flash } from '@genkit-ai/vertexai';
import { startFlowServer } from '@genkit-ai/express';
import { openAI, gpt4o } from 'genkitx-openai'; // Import OpenAI plugin and model
import { SecretManagerServiceClient } from '@google-cloud/secret-manager'; // Import Secret Manager client

// Instantiate the Secret Manager client
const secretManager = new SecretManagerServiceClient();

async function getOpenAIKey(): Promise<string> {
  const secretName = 'projects/vibe-agent-final/secrets/OPENAI_API_KEY/versions/latest';
  try {
    const [version] = await secretManager.accessSecretVersion({ name: secretName });
    const apiKey = version.payload?.data?.toString();
    if (!apiKey) {
      throw new Error('OpenAI API key is empty or not found in Secret Manager.');
    }
    console.log("Successfully loaded OpenAI API key from Secret Manager.");
    return apiKey;
  } catch (error) {
    console.error('Failed to load OpenAI API key from Secret Manager:', error);
    process.exit(1); // Exit if the key cannot be loaded
  }
}

// Create a main startup function to handle async initialization
async function startServer() {
  const openaiApiKey = await getOpenAIKey();

  const genkitApp = genkit({
    plugins: [
      vertexAI({ location: 'australia-southeast1' }),
      openAI({ apiKey: openaiApiKey }), // Add the initialized OpenAI plugin
    ],
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
          googleSearchRetrieval: {},
          maxOutputTokens: 1000,
        },
      });
      return response.text;
    }
  );

  // NEW: A flow specifically to test the OpenAI integration
  const creativeTextFlow = genkitApp.defineFlow(
    {
      name: 'creativeTextFlow',
      inputSchema: z.string(),
      outputSchema: z.string(),
    },
    async (topic) => {
      const response = await genkitApp.generate({
        model: gpt4o, // Use the imported OpenAI model
        prompt: `Write a short, creative paragraph about: ${topic}`,
      });
      return response.text;
    }
  );
  
  // Start the production-ready server using the correct Genkit helper.
  // Add the new flow to the list of exposed flows.
  startFlowServer({
    flows: [characterGeneratorFlow, searchAndAnswerFlow, creativeTextFlow],
    port: parseInt(process.env.PORT || '3400'),
  });
}

// Run the startup function
startServer();