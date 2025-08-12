// index.ts
// v3.9 - DEFINITIVE FIX 2: Corrected TypeScript type errors in catch block.

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

async function getOpenAIKey(): Promise<string | null> {
  const secretName = 'projects/vibe-agent-final/secrets/OPENAI_API_KEY/versions/latest';
  console.log(`Attempting to access secret: ${secretName}`);
  try {
    const [version] = await secretManager.accessSecretVersion({ name: secretName });
    const apiKey = version.payload?.data?.toString();
    if (!apiKey) {
      throw new Error('Secret payload is empty or not found.');
    }
    console.log('Successfully loaded OpenAI API key (length:', apiKey.length, ')');
    return apiKey;
  } catch (e) {
    // DEFINITIVE FIX: Type-check the error object before accessing properties.
    const error = e as any; // Cast to 'any' to safely access properties
    console.warn('--- OPENAI PLUGIN DISABLED ---');
    console.warn('Failed to load OpenAI API key from Secret Manager.');
    console.warn('Error details:', error.message);
    if (error.code === 7) { // Error code 7 is PERMISSION_DENIED for Google Cloud APIs
        console.warn('IAM PERMISSION DENIED: The service account for this Cloud Run service is missing the "Secret Manager Secret Accessor" role.');
    }
    return null;
  }
}

async function getGenkitPromptFromFirestore(promptId: string): Promise<string> {
    try {
        const docRef = db.collection('genkit_prompts').doc(promptId);
        const doc = await docRef.get();
        if (doc.exists) {
            const promptText = doc.data()?.prompt_text;
            if (promptText) {
                return promptText;
            }
        }
        throw new Error(`Prompt '${promptId}' not found or is empty in Firestore.`);
    } catch (error) {
        console.error(`Failed to fetch Genkit prompt '${promptId}':`, error);
        return "You are a helpful assistant. Your primary prompt failed to load.";
    }
}

async function startServer() {
  console.log('=== GENKIT STARTUP: Beginning initialization ===');

  const plugins = [
    vertexAI({ location: 'australia-southeast1' })
  ];

  const openaiApiKey = await getOpenAIKey();
  if (openaiApiKey) {
    plugins.push(openAI({ apiKey: openaiApiKey }));
    console.log('=== OpenAI plugin successfully enabled. ===');
  } else {
    console.warn('=== OpenAI plugin is disabled due to missing key. Service will run in Gemini-only mode. ===');
  }
  
  const genkitApp = genkit({ plugins });
  console.log('=== Genkit initialized successfully. ===');

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
      const formattedSystemPrompt = masterPrompt
        .replace('{team_mission}', input.team_mission)
        .replace('{agent_name}', input.agent_name)
        .replace('{agent_description}', input.agent_description);

      const response = await genkitApp.generate({
        model: gemini15Pro,
        messages: [{ role: 'system', content: [{ text: formattedSystemPrompt }] }],
        config: { temperature: 0.5 }
      });
      
      console.log(`PromptArchitectFlow successfully generated a new prompt for ${input.agent_name}.`);
      return response.text;
    }
  );

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

  console.log('=== Starting flow server... ===');
  startFlowServer({
    flows: [
      promptArchitectFlow,
      architectFlow,
      searchAndAnswerFlow,
      creatorFlow,
      editorFlow
    ],
    port: parseInt(process.env.PORT || '3400'),
  });
  console.log('=== Flow server started successfully. ===');
}

startServer();