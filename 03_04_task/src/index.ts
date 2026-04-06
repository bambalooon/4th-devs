import "./instrumentation"; // Must be the first import
import {runAgent} from './agent.js'
import {langfuse, shutdownTracing} from "./instrumentation.js";

async function main() {
  console.log("Starting firmware agent...");

  const prompt = await langfuse.prompt.get("robot-reactor");
  const userPrompt = prompt.compile();

  const result = await runAgent('standard', userPrompt);
  console.log("Agent finished. Result:", result);
}

main()
  .catch((err) => {
    console.error('Fatal error:', err)
  })
  .finally(async () => {
    await shutdownTracing();
  })
