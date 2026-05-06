import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { startConversation, sendMessage } from './task.js'

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
  // ── Phonecall tools ───────────────────────────────────────────────────────
  {
    definition: {
      type: 'function',
      name: 'start_conversation',
      description:
        'Start a new phonecall session with the operator. ' +
        'Returns the operator\'s opening message as text. ' +
        'Call this once at the beginning. If the conversation needs to restart, call it again.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    handler: async () => {
      try {
        const { transcript, raw } = await startConversation()
        const flag = raw.flag ?? raw.answer
        if (flag && typeof flag === 'string' && flag.startsWith('{{')) {
          return JSON.stringify({ transcript, flag })
        }
        const result: Record<string, unknown> = { transcript }
        if (typeof raw.code === 'number') result.code = raw.code
        if (typeof raw.hint === 'string') result.hint = raw.hint
        return JSON.stringify(result)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return `Error starting conversation: ${msg}`
      }
    },
  },
  {
    definition: {
      type: 'function',
      name: 'send_message',
      description:
        'Send a Polish text message to the operator. ' +
        'The text is automatically converted to audio (TTS) and sent. ' +
        'The operator\'s audio response is transcribed and returned as text. ' +
        'Keep messages short and natural. One subject per message.',
      parameters: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'Polish text to say to the operator. Keep it short and natural.',
          },
        },
        required: ['text'],
      },
    },
    handler: async (args) => {
      const text = typeof args.text === 'string' ? args.text : ''
      if (!text.trim()) return 'Error: text is required'
      try {
        const { transcript, raw } = await sendMessage(text)
        const flag = raw.flag ?? raw.answer
        if (flag && typeof flag === 'string' && flag.startsWith('{{')) {
          return JSON.stringify({ transcript, flag })
        }
        const result: Record<string, unknown> = { transcript }
        if (typeof raw.code === 'number') result.code = raw.code
        if (typeof raw.hint === 'string') result.hint = raw.hint
        // Burned conversation — tell agent to restart
        if (raw.code === -771) {
          result.error = 'Conversation burned. You MUST call start_conversation again before sending any more messages.'
        }
        return JSON.stringify(result)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return `Error sending message: ${msg}`
      }
    },
  },

  // ── Workspace file tools ──────────────────────────────────────────────────
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
]

export { tools }

export const findTool = (name: string): Tool | undefined =>
  tools.find((t) => t.definition.name === name)
