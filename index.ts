// src/index.ts
// CANONICAL "HELLO WORLD" GENKIT SERVICE (v1.1 - Corrected TS Errors)

import { genkit, z } from 'genkit';
import { startFlowServer } from '@genkit-ai/express';
import { vertexAI, gemini15Flash } from '@genkit-ai/vertexai';
import express from 'express';

// --- Startup Logging ---
console.log('=== CANONICAL GENKIT SERVICE STARTING ===');
console.log(`Node.js Version: ${process.version}`);
console.log(`Project ID: ${process.env.GCLOUD_PROJECT || 'Not Set'}`);
console.log(`Port: ${process.env.PORT || '8080'}`);

// --- Global Error Handlers ---
process.on('uncaughtException', (error) => {
  console.error('=== FATAL UNCAUGHT EXCEPTION ===', error);
  process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('=== FATAL UNHANDLED REJECTION ===', reason);
  process.exit(1);
});

// --- Genkit Initialization ---
const app = genkit({
  plugins: [
    vertexAI({
      location: 'australia-southeast1',
    }),
  ],
});

// --- Flow Definitions ---

// 1. Simple test flow
const testFlow = app.defineFlow(
  {
    name: 'testFlow',
    inputSchema: z.object({ message: z.string() }),
    outputSchema: z.object({ response: z.string() }),
  },
  async (input) => {
    console.log('=== testFlow EXECUTING ===', input);
    return { response: `Hello World! Echo: ${input.message}` };
  }
);

// 2. AI-powered flow
const geminiFlow = app.defineFlow(
  {
    name: 'geminiFlow',
    inputSchema: z.object({ prompt: z.string() }),
    outputSchema: z.object({ response: z.string() }),
  },
  async (input) => {
    console.log('=== geminiFlow EXECUTING ===', input);
    const llmResponse = await app.generate({
      model: gemini15Flash,
      prompt: input.prompt,
    });
    // DEFINITIVE FIX: .text is a property, not a function.
    return { response: llmResponse.text };
  }
);

// --- Server Startup ---

async function startServer() {
  try {
    console.log('=== INITIALIZING SERVER ===');
    const port = parseInt(process.env.PORT || '8080');
    
    // The health check app is not strictly necessary for the main app to run
    // and can be added back later if needed. For now, we focus on the core service.

    startFlowServer({
      flows: [testFlow, geminiFlow],
      port: port,
      cors: { origin: true },
    });

    console.log(`=== GENKIT FLOW SERVER STARTED on port ${port} ===`);
    console.log('Available endpoints: /flows/testFlow, /flows/geminiFlow');
    
  } catch (error) {
    console.error('=== FATAL STARTUP ERROR ===', error);
    process.exit(1);
  }
}

startServer();