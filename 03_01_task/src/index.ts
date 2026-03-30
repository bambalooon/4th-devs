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
  const result = await readFile('./workspace/data/sensors/0001.json', 'utf8')
      .then(data => SensorDataSchema.parse(data));
  console.log(result)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
