// index.ts
// v2.0 - UPGRADED: ArchitectFlow is now an intelligent agent using a Firestore prompt.

import { genkit, z } from 'genkit';
import { vertexAI, gemini15Pro, gemini15Flash } from '@genkit-ai/vertexai';
import { startFlowServer } from '@genkit-ai/express';
import { openAI, gpt4o } from 'genkitx-openai';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { Firestore } from '@google-cloud/firestore'; // Import Firestore

// --- Initialization ---
const secretManager = new SecretManagerServiceClient();
const db = new Firestore(); // Initialize Firestore client

// --- Helper Functions ---

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
    process.exit(1);
  }
}

// NEW: Function to fetch prompts for Genkit agents from Firestore
async function getGenkitPromptFromFirestore(promptId: string): Promise<string> {
    try {
        const docRef = db.collection('genkit_prompts').doc(promptId);
        const doc = await docRef.get();
        if (doc.exists) {
            const promptText = doc.data()?.prompt_text;
            if (promptText) {
                console.log(`Successfully fetched prompt '${promptId}' from Firestore.`);
                return promptText;
            }
        }
        throw new Error(`Prompt '${promptId}' not found or is empty.`);
    } catch (error) {
        console.error(`Failed to fetch Genkit prompt '${promptId}':`, error);
        // Fallback to a safe default
        return "You are a helpful assistant. Your primary prompt failed to load.";
    }
}


async function startServer() {
  const openaiApiKey = await getOpenAIKey();

  const genkitApp = genkit({
    plugins: [
      vertexAI({ location: 'australia-southeast1' }),
      openAI({ apiKey: openaiApiKey }),
    ],
  });

  // --- ARCE Agent Flows ---

  // UPGRADED: This flow is now intelligent.
  const architectFlow = genkitApp.defineFlow(
    {
      name: 'architectFlow',
      inputSchema: z.string(), // Takes the user's task description
      outputSchema: z.string(), // Returns a JSON string plan
    },
    async (taskDescription) => {
      console.log(`ArchitectFlow received task: ${taskDescription}`);
      
      // 1. Fetch the brain for the Architect agent
      const architectSystemPrompt = await getGenkitPromptFromFirestore('architect');

      // 2. Call the LLM with the fetched prompt and the user's task
      const response = await genkitApp.generate({
        model: gemini15Pro,
        prompt: taskDescription,
        config: {
            systemPrompt: architectSystemPrompt,
            responseFormat: 'json', // Enforce JSON output
        }
      });
      
      const planJson = response.text;
      console.log(`ArchitectFlow generated plan: ${planJson}`);

      // 3. Return the generated plan
      return planJson;
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
  
  // NOTE: Creator and Editor are still placeholders for now.
  const creatorFlow = genkitApp.defineFlow(
    {
      name: 'creatorFlow',
      inputSchema: z.string(),
      outputSchema: z.string(),
    },
    async (planAndResearch) => {
      console.log(`CreatorFlow received plan and research.`);
      return "This is the first draft of the report, based on the provided plan and research data.";
    }
  );

  const editorFlow = genkitApp.defineFlow(
    {
      name: 'editorFlow',
      inputSchema: z.string(),
      outputSchema: z.string(),
    },
    async (draft) => {
      console.log(`EditorFlow received draft: ${draft}`);
      return "This is the final, edited, and polished report, ready for the user.";
    }
  );

  startFlowServer({
    flows: [
      architectFlow,
      searchAndAnswerFlow,
      creatorFlow,
      editorFlow
    ],
    port: parseInt(process.env.PORT || '3400'),
  });
}

startServer();