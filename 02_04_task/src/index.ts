import { createInterface } from 'node:readline/promises'
import { runAgent } from './agent.js'
import {zMailHandler} from "./task.js";

const today = new Date().toISOString().split('T')[0]

async function main() {
  // const task = [
  //   `Prepare the Daily Ops note for ${today}.`,
  //   `Start by reading the workflow instructions from workflows/daily-ops.md using the read_file tool.`,
  //   `Then follow the steps described in the workflow precisely.`,
  //   `Make sure to write the final output to output/${today}.md`,
  // ].join(' ')

  // const result = await runAgent('orchestrator', task)

  console.log(`\n========================================`)
  console.log(`  Result`)
  console.log(`========================================\n`)
  console.log(await zMailHandler('help', {page: 1}))
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
