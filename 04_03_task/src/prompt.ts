import { LangfuseClient } from "@langfuse/client";

const USER_PROMPT = `Solve the domatowo task.

Inspect the map and current state first, then plan a careful search that stays within the action budget. Use transporters for road movement, scouts for foot inspection, and \`execute_code\` only when deterministic parsing or path search helps. Call the helicopter immediately after a scout confirms the hidden person at a coordinate.`;

// Load .env when running without --env-file flag (e.g. npx tsx src/index.ts)
try { process.loadEnvFile(".env"); } catch { /* already loaded or file missing */ }

// Initialize the Langfuse client
const langfuse = new LangfuseClient();

// Create a text prompt
await langfuse.prompt.create({
    name: "domatowo",
    type: "text",
    prompt: USER_PROMPT,
    labels: ["production"]
});

console.log("Prompt 'domatowo' uploaded to Langfuse.");
