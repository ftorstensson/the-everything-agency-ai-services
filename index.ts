import { genkit, z } from 'genkit';
import { googleAI, gemini15Pro, gemini15Flash } from '@genkit-ai/googleai';
import express, { Request, Response } from 'express';

const genkitApp = genkit({
  plugins: [googleAI()],
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
    // FIXED: Use the correct generate API syntax
    const response = await genkitApp.generate({
      model: gemini15Flash,
      prompt: `Generate a fantasy character based on this description: ${input.description}. 
      Return ONLY a valid JSON object with the following structure:
      {
        "name": "character name",
        "strength": number between 1-20,
        "intelligence": number between 1-20,
        "description": "short character description"
      }`,
      config: {
        maxOutputTokens: 256,
        temperature: 0.1, // Lower temperature for more consistent JSON output
      },
    });
    
    try {
      return JSON.parse(response.text);
    } catch (parseError) {
      // Fallback if JSON parsing fails
      return {
        name: "Unknown Character",
        strength: 10,
        intelligence: 10,
        description: response.text
      };
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
    // FIXED: Correct googleSearchRetrieval syntax - it goes in config, not tools
    const response = await genkitApp.generate({
      model: gemini15Pro,
      prompt: `Answer the following question using web search results: ${question}`,
      config: {
        googleSearchRetrieval: {}, // FIXED: Moved from tools to config
        maxOutputTokens: 1000,
      },
    });
    return response.text;
  }
);

const app = express();
app.use(express.json());

app.post('/searchAndAnswerFlow', async (req: Request, res: Response) => {
  const input = req.body.input;
  try {
    const result = await searchAndAnswerFlow(input);
    res.status(200).json({ result });
  } catch (e: any) {
    console.error('Error in searchAndAnswerFlow:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/characterGeneratorFlow', async (req: Request, res: Response) => {
  const input = req.body.input;
  try {
    const result = await characterGeneratorFlow(input);
    res.status(200).json({ result });
  } catch (e: any) {
    console.error('Error in characterGeneratorFlow:', e);
    res.status(500).json({ error: e.message });
  }
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'healthy' });
});

const port = process.env.PORT || 3400;
app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});