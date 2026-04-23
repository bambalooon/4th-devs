import { LangfuseClient } from "@langfuse/client";

// Load .env when running without --env-file flag (e.g. npx tsx src/prompt.ts)
try { process.loadEnvFile(".env"); } catch { /* already loaded or file missing */ }

const langfuse = new LangfuseClient();

await langfuse.prompt.create({
  name: "filesystem",
  type: "text",
  prompt: `Solve the filesystem task.

Parse Natan's trade notes to build a virtual filesystem with three directories:
- /miasta: one file per city with JSON of needed goods and quantities
- /osoby: one file per trade manager with their name and link to their city
- /towary: one file per sold item with a link to the selling city

Notes are in workspace/notes/. Run the pipeline: extract → normalize → plan → execute → done.`,
  labels: ["production"]
});

console.log("Prompt 'filesystem' uploaded to Langfuse.");
