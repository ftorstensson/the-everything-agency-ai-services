// index.ts
// v3.6 - FIX: Implemented and correctly exported the missing promptArchitectFlow.

import { genkit, z } from 'genkit';
import { vertexAI, gemini15Pro } from '@genkit-ai/vertexai';
import { startFlowServer } from '@genkit-ai/express';
import { openAI, gpt4o } from 'genkitx-openai';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { Firestore } from '@google-cloud/firestore';

// --- Initialization ---
const secretManager = new SecretManagerServiceClient();
const db = new Firestore();

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
    process.exit(1); // Exit if the key is essential and not found
  }
}

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
        // Provide a safe fallback to prevent crashes
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

  // --- DEFINITIVE FIX: The missing Prompt Architect Flow ---
  const promptArchitectFlow = genkitApp.defineFlow(
    {
      name: 'promptArchitectFlow',
      inputSchema: z.object({
        team_mission: z.string(),
        agent_name: z.string(),
        agent_description: z.string(),
      }),
      outputSchema: z.string(),
    },
    async (input) => {
      console.log(`PromptArchitectFlow received request for agent: ${input.agent_name}`);
      
      const masterPrompt = await getGenkitPromptFromFirestore('prompt_architect_master');

      // Format the master prompt with the provided inputs
      const formattedSystemPrompt = masterPrompt
        .replace('{team_mission}', input.team_mission)
        .replace('{agent_name}', input.agent_name)
        .replace('{agent_description}', input.agent_description);

      const response = await genkitApp.generate({
        model: gpt4o, // Using GPT-4o for high-quality prompt generation
        messages: [
            { role: 'system', content: [{ text: formattedSystemPrompt }] },
        ],
        config: {
            temperature: 0.5,
        }
      });
      
      const professionalPrompt = response.text;
      console.log(`PromptArchitectFlow successfully generated a new prompt for ${input.agent_name}.`);
      return professionalPrompt;
    }
  );


  // --- ARCE Agent Flows (Unchanged) ---
  const architectFlow = genkitApp.defineFlow({ name: 'architectFlow', inputSchema: z.string(), outputSchema: z.string() }, async (taskDescription) => {
      const prompt = await getGenkitPromptFromFirestore('architect');
      const response = await genkitApp.generate({ model: gemini15Pro, messages: [{ role: 'system', content: [{ text: prompt }] }, { role: 'user', content: [{ text: taskDescription }] }], config: { temperature: 0.0 } });
      let plan = response.text;
      if (plan.startsWith("```json")) { plan = plan.slice(7, -3).trim(); }
      try { JSON.parse(plan); return plan; } catch (e) { throw new Error("Architect failed to generate a valid JSON plan."); }
  });

  const searchAndAnswerFlow = genkitApp.defineFlow({ name: 'searchAndAnswerFlow', inputSchema: z.string(), outputSchema: z.string() }, async (question) => {
      const prompt = await getGenkitPromptFromFirestore('researcher');
      const response = await genkitApp.generate({ model: gemini15Pro, messages: [{ role: 'system', content: [{ text: prompt }] }, { role: 'user', content: [{ text: question }] }], config: { googleSearchRetrieval: {}, maxOutputTokens: 1000 } });
      return response.text;
  });
  
  const creatorFlow = genkitApp.defineFlow({ name: 'creatorFlow', inputSchema: z.string(), outputSchema: z.string() }, async (planAndResearch) => {
      const prompt = await getGenkitPromptFromFirestore('creator');
      const response = await genkitApp.generate({ model: gemini15Pro, messages: [{ role: 'system', content: [{ text: prompt }] }, { role: 'user', content: [{ text: planAndResearch }] }], config: { temperature: 0.5 } });
      return response.text;
  });

  const editorFlow = genkitApp.defineFlow({ name: 'editorFlow', inputSchema: z.string(), outputSchema: z.string() }, async (draft) => {
      const prompt = await getGenkitPromptFromFirestore('editor');
      const response = await genkitApp.generate({ model: gemini15Pro, messages: [{ role: 'system', content: [{ text: prompt }] }, { role: 'user', content: [{ text: draft }] }], config: { temperature: 0.2 } });
      return response.text;
  });

  // --- Start the Server ---
  startFlowServer({
    flows: [
      promptArchitectFlow, // DEFINITIVE FIX: Export the missing flow
      architectFlow,
      searchAndAnswerFlow,
      creatorFlow,
      editorFlow
    ],
    port: parseInt(process.env.PORT || '3400'),
  });
}

startServer();