import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const WORKSPACE = join(process.cwd(), 'workspace');
const DENO_DIR = join(process.cwd(), '.cache', '03_05_task-deno');
const DEFAULT_TIMEOUT = 30_000;

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

export const ensureDeno = async (): Promise<string> => {
  return new Promise((resolve, reject) => {
    const proc = spawn('deno', ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout.split('\n')[0] ?? 'unknown');
      else reject(new Error('Deno is not installed. Install: curl -fsSL https://deno.land/install.sh | sh'));
    });
    proc.on('error', () => reject(new Error('Deno is not installed. Install: curl -fsSL https://deno.land/install.sh | sh')));
  });
};

const PERM_FLAGS: Record<string, string[]> = {
  safe:     ['--no-prompt'],
  standard: ['--no-prompt', `--allow-read=${WORKSPACE},${DENO_DIR}`, `--allow-write=${WORKSPACE},${DENO_DIR}`],
  network:  ['--no-prompt', `--allow-read=${WORKSPACE},${DENO_DIR}`, `--allow-write=${WORKSPACE},${DENO_DIR}`, '--allow-net'],
  full:     ['--allow-all'],
};

export const executeCode = async (
  code: string,
  options: { timeout?: number; permissionLevel?: 'safe' | 'standard' | 'network' | 'full' } = {},
): Promise<ExecutionResult> => {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const level = options.permissionLevel ?? 'standard';
  const flags = PERM_FLAGS[level] ?? PERM_FLAGS.standard;

  const tempDir = await mkdtemp(join(tmpdir(), 'deno-sandbox-'));
  const tempFile = join(tempDir, 'script.ts');
  await writeFile(tempFile, code, 'utf-8');

  const env = { ...process.env, DENO_DIR, DENO_NO_UPDATE_CHECK: '1', NO_COLOR: '1' };

  return new Promise((resolve) => {
    let timedOut = false;

    const proc = spawn('deno', ['run', '--node-modules-dir=auto', ...flags, tempFile], {
      cwd: WORKSPACE,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill();
    }, timeout);

    proc.on('close', async (exitCode) => {
      clearTimeout(timer);
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: exitCode ?? 1, timedOut });
    });
  });
};

