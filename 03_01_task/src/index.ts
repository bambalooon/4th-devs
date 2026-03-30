import { runAgent } from './agent.js'
import {readFile} from "node:fs/promises";
import {SensorDataSchema} from "./task.js";

async function main() {
  console.log(`\n========================================`)
  console.log(`  Drone Navigation Challenge`)
  console.log(`========================================\n`)

  const task = [
    'Execute the drone navigation challenge for power plant PWR6132PL (task name: drone).',
    'Step 1: Delegate to analyze_photo to retrieve the power plant map and locate the dam (tama) sector — get the grid column and row number (1-based).',
    'Step 2: Delegate to drone_pilot with the dam sector coordinates. The drone must register the mission destination as the power plant, but deliver its payload to the dam sector.',
    'The drone_pilot should read the API documentation first, then send the required instructions via execute_drone_instructions.',
    'Report the flag {FLG:...} when it appears in the API response.',
  ].join(' ')

  // const result = await runAgent('orchestrator', task)

  console.log(`\n========================================`)
  console.log(`  Result`)
  console.log(`========================================\n`)
  for (let i = 1; i < 1000; i++) {
    const fileID = String(i).padStart(4, '0');
    let fileContent;
    try {
      fileContent = await readFile(`./workspace/data/sensors/${fileID}.json`, 'utf8');
      const result = SensorDataSchema.parse(fileContent);
    } catch (err) {
      console.error(`Error processing file ${fileID}`);
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
