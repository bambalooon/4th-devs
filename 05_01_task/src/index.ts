import "./instrumentation.js";
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { radioStart, radioListen, radioTransmit, type TransmitReport } from './task.js';
import { classifySignal, decodeAttachmentText, findTool } from './tools.js';
import { runAgent } from './agent.js';
import { shutdownTracing } from './instrumentation.js';

const WORKSPACE = join(process.cwd(), 'workspace');
const INPUT_DIR = join(WORKSPACE, 'input');
const OUTPUT_DIR = join(WORKSPACE, 'output');
const MAX_LISTEN_CALLS = 50; // safety cap

const pad = (n: number) => String(n).padStart(3, '0');

/** Save raw API response to input/NNN_listen.json (skips if exists) */
async function saveInput(index: number, data: unknown): Promise<void> {
  const file = join(INPUT_DIR, `${pad(index)}_listen.json`);
  await mkdir(INPUT_DIR, { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2), 'utf-8');
}

/** Load raw input if cached */
async function loadInput(index: number): Promise<Record<string, unknown> | null> {
  const file = join(INPUT_DIR, `${pad(index)}_listen.json`);
  if (!existsSync(file)) return null;
  const raw = await readFile(file, 'utf-8');
  return JSON.parse(raw) as Record<string, unknown>;
}

/** Check if output already exists for this index */
function hasOutput(index: number): boolean {
  return existsSync(join(OUTPUT_DIR, `${pad(index)}_facts.json`));
}

/** Save analysis output */
async function saveOutput(index: number, facts: unknown): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(join(OUTPUT_DIR, `${pad(index)}_facts.json`), JSON.stringify(facts, null, 2), 'utf-8');
}

// ── Phase 1: Collect all signals ─────────────────────────────────────────────

async function collectSignals(): Promise<number> {
  console.log('\n[Phase 1] Starting radio session...');
  await radioStart();

  let index = 1;
  let done = false;

  while (!done && index <= MAX_LISTEN_CALLS) {
    // Check if we already have this input cached
    const cached = await loadInput(index);

    let signal: Record<string, unknown>;
    if (cached) {
      console.log(`[Phase 1] Signal ${pad(index)} — using cached input`);
      signal = cached;
    } else {
      console.log(`[Phase 1] Signal ${pad(index)} — calling radio_listen...`);
      signal = await radioListen();
      await saveInput(index, signal);
    }

    // Check if the API signals we have enough data
    const code = Number(signal.code ?? 0);
    const message = String(signal.message ?? '').toLowerCase();
    if (
      code === 200 ||
      message.includes('enough') ||
      message.includes('complete') ||
      message.includes('finished') ||
      message.includes('done') ||
      message.includes('wystarczaj')  // Polish: "wystarczająco"
    ) {
      console.log(`[Phase 1] API signals collection complete at signal ${pad(index)}.`);
      // Save this terminal response too, then stop
      done = true;
    }

    // If no useful content and no attachment, check for end-of-stream codes
    if (!signal.transcription && !signal.attachment && code !== 100) {
      console.log(`[Phase 1] No more signals (code=${code}). Stopping collection.`);
      done = true;
    }

    index++;
  }

  const total = index - 1;
  console.log(`[Phase 1] Collected ${total} signals.\n`);
  return total;
}

// ── Phase 2: Analyze each signal ─────────────────────────────────────────────

async function analyzeSignals(total: number): Promise<void> {
  console.log('[Phase 2] Analyzing signals...');

  // Build a running summary of facts found so far (for HITL context)
  const collectedFactsSummary: string[] = [];

  for (let i = 1; i <= total; i++) {
    if (hasOutput(i)) {
      console.log(`[Phase 2] Signal ${pad(i)} — output already exists, skipping`);
      continue;
    }

    const signal = await loadInput(i);
    if (!signal) {
      console.log(`[Phase 2] Signal ${pad(i)} — no input file, skipping`);
      continue;
    }

    const type = classifySignal(signal);
    console.log(`[Phase 2] Signal ${pad(i)} — type: ${type}`);

    let facts: Record<string, unknown> = { notes: 'no relevant data' };

    if (type === 'noise') {
      facts = { notes: 'noise/no content' };

    } else if (type === 'text') {
      const text = String(signal.transcription ?? '');
      const extractTool = findTool('extract_facts')!;
      const result = await extractTool.handler({ text, source: pad(i) });
      facts = JSON.parse(result) as Record<string, unknown>;

    } else if (type === 'binary_text') {
      const text = decodeAttachmentText(signal) ?? String(signal.attachment ?? '').slice(0, 2000);
      const extractTool = findTool('extract_facts')!;
      const result = await extractTool.handler({ text, source: `${pad(i)}_decoded` });
      facts = JSON.parse(result) as Record<string, unknown>;

    } else if (type === 'binary_image' || type === 'binary_audio') {
      // HITL: ask user before calling expensive model
      const mime = String(signal.meta ?? (type === 'binary_image' ? 'image/unknown' : 'audio/unknown'));
      const b64 = String(signal.attachment ?? '');
      const fileSizeKb = b64.length * 0.75 / 1024; // approx decoded size

      const askTool = findTool('ask_human')!;
      const decision = await askTool.handler({
        source: pad(i),
        mime,
        fileSizeKb,
        collectedFacts: collectedFactsSummary.join('; ') || 'none yet',
      });

      if (decision === 'approved') {
        const toolName = type === 'binary_image' ? 'analyze_image' : 'analyze_audio';
        const analysisTool = findTool(toolName)!;
        const result = await analysisTool.handler({ base64: b64, mime, source: pad(i) });
        facts = JSON.parse(result) as Record<string, unknown>;
      } else {
        facts = { notes: `user skipped ${type} analysis` };
      }
    }

    await saveOutput(i, facts);

    // Update running summary for subsequent HITL prompts
    const summary = Object.entries(facts)
      .filter(([k]) => k !== 'notes')
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    if (summary) collectedFactsSummary.push(`[${pad(i)}] ${summary}`);
    console.log(`[Phase 2] Signal ${pad(i)} facts: ${JSON.stringify(facts)}`);
  }

  console.log('\n[Phase 2] Analysis complete.\n');
}

// ── Phase 3: Synthesize and transmit ─────────────────────────────────────────

async function synthesizeAndTransmit(): Promise<void> {
  console.log('[Phase 3] Synthesizing final report...');

  const synthTool = findTool('synthesize_report')!;
  const reportJson = await synthTool.handler({});

  const report = JSON.parse(reportJson) as Record<string, unknown>;
  console.log('[Phase 3] Synthesized report:', reportJson);

  if (report.error) {
    throw new Error(`Synthesis failed: ${report.error}`);
  }

  // Validate required fields
  const required = ['cityName', 'cityArea', 'warehousesCount', 'phoneNumber'];
  for (const field of required) {
    if (report[field] === undefined || report[field] === null) {
      throw new Error(`Missing required field in report: ${field}`);
    }
  }

  // Ensure cityArea is a string with exactly 2 decimal places
  const areaRaw = report.cityArea;
  let cityArea: string;
  if (typeof areaRaw === 'string' && /^\d+\.\d{2}$/.test(areaRaw)) {
    cityArea = areaRaw;
  } else {
    cityArea = Number(areaRaw).toFixed(2);
  }

  const transmit: TransmitReport = {
    cityName: String(report.cityName),
    cityArea,
    warehousesCount: Number(report.warehousesCount),
    phoneNumber: String(report.phoneNumber),
  };

  console.log('[Phase 3] Transmitting:', JSON.stringify(transmit));
  const result = await radioTransmit(transmit);
  console.log('[Phase 3] Server response:', JSON.stringify(result));

  await mkdir(join(WORKSPACE, 'report'), { recursive: true });
  await writeFile(join(WORKSPACE, 'report', 'final.json'), JSON.stringify({ transmit, result }, null, 2), 'utf-8');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const total = await collectSignals();
  await analyzeSignals(total);
  await synthesizeAndTransmit();
}

main()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await shutdownTracing();
  });
