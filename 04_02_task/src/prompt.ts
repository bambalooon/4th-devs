import { LangfuseClient } from "@langfuse/client";

const USER_PROMPT = `Solve the windpower task.

Start with windpower_start. Then request the needed reports with windpower_get in as few batch calls as possible. Treat returned reports as queued and unordered.

Use the data to prepare the smallest valid configuration set, send it with windpower_config, and finish with windpower_done only after the config is complete.

If rate-limited, use wait_for briefly and continue. Keep the solution fast and minimal to fit the 40-second limit.`;

// Load .env when running without --env-file flag (e.g. npx tsx src/index.ts)
try { process.loadEnvFile(".env"); } catch { /* already loaded or file missing */ }

// Initialize the Langfuse client
const langfuse = new LangfuseClient();

// Create a text prompt
await langfuse.prompt.create({
    name: "windpower",
    type: "text",
    prompt: USER_PROMPT,
    labels: ["production"]
});

console.log("Prompt 'windpower' uploaded to Langfuse.");
