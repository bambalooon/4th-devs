import { LangfuseClient } from "@langfuse/client";

const USER_PROMPT = `Navigate the transport robot from its start position (column 1, row 5) to the goal (column 7, row 5).

Begin now by sending the "start" command, then guide the robot step by step to the goal.`;

// Load .env when running without --env-file flag (e.g. npx tsx src/index.ts)
try { process.loadEnvFile(".env"); } catch { /* already loaded or file missing */ }

// Initialize the Langfuse client
const langfuse = new LangfuseClient();

// Create a text prompt
await langfuse.prompt.create({
    name: "robot-reactor",
    type: "text",
    prompt: USER_PROMPT,
    labels: ["production"] // optionally, directly promote to production
});

console.log("Prompt 'robot-reactor' uploaded to Langfuse.");
