// index.ts
// MINIMAL TEST CASE v2: "Hello World" with corrected server options.

import { startFlowServer } from '@genkit-ai/express';
import { genkit, z } from 'genkit';
import { vertexAI } from '@genkit-ai/vertexai';

console.log('--- MINIMAL TEST: Initializing Genkit App ---');

const app = genkit({
  plugins: [
    vertexAI({ location: 'australia-southeast1' })
  ]
});

const testFlow = app.defineFlow(
  { 
    name: 'testFlow', 
    inputSchema: z.string().optional(), // Allow no input
    outputSchema: z.object({ message: z.string() }) 
  },
  async () => {
    console.log('--- MINIMAL TEST: testFlow was executed ---');
    return { message: 'Hello World' };
  }
);

console.log('--- MINIMAL TEST: Starting server ---');

startFlowServer({
  flows: [testFlow],
  port: parseInt(process.env.PORT || '8080') // Use Cloud Run's required port
});

console.log('--- MINIMAL TEST: startFlowServer called. Script finished. ---');