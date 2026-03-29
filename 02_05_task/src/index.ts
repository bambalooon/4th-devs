import { runAgent } from './agent.js'

async function main() {
  console.log(`\n========================================`)
  console.log(`  Operation Dam Break`)
  console.log(`========================================\n`)

  const task = [
    'Execute Operation Dam Break for power plant PWR6132PL (task name: drone).',
    'Step 1: Delegate to analyze_photo to retrieve the power plant map and locate the dam (tama) sector — get the grid column and row number (1-based).',
    'Step 2: Delegate to drone_pilot with the dam sector coordinates. The drone must register the mission as targeting the power plant, but drop the bomb on the dam sector.',
    'The drone_pilot should read the API documentation first, then send the required instructions via execute_drone_instructions.',
    'Report the flag {FLG:...} when it appears in the API response.',
  ].join(' ')

  const result = await runAgent('orchestrator', task)

  console.log(`\n========================================`)
  console.log(`  Result`)
  console.log(`========================================\n`)
  console.log(result)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
