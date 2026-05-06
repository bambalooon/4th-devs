import "./instrumentation.js";
import { runAgent } from './agent.js';
import { shutdownTracing } from './instrumentation.js';

async function main(): Promise<void> {
  console.log('[phonecall] Starting task...');

  const result = await runAgent(
    'standard',
    'Przeprowadź rozmowę z operatorem zgodnie z instrukcjami. Zacznij od start_conversation.',
  );

  console.log('\n[phonecall] Final result:', result);
}

main()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await shutdownTracing();
  });
