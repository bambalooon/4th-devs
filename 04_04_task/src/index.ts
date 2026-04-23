import "./instrumentation"; // Must be the first import
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runAgent } from './agent.js';
import { executeFilesystemBatch, executeFilesystemDone, type FilesystemAction } from './task.js';
import { shutdownTracing } from "./instrumentation.js";

const WORKSPACE = join(process.cwd(), 'workspace');
const FROM_STEP = parseInt(process.env.FROM_STEP ?? '1');

const writeResult = async (step: number, filename: string, content: string) => {
  const dir = join(WORKSPACE, `pipeline/step${step}/result`);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, filename), content, 'utf-8');
};

const readResult = (step: number, filename: string): Promise<string> =>
  readFile(join(WORKSPACE, `pipeline/step${step}/result`, filename), 'utf-8')

const assertStepDone = async (step: number): Promise<void> => {
  try {
    const raw = await readResult(step, 'status.json')
    const status = JSON.parse(raw) as { status?: string }
    if (status.status !== 'done') throw new Error(`status=${status.status}`)
  } catch (err) {
    throw new Error(`Step ${step} did not complete successfully: ${err instanceof Error ? err.message : err}`)
  }
};

// ── Step 2: pure-code transliteration (no LLM) ──────────────────────────────
const POLISH: Record<string, string> = {
  ą:'a', ć:'c', ę:'e', ł:'l', ń:'n', ó:'o', ś:'s', ź:'z', ż:'z',
  Ą:'A', Ć:'C', Ę:'E', Ł:'L', Ń:'N', Ó:'O', Ś:'S', Ź:'Z', Ż:'Z',
}
const toKey = (s: string) =>
  s.split('').map(c => POLISH[c] ?? c).join('')
    .toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 20)

const normalizeStep2 = async () => {
  const [citiesRaw, personsRaw, itemsRaw] = await Promise.all([
    readResult(1, 'cities_needs.json'),
    readResult(1, 'persons_cities.json'),
    readResult(1, 'items_for_sale.json'),
  ])
  const cities1 = JSON.parse(citiesRaw) as Record<string, Record<string, number>>
  const persons1 = JSON.parse(personsRaw) as Record<string, string>
  const items1 = JSON.parse(itemsRaw) as Record<string, string>

  const cities: Record<string, Record<string, number>> = {}
  for (const [city, needs] of Object.entries(cities1)) {
    cities[toKey(city)] = Object.fromEntries(
      Object.entries(needs).map(([item, qty]) => [toKey(item), qty])
    )
  }
  const persons: Record<string, string> = {}
  for (const [name, city] of Object.entries(persons1)) {
    persons[toKey(name)] = toKey(city)
  }
  const items_for_sale: Record<string, string> = {}
  for (const [item, city] of Object.entries(items1)) {
    items_for_sale[toKey(item)] = toKey(city)
  }

  await writeResult(2, 'normalized.json', JSON.stringify({ cities, persons, items_for_sale }, null, 2))
  await writeResult(2, 'status.json', JSON.stringify({ status: 'done' }))
  console.log(`  Transliterated ${Object.keys(cities).length} cities, ${Object.keys(persons).length} persons, ${Object.keys(items_for_sale).length} items`)
}
// ────────────────────────────────────────────────────────────────────────────

const STEP1_TASK = `Read all note files from the notes/ directory and extract structured data.
Save the results to pipeline/step1/result/ as described in your instructions.`;

const STEP3_TASK = `Read pipeline/step2/result/normalized.json and generate a valid filesystem batch plan.
Save the plan array to pipeline/step3/result/plan.json as described in your instructions.`;

async function main() {
  console.log(`Starting filesystem pipeline from step ${FROM_STEP}...`);

  if (FROM_STEP <= 1) {
    console.log('\n[Step 1/5] Extracting data from notes...');
    await runAgent('step1_extract', STEP1_TASK);
    await assertStepDone(1);
  }

  if (FROM_STEP <= 2) {
    console.log('\n[Step 2/5] Normalizing names (code)...')
    await normalizeStep2()
  }

  if (FROM_STEP <= 3) {
    console.log('\n[Step 3/5] Generating filesystem plan...')
    await runAgent('step3_plan', STEP3_TASK)
    await assertStepDone(3)
  }

  if (FROM_STEP <= 4) {
    console.log('\n[Step 4/5] Executing filesystem plan...');
    const planJson = await readResult(3, 'plan.json');
    const actions = JSON.parse(planJson) as FilesystemAction[];
    console.log(`  Loaded ${actions.length} actions from plan.json`);
    const result = await executeFilesystemBatch(actions);
    await writeResult(4, 'api_response.json', JSON.stringify(result, null, 2));
    const batchCode = (result as { code?: number })?.code;
    if (batchCode !== undefined && batchCode < 0) {
      throw new Error(`Batch execution failed (code ${batchCode}): ${(result as { message?: string })?.message}`);
    }
    await writeResult(4, 'status.json', JSON.stringify({ status: 'done' }));
  }

  if (FROM_STEP <= 5) {
    console.log('\n[Step 5/5] Calling done...');
    const result = await executeFilesystemDone();
    const code = (result as { code?: number })?.code;
    const status = code === 0 ? 'success' : 'failed';
    await writeResult(5, 'final_result.json', JSON.stringify(result, null, 2));
    await writeResult(5, 'status.json', JSON.stringify({ status, code }));
    console.log(`\nPipeline finished. Status: ${status}`);
    console.log('Final result:', JSON.stringify(result));
  }
}

main()
  .catch((err) => {
    console.error('Fatal error:', err);
  })
  .finally(async () => {
    await shutdownTracing();
  });
