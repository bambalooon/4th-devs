import { LangfuseClient } from "@langfuse/client";

const USER_PROMPT = `Solve the windpower task.

Start with windpower_start. Then request the needed reports together with windpower_get.

Use the returned data to prepare the complete final configuration, including all required safety points and any needed production point.

Send the complete final configuration in one windpower_config call, then use windpower_done only after the full config is ready.

If any action returns code -805, immediately start a fresh windpower session and rebuild the plan before trying config or done again.

Keep each config batch small enough to finish inside the 40-second window; if the full plan is too large, submit only the smallest safe batch you can complete now.

Keep the solution fast, but do not drop required safety points just to minimize the number of configs.`;

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
