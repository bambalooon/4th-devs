import { LangfuseClient } from "@langfuse/client";

const USER_PROMPT = `Your task is to find the optimal route for our messenger who needs to reach the city of Skolwin.

Start by using call_tool with url_suffix="/api/toolsearch" to discover all available tools (map, vehicles, movement rules). Then gather all necessary data, plan the shortest route that fits within the resource budget (10 food portions, 10 fuel units), and submit the answer using send_answer.`;

// Load .env when running without --env-file flag (e.g. npx tsx src/index.ts)
try { process.loadEnvFile(".env"); } catch { /* already loaded or file missing */ }

// Initialize the Langfuse client
const langfuse = new LangfuseClient();

// Create a text prompt
await langfuse.prompt.create({
    name: "savethem",
    type: "text",
    prompt: USER_PROMPT,
    labels: ["production"]
});

console.log("Prompt 'savethem' uploaded to Langfuse.");
