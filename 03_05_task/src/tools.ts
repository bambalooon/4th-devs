import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises'
import {join, relative, resolve} from 'node:path'
import {taskTools} from "./task.js";
import {executeCode} from "./sandbox.js";

export interface ToolDefinition {
  type: 'function'
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface Tool {
  definition: ToolDefinition
  handler: (args: Record<string, unknown>) => Promise<string>
}

const WORKSPACE = join(process.cwd(), 'workspace')

function isPathSafe(path: string): boolean {
  const fullPath = resolve(join(WORKSPACE, path))
  const workspaceResolved = resolve(WORKSPACE)
  const rel = relative(workspaceResolved, fullPath)
  return !rel.startsWith('..') && rel !== '..'
}
const tools: Tool[] = [
  ...taskTools,
  {
    definition: {
      type: 'function',
      name: 'list_files',
      description: 'List files in a workspace directory. Path is relative to workspace root.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path relative to workspace (e.g. "notes")' },
        },
        required: ['path'],
      },
    },
    handler: async (args) => {
      try {
        const path = args.path
        if (typeof path !== 'string') return 'Error: path must be a string'
        if (!isPathSafe(path)) return 'Error: Path escapes workspace'
        const fullPath = join(WORKSPACE, path)
        const entries = await readdir(fullPath)
        return JSON.stringify(entries)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return `Error: ${msg}`
      }
    },
  },
  {
    definition: {
      type: 'function',
      name: 'read_file',
      description: 'Read a file from the workspace directory. Path is relative to workspace root.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to workspace' },
        },
        required: ['path'],
      },
    },
    handler: async (args) => {
      try {
        const path = args.path
        if (typeof path !== 'string') {
          return 'Error: path must be a string'
        }
        if (!isPathSafe(path)) {
          return 'Error: Path escapes workspace'
        }
        const fullPath = join(WORKSPACE, path)
        const content = await readFile(fullPath, 'utf-8')
        return content
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return `Error: ${msg}`
      }
    },
  },
  {
    definition: {
      type: 'function',
      name: 'write_file',
      description: 'Write content to a file in the workspace directory. Creates parent directories if needed. Path is relative to workspace root.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to workspace' },
          content: { type: 'string', description: 'Content to write' },
        },
        required: ['path', 'content'],
      },
    },
    handler: async (args) => {
      try {
        const path = args.path
        const content = args.content
        if (typeof path !== 'string') {
          return 'Error: path must be a string'
        }
        if (typeof content !== 'string') {
          return 'Error: content must be a string'
        }
        if (!isPathSafe(path)) {
          return 'Error: Path escapes workspace'
        }
        const fullPath = join(WORKSPACE, path)
        const dir = join(fullPath, '..')
        await mkdir(dir, { recursive: true })
        await writeFile(fullPath, content, 'utf-8')
        return `Wrote ${path}`
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return `Error: ${msg}`
      }
    },
  },
  {
    definition: {
      type: 'function',
      name: 'delegate',
      description: 'Delegate a task to another agent. The runner handles actual delegation; this is a marker tool.',
      parameters: {
        type: 'object',
        properties: {
          agent: { type: 'string', description: 'Name of the agent to delegate to' },
          task: { type: 'string', description: 'Task description to delegate' },
          image_url: { type: 'string', description: 'Optional image URL to analyze' },
        },
        required: ['agent', 'task'],
      },
    },
    handler: async (args) => {
      return JSON.stringify(args)
    },
  },
  {
    definition: {
      type: 'function',
      name: 'execute_code',
      description:
        'Execute TypeScript code in an isolated Deno sandbox. ' +
        'Top-level await is supported. Use console.log() to produce output. ' +
        'Has read/write access to the workspace directory.',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'TypeScript code to execute in Deno' },
        },
        required: ['code'],
        additionalProperties: false,
      },
    },
    handler: async (args) => {
      const code = typeof args.code === 'string' ? args.code : '';
      if (!code) return 'Error: Missing "code" string field.';

      console.log('  ─────────────────────────────────');
      for (const line of code.split('\n')) console.log(`  │ ${line}`);
      console.log('  ─────────────────────────────────');

      const result = await executeCode(code, { permissionLevel: 'standard' });

      if (result.timedOut) return 'Error: Execution timed out (30s limit)';
      if (result.exitCode !== 0) {
        let output = `Error (exit ${result.exitCode}):\n${result.stderr}`;
        if (result.stdout) output += `\n\nPartial output:\n${result.stdout}`;
        return output;
      }
      let output = result.stdout || '(executed successfully, no output)';
      if (result.stderr) output += `\n\n[stderr]: ${result.stderr}`;
      return output;
    },
  },
]

export { tools }

export const findTool = (name: string): Tool | undefined =>
  tools.find((t) => t.definition.name === name)
