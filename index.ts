// index.ts
// MINIMAL TEST CASE v4: Corrected all TypeScript errors.

import { startFlowServer } from '@genkit-ai/express';
import { genkit, z } from 'genkit';
import { vertexAI } from '@genkit-ai/vertexai';

console.log('--- MINIMAL TEST: Initializing Genkit App ---');

// Add explicit error handling as a safety measure
process.on('uncaughtException', (err) => {
  console.error('=== FATAL UNCAUGHT EXCEPTION ===', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('=== FATAL UNHANDLED REJECTION ===', reason);
  process.exit(1);
});


const app = genkit({
  plugins: [
    vertexAI({ location: 'australia-southeast1' })
  ]
});

const testFlow = app.defineFlow(
  { 
    name: 'testFlow', 
    inputSchema: z.string().optional(),
    outputSchema: z.object({ message: z.string() }) 
  },
  async () => {
    console.log('--- MINIMAL TEST: testFlow was executed ---');
    return { message: 'Hello World from the fixed server!' };
  }
);

console.log('--- MINIMAL TEST: Starting server ---');

const port = parseInt(process.env.PORT || '8080');
console.log(`--- MINIMAL TEST: Attempting to bind to port ${port}`);

try {
    startFlowServer({
        flows: [testFlow],
        port: port,
    });
    console.log('--- MINIMAL TEST: startFlowServer called. Script finished. ---');
} catch (error) {
    console.error('--- MINIMAL TEST: startFlowServer threw a synchronous error ---', error);
}