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
  readFile(join(WORKSPACE, `pipeline/step${step}/result`, filename), 'utf-8');

const STEP1_TASK = `Read all note files from the notes/ directory and extract structured data.
Save the results to pipeline/step1/result/ as described in your instructions.`;

const STEP2_TASK = `Read the JSON files from pipeline/step1/result/ and normalize all names to ASCII.
Save the normalized data to pipeline/step2/result/normalized.json as described in your instructions.`;

const STEP3_TASK = `Read pipeline/step2/result/normalized.json and generate a valid filesystem batch plan.
Save the plan array to pipeline/step3/result/plan.json as described in your instructions.`;

async function main() {
  console.log(`Starting filesystem pipeline from step ${FROM_STEP}...`);

  if (FROM_STEP <= 1) {
    console.log('\n[Step 1/5] Extracting data from notes...');
    await runAgent('step1_extract', STEP1_TASK);
  }

  if (FROM_STEP <= 2) {
    console.log('\n[Step 2/5] Normalizing names...');
    await runAgent('step2_normalize', STEP2_TASK);
  }

  if (FROM_STEP <= 3) {
    console.log('\n[Step 3/5] Generating filesystem plan...');
    await runAgent('step3_plan', STEP3_TASK);
  }

  if (FROM_STEP <= 4) {
    console.log('\n[Step 4/5] Executing filesystem plan...');
    const planJson = await readResult(3, 'plan.json');
    const actions = JSON.parse(planJson) as FilesystemAction[];
    console.log(`  Loaded ${actions.length} actions from plan.json`);
    const result = await executeFilesystemBatch(actions);
    await writeResult(4, 'api_response.json', JSON.stringify(result, null, 2));
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
