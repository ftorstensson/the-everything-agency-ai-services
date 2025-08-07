import { genkit, z } from 'genkit';
import { vertexAI, gemini15Pro, gemini15Flash } from '@genkit-ai/vertexai'; // Corrected gemini15Flash
import { startFlowServer } from '@genkit-ai/express';
import { openAI, gpt4o } from 'genkitx-openai';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

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
    process.exit(1);
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

  // --- Existing Flows ---

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

  const creativeTextFlow = genkitApp.defineFlow(
    {
      name: 'creativeTextFlow',
      inputSchema: z.string(),
      outputSchema: z.string(),
    },
    async (topic) => {
      const response = await genkitApp.generate({
        model: gpt4o,
        prompt: `Write a short, creative paragraph about: ${topic}`,
      });
      return response.text;
    }
  );

  // --- NEW: ARCE Placeholder Flows ---

  const architectFlow = genkitApp.defineFlow(
    {
      name: 'architectFlow',
      inputSchema: z.string(), // Takes the user's task description
      outputSchema: z.string(), // Returns a simple JSON string plan
    },
    async (taskDescription) => {
      console.log(`ArchitectFlow received task: ${taskDescription}`);
      const plan = {
        title: "Plan for " + taskDescription,
        steps: [
          "Conduct initial research on the core topic.",
          "Synthesize findings into a draft report.",
          "Review and edit the draft for clarity and accuracy."
        ]
      };
      return JSON.stringify(plan);
    }
  );

  const creatorFlow = genkitApp.defineFlow(
    {
      name: 'creatorFlow',
      inputSchema: z.string(), // Takes the plan and research data
      outputSchema: z.string(), // Returns a simple draft
    },
    async (planAndResearch) => {
      console.log(`CreatorFlow received plan and research.`);
      return "This is the first draft of the report, based on the provided plan and research data.";
    }
  );

  const editorFlow = genkitApp.defineFlow(
    {
      name: 'editorFlow',
      inputSchema: z.string(), // Takes the draft
      outputSchema: z.string(), // Returns the final polished report
    },
    async (draft) => {
      console.log(`EditorFlow received draft: ${draft}`);
      return "This is the final, edited, and polished report, ready for the user.";
    }
  );

  startFlowServer({
    flows: [
      searchAndAnswerFlow,
      creativeTextFlow,
      architectFlow, // Expose the new flow
      creatorFlow,   // Expose the new flow
      editorFlow     // Expose the new flow
    ],
    port: parseInt(process.env.PORT || '3400'),
  });
}

startServer();