import { genkit, z } from 'genkit';
import { googleAI, gemini15Pro, gemini15Flash } from '@genkit-ai/googleai';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// This is our new function to securely fetch the API key.
async function getApiKey(): Promise<string> {
  // First, check if we're running in a local environment with the key already set.
  if (process.env.GOOGLE_GENAI_API_KEY) {
    console.log("Using API key from local environment variable.");
    return process.env.GOOGLE_GENAI_API_KEY;
  }

  // If not, we are in production. Fetch the key from Google Cloud Secret Manager.
  console.log("Fetching API key from Google Cloud Secret Manager...");
  try {
    const client = new SecretManagerServiceClient();
    const project_id = process.env.GCP_PROJECT || (await client.getProjectId());
    const secretName = `projects/${project_id}/secrets/GEMINI_API_KEY/versions/latest`;

    const [version] = await client.accessSecretVersion({
      name: secretName,
    });

    const apiKey = version.payload?.data?.toString();
    if (!apiKey) {
      throw new Error('Could not retrieve API key from Secret Manager.');
    }

    console.log("Successfully fetched API key.");
    return apiKey;
  } catch (error) {
    console.error("FATAL: Could not fetch API key from Secret Manager.", error);
    // Exit if we can't get a key in a production environment.
    process.exit(1);
  }
}

// We wrap our main application logic in an async function
// so we can 'await' the API key before starting the app.
async function initializeApp() {
  const apiKey = await getApiKey();

  const genkitApp = genkit({
    plugins: [
      googleAI({ apiKey }), // Pass the fetched API key directly here.
    ],
  });

  // All your flows are defined inside here now.
  genkitApp.defineFlow(
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

  genkitApp.defineFlow(
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
}

// Start the application.
initializeApp();