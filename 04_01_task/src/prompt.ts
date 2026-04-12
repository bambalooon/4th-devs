import { LangfuseClient } from "@langfuse/client";

const USER_PROMPT = `Read the file notes/oko_state.json to get the current state of all OKO records, then execute the following edits in order and call okoeditor_done when finished.`;

// Load .env when running without --env-file flag (e.g. npx tsx src/index.ts)
try { process.loadEnvFile(".env"); } catch { /* already loaded or file missing */ }

// Initialize the Langfuse client
const langfuse = new LangfuseClient();

// Create a text prompt
await langfuse.prompt.create({
    name: "okoeditor",
    type: "text",
    prompt: USER_PROMPT,
    labels: ["production"]
});

console.log("Prompt 'okoeditor' uploaded to Langfuse.");
