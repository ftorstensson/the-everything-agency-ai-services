The Everything Agency: AI Services Backend (v1.0)
This document is the definitive source of truth for the AI Services Backend. This service operates as a standalone Genkit application, providing specialized AI capabilities to other components of "The Everything Agency" ecosystem.
1. Project Goal
The primary goal of this service is to encapsulate all direct interactions with generative AI models and tools. It exposes these capabilities as simple, secure API endpoints. The first implemented feature is the searchAndAnswerFlow, which gives our Research Agent the ability to perform web searches to answer questions with grounded, factual information.
2. Core Components & Verified Versions
This project is built on a specific, verified technology stack. Adherence to these versions is critical for stability.
Node.js Version: v20.18.1
Key Dependencies:
genkit: 1.15.5
@genkit-ai/googleai: 1.15.5
genkit-cli: 1.15.5
3. Local Development Workflow (Interim API Key Solution)
This section details the precise steps to run this project in a local development environment like Firebase Studio. The current API key management is a temporary workaround and must be followed exactly.
Install Dependencies: If you haven't already, run the following command in the terminal to install the exact package versions listed in package.json:
Generated bash
npm install
Use code with caution.
Bash
Store Your API Key: Create a file named .env in the root of this project. Place your Google AI API key in it like so:
Generated code
GOOGLE_GENAI_API_KEY="AIzaSy..."
Use code with caution.
IMPORTANT: This file is your local, insecure notepad for the key. It is listed in .gitignore and must never be committed to source control.
Set the Environment Variable: The dotenv-cli script in package.json does not work reliably in the Firebase Studio environment. You must manually set the environment variable for each new terminal session. Copy your key from the .env file and run this command:
Generated bash
export GOOGLE_GENAI_API_KEY="YOUR_API_KEY_HERE"
Use code with caution.
Bash
Run the Development Server: Start the Genkit server with the following command:
Generated bash
npm run genkit:dev
Use code with caution.
Bash
Verify Success: The server is running successfully when the terminal output "stops" and looks like this, without any errors:
Generated code
Telemetry API running on http://localhost:4033
Project root: /home/user/genkittemplet
Genkit Developer UI: http://localhost:4000
Use code with caution.
You can then access the Genkit Developer UI at http://localhost:4000.
4. Key Learnings & Pitfalls
This project's stability was achieved after navigating several critical pitfalls. Understanding these is key to working effectively in this environment.
Pitfall 1: API Key Loading.
Symptom: The server fails to start with a No Gemini API key detected error.
Learning: The dotenv-cli package is not a reliable method for loading environment variables in this context. The export command is the definitive workaround for local development.
Pitfall 2: Tool Naming Mismatches.
Symptom: The flow runs but fails with a 400 Bad Request error stating google_search is not supported; please use google_search_retrieval field instead.
Learning: The Google AI API is constantly evolving. The correct name for the web search tool is googleSearchRetrieval. Always trust the API's error message.
Pitfall 3: Genkit Syntax and Versioning.
Symptom: The IDE shows No overload matches this call errors, or the server fails with TypeError: ...is not a function.
Learning: The syntax for Genkit v1.15.5 is very specific.
We must use the const genkitApp = genkit(...) pattern. The global configureGenkit() pattern is for a different version.
We must import specific model objects (e.g., import { gemini15Pro } from '@genkit-ai/googleai') and pass the object to the model parameter, not a string.
Pitfall 4: "Ghost" IDE Errors.
Symptom: The "PROBLEMS" tab shows TypeScript errors even after the code has been corrected.
Learning: The IDE's type-checker can sometimes lag or get confused. A successful server start (npm run genkit:dev) is the ultimate source of truth. If the server runs without errors, the IDE will eventually catch up and the errors will disappear.
5. The Production Architecture (The Path Forward)
The current export command for API keys is unacceptable for production. To turn this service into a real, secure, and reliable SaaS component, we will implement the following architecture using Google Cloud Secret Manager.
Store the Secret: The GOOGLE_GENAI_API_KEY will be stored as a new "secret" in the Google Cloud Secret Manager service within the "Vibe Agent Final" project.
Grant Permissions: The Genkit application will be deployed to Cloud Run. The Cloud Run service will be assigned a specific IAM Service Account. This Service Account will be granted the "Secret Manager Secret Accessor" role, giving it permission to read only that specific secret.
Fetch at Startup: The index.ts file will be modified to include code that, upon startup, authenticates to Google Cloud and securely fetches the API key from Secret Manager. This removes the need for environment variables entirely in production.
6. Future Use Cases for Genkit in This Project
This service is the foundation for the entire "AI Workforce." We should leverage Genkit for:
Retrieval-Augmented Generation (RAG): Create flows that search over our own project documents, user data in Firestore, or other private data sources to provide context-aware answers.
Multi-Agent Orchestration: Build complex flows that act as the "Project Manager," calling other, simpler flows (like this search flow) in a logical sequence to accomplish a complex task.
Custom Tools: Define new tools that allow agents to take real-world actions, such as sending emails, updating a database, or calling external APIs.
Evaluation & Testing: Use the Genkit evaluation framework to create test datasets and continuously measure the quality and performance of our agents.
7. Replicating This Environment
To duplicate this project for another purpose:
GCP Project: Ensure it is linked to a Google Cloud Project with the generativelanguage.googleapis.com (Gemini API) enabled.
API Key: Generate a new API key for the new project.
Local Development: Follow the export workflow described in Section 3.
Production Deployment: Set up a new secret in the new project's Secret Manager and configure a new Cloud Run service with the correct permissions.
Cost: Be aware that each call to a grounded model incurs costs. Monitor billing in the GCP console.