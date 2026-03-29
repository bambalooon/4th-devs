import { runAgent } from './agent.js'

async function main() {
  console.log(`\n========================================`)
  console.log(`  Mailbox Intelligence Operation`)
  console.log(`========================================\n`)

  const task = [
    'Execute the mailbox intelligence operation.',
    'Find three values from the mailbox: the attack date (YYYY-MM-DD), the employee system password, and the SEC- confirmation code.',
    'Wiktor sent an email from the proton.me domain.',
    'Coordinate the specialist agents, collect all three values, and submit them to the Hub.',
    'Report the flag when the Hub confirms success.',
  ].join(' ')

  const result = await runAgent('mailbox_orchestrator', task)

  console.log(`\n========================================`)
  console.log(`  Result`)
  console.log(`========================================\n`)
  console.log(result)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
