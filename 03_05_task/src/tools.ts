import {mkdir, readFile, writeFile} from 'node:fs/promises'
import {join, relative, resolve} from 'node:path'
import {taskTools} from "./task.js";

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
]

export { tools }

export const findTool = (name: string): Tool | undefined =>
  tools.find((t) => t.definition.name === name)
