import { genkit, z } from 'genkit';
// Corrected the typo from '@gen-ai/googleai' back to the proper package name
import { googleAI, gemini15Pro, gemini15Flash } from '@genkit-ai/googleai';
import express, { Request, Response } from 'express';

const genkitApp = genkit({
  plugins: [googleAI()],
});

//
// Define the raw logic for our flows.
//
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

//
// Create and configure the Express web server.
//
const app = express();
app.use(express.json());

// Create an HTTP POST endpoint for the search flow.
app.post('/searchAndAnswerFlow', async (req: Request, res: Response) => {
  const input = req.body.input;
  try {
    // The surgically precise fix: Call genkitApp.run with the flow's name as a STRING.
    const result = await genkitApp.run('searchAndAnswerFlow', input);
    res.status(200).json({ result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Create an HTTP POST endpoint for the character generator flow.
app.post('/characterGeneratorFlow', async (req: Request, res: Response) => {
  const input = req.body.input;
  try {
    // The surgically precise fix: Call genkitApp.run with the flow's name as a STRING.
    const result = await genkitApp.run('characterGeneratorFlow', input);
    res.status(200).json({ result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Start the server and listen on the port provided by Cloud Run.
const port = process.env.PORT || 3400;
app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});