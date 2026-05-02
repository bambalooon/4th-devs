import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import * as readline from 'node:readline'
import { openai, openrouter } from './config.js'
import { ReportSchema } from './task.js'
import { zodToJsonSchema } from 'zod-to-json-schema'

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

/** Blocking stdin prompt — pauses the agent loop until user answers */
async function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

/** Classify a signal type without touching LLMs */
export function classifySignal(raw: Record<string, unknown>): 'noise' | 'text' | 'binary_text' | 'binary_image' | 'binary_audio' {
  if (raw.transcription && typeof raw.transcription === 'string' && raw.transcription.trim().length > 10) {
    return 'text'
  }
  if (raw.attachment && typeof raw.attachment === 'string') {
    const mime = typeof raw.meta === 'string' ? raw.meta.toLowerCase() : ''
    if (mime.includes('image')) return 'binary_image'
    if (mime.includes('audio') || mime.includes('mpeg') || mime.includes('wav') || mime.includes('ogg')) return 'binary_audio'
    // Try to decode and peek
    try {
      const decoded = Buffer.from(raw.attachment, 'base64').toString('utf-8')
      const trimmed = decoded.trim()
      if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.match(/^[a-zA-Z0-9 \t\n\r.,;:!?'"()\-–—]+$/)) {
        return 'binary_text'
      }
    } catch { /* not utf-8 text */ }
    // Check magic bytes
    const bytes = Buffer.from(raw.attachment.slice(0, 16), 'base64')
    const hex = bytes.toString('hex')
    if (hex.startsWith('ffd8ff')) return 'binary_image'         // JPEG
    if (hex.startsWith('89504e47')) return 'binary_image'       // PNG
    if (hex.startsWith('47494638')) return 'binary_image'       // GIF
    if (hex.startsWith('52494646')) return 'binary_audio'       // WAV/RIFF
    if (hex.startsWith('494433') || hex.startsWith('fffb')) return 'binary_audio' // MP3
    return 'binary_text' // fallback — treat as potentially readable
  }
  return 'noise'
}

/** Decode base64 attachment to text if possible */
export function decodeAttachmentText(raw: Record<string, unknown>): string | null {
  if (typeof raw.attachment !== 'string') return null
  try {
    return Buffer.from(raw.attachment, 'base64').toString('utf-8')
  } catch {
    return null
  }
}

const tools: Tool[] = [
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
      name: 'extract_facts',
      description:
        'Extract facts about the city codenamed "Syjon" from a text fragment. ' +
        'Returns JSON with any of: cityName, warehousesCount, phoneNumber, cityArea, notes.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text fragment to analyze' },
          source: { type: 'string', description: 'Source label for logging (e.g. "001_listen")' },
        },
        required: ['text'],
      },
    },
    handler: async (args) => {
      const text = typeof args.text === 'string' ? args.text : ''
      const source = typeof args.source === 'string' ? args.source : 'unknown'
      if (!text.trim()) return JSON.stringify({ notes: 'empty input' })

      const response = await openai.chat.completions.create({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content:
              'You analyze radio intercept fragments to find intelligence about a city codenamed "Syjon". ' +
              'Extract ANY partial facts, even indirect hints. Fields to extract (all optional): ' +
              '"cityName" (real city name — e.g. if text says "Syjon is actually Wrocław", output "Wrocław"), ' +
              '"warehousesCount" (integer count of warehouses/magazyny on Syjon), ' +
              '"phoneNumber" (contact phone number as string), ' +
              '"cityArea" (area in km² as numeric string e.g. "123.45" — look for fields named occupiedArea, area, powierzchnia, or similar), ' +
              '"notes" (any other relevant clues about Syjon — location, size, infrastructure, people). ' +
              'IMPORTANT: for structured data like JSON or CSV, extract cityArea from "occupiedArea" or similar numeric area fields for the city identified as Syjon. ' +
              'If nothing about Syjon is found, return {"notes":"no relevant data"}. ' +
              'Output MUST be a raw JSON object — absolutely no markdown fences, no backticks, no ```json.',
          },
          { role: 'user', content: `Source: ${source}\n\n${text}` },
        ],
        temperature: 0,
      })

      const raw = response.choices[0]?.message?.content ?? '{}'
      try {
        JSON.parse(raw) // validate
        return raw
      } catch {
        return raw
      }
    },
  },
  {
    definition: {
      type: 'function',
      name: 'analyze_image',
      description:
        'Analyze a base64-encoded image attachment for facts about the city codenamed "Syjon". ' +
        'Only call this after the user has approved HITL confirmation. ' +
        'Returns JSON facts same shape as extract_facts.',
      parameters: {
        type: 'object',
        properties: {
          base64: { type: 'string', description: 'Base64-encoded image data' },
          mime: { type: 'string', description: 'MIME type, e.g. image/jpeg' },
          source: { type: 'string', description: 'Source label for logging' },
        },
        required: ['base64', 'mime'],
      },
    },
    handler: async (args) => {
      const base64 = typeof args.base64 === 'string' ? args.base64 : ''
      const mime = typeof args.mime === 'string' ? args.mime : 'image/jpeg'
      const source = typeof args.source === 'string' ? args.source : 'unknown'
      if (!base64) return JSON.stringify({ notes: 'no image data' })

      const response = await openai.chat.completions.create({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content:
              'You analyze images from radio intercepts. Extract any facts about the city codenamed "Syjon". ' +
              'IMPORTANT: "Syjon" is a codename — "cityName" must be the REAL city name (e.g. "Skarszewy"), NOT "Syjon" itself. ' +
              'Look for: city name labels, warehouse/magazyn counts, phone numbers, area/surface data. ' +
              'Return ONLY a raw JSON object with optional fields: cityName, warehousesCount, phoneNumber, cityArea, notes. ' +
              'Absolutely NO markdown fences, no ```json, no backticks — just the raw JSON object.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Source: ${source}. What facts about "Syjon" can you find in this image?` },
              { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
            ],
          },
        ],
        temperature: 0,
      })

      const raw = response.choices[0]?.message?.content ?? '{}'
      try { JSON.parse(raw); return raw } catch { return raw }
    },
  },
  {
    definition: {
      type: 'function',
      name: 'analyze_audio',
      description:
        'Analyze a base64-encoded audio attachment for facts about the city codenamed "Syjon". ' +
        'Only call this after the user has approved HITL confirmation. ' +
        'Returns JSON facts same shape as extract_facts.',
      parameters: {
        type: 'object',
        properties: {
          base64: { type: 'string', description: 'Base64-encoded audio data' },
          mime: { type: 'string', description: 'MIME type, e.g. audio/mpeg' },
          source: { type: 'string', description: 'Source label for logging' },
        },
        required: ['base64', 'mime'],
      },
    },
    handler: async (args) => {
      const base64 = typeof args.base64 === 'string' ? args.base64 : ''
      const mime = typeof args.mime === 'string' ? args.mime : 'audio/mpeg'
      const source = typeof args.source === 'string' ? args.source : 'unknown'
      if (!base64) return JSON.stringify({ notes: 'no audio data' })

      // Check if transcription was already cached in output/
      const transcriptionPath = join(WORKSPACE, 'output', `${source}_transcription.txt`)
      let transcription: string
      try {
        transcription = await readFile(transcriptionPath, 'utf-8')
        console.log(`[analyze_audio:${source}] Using cached transcription`)
      } catch {
        // Not cached — transcribe via OpenRouter STT
        const ext = mime.includes('wav') ? 'wav' : mime.includes('ogg') ? 'ogg' : 'mp3'
        try {
          const result = await openrouter.stt.createTranscription({
            sttRequest: {
              model: 'openai/whisper-1',
              inputAudio: {
                data: base64,
                format: ext as 'mp3' | 'wav' | 'ogg',
              },
            },
          })
          transcription = result.text
          await mkdir(join(WORKSPACE, 'output'), { recursive: true })
          await writeFile(transcriptionPath, transcription, 'utf-8')
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.warn(`[analyze_audio:${source}] Whisper unavailable: ${msg}`)
          return JSON.stringify({ notes: `audio skipped - transcription unavailable: ${msg}` })
        }
      }

      console.log(`[analyze_audio:${source}] Transcription: ${transcription.slice(0, 200)}`)

      const response = await openai.chat.completions.create({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content:
              'You analyze radio intercept transcriptions. Extract facts about city codenamed "Syjon". ' +
              'Return ONLY a raw JSON object with optional fields: cityName, warehousesCount, phoneNumber, cityArea, notes. ' +
              'Absolutely NO markdown fences, no ```json, no backticks — just the raw JSON object.',
          },
          { role: 'user', content: `Source: ${source}\nTranscription: ${transcription}` },
        ],
        temperature: 0,
      })

      const raw = response.choices[0]?.message?.content ?? '{}'
      try { JSON.parse(raw); return raw } catch { return raw }
    },
  },
  {
    definition: {
      type: 'function',
      name: 'ask_human',
      description:
        'Show the user a description of a binary attachment and ask whether to analyze it. ' +
        'Use when signal type is binary_image or binary_audio. ' +
        'Returns "approved" or "skipped".',
      parameters: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'Signal index label, e.g. "003"' },
          mime: { type: 'string', description: 'MIME type of the attachment' },
          fileSizeKb: { type: 'number', description: 'File size in KB' },
          collectedFacts: { type: 'string', description: 'Summary of facts collected so far from other signals' },
        },
        required: ['source', 'mime'],
      },
    },
    handler: async (args) => {
      const source = typeof args.source === 'string' ? args.source : '?'
      const mime = typeof args.mime === 'string' ? args.mime : 'unknown'
      const sizeKb = typeof args.fileSizeKb === 'number' ? `${args.fileSizeKb.toFixed(1)} KB` : 'unknown size'
      const facts = typeof args.collectedFacts === 'string' && args.collectedFacts.trim()
        ? args.collectedFacts
        : 'none yet'

      console.log(`\n${'─'.repeat(60)}`)
      console.log(`[HITL] Signal ${source} — binary attachment`)
      console.log(`  Type  : ${mime}`)
      console.log(`  Size  : ${sizeKb}`)
      console.log(`  Facts collected so far: ${facts}`)
      console.log(`${'─'.repeat(60)}`)

      const answer = await promptUser(`Analyze this attachment? [y/N] `)
      const approved = answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes'
      console.log(`[HITL] User chose: ${approved ? 'APPROVED' : 'SKIPPED'}\n`)
      return approved ? 'approved' : 'skipped'
    },
  },
  {
    definition: {
      type: 'function',
      name: 'synthesize_report',
      description:
        'Read all output/*.json files and synthesize the final report. ' +
        'Returns a JSON object matching the ReportSchema (cityName, cityArea, warehousesCount, phoneNumber).',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    handler: async () => {
      const outputDir = join(WORKSPACE, 'output')
      const inputDir = join(WORKSPACE, 'input')
      let files: string[] = []
      try {
        files = (await readdir(outputDir))
          .filter(f => f.endsWith('.json'))
          .sort()
      } catch {
        return JSON.stringify({ error: 'No output/ directory found. Run pipeline first.' })
      }

      const allFacts: unknown[] = []
      for (const file of files) {
        try {
          const content = await readFile(join(outputDir, file), 'utf-8')
          allFacts.push({ source: file, ...JSON.parse(content) })
        } catch { /* skip malformed */ }
      }

      if (!allFacts.length) return JSON.stringify({ error: 'No output files found.' })

      // Also include raw structured attachments (JSON/CSV) for cross-referencing city data
      // These are useful when the city name is known from other signals but area data lives here
      const structuredInputs: unknown[] = []
      try {
        const inputFiles = (await readdir(inputDir)).filter(f => f.endsWith('.json')).sort()
        for (const file of inputFiles) {
          try {
            const raw = JSON.parse(await readFile(join(inputDir, file), 'utf-8')) as Record<string, unknown>
            if (raw.attachment && typeof raw.attachment === 'string') {
              const meta = typeof raw.meta === 'string' ? raw.meta : ''
              if (meta.includes('json') || meta.includes('text')) {
                const decoded = Buffer.from(raw.attachment, 'base64').toString('utf-8')
                const parsed = JSON.parse(decoded)
                structuredInputs.push({ source: file, data: parsed })
              }
            }
          } catch { /* skip */ }
        }
      } catch { /* no input dir */ }

      const responseSchema = zodToJsonSchema(ReportSchema, { name: 'Report' })

      const response = await openai.chat.completions.create({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content:
              'You are synthesizing a final report from radio intercept analysis results. ' +
              'Given multiple partial fact objects, determine the most reliable values. ' +
              'If facts conflict, prefer the most consistent/specific value. ' +
              'CRITICAL: "cityName" must be the REAL city name (e.g. "Skarszewy"), NOT the codename "Syjon". ' +
              'For "cityArea": search ALL sources for any numeric area/surface data associated with the identified city. ' +
              'Look for fields like "occupiedArea", "area", "powierzchnia" in structured data sources. ' +
              'If a field has NO supporting evidence across all sources, set it to null — do NOT invent or default to zero. ' +
              'Return ONLY a JSON object strictly matching the provided schema — no markdown, no commentary.',
          },
          { role: 'user', content: JSON.stringify({
            analyzedFacts: allFacts,
            rawStructuredData: structuredInputs,
          }, null, 2) },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'Report',
            strict: true,
            schema: (
              (responseSchema as Record<string, unknown>).definitions
                ? ((responseSchema as Record<string, unknown>).definitions as Record<string, unknown>).Report
                : responseSchema
            ) as Record<string, unknown>,
          },
        },
        temperature: 0,
      })

      const raw = response.choices[0]?.message?.content ?? '{}'

      try {
        const parsed = JSON.parse(raw)
        // Validate and coerce cityArea to exactly 2dp in code (not LLM)
        if (typeof parsed.cityArea === 'number') {
          parsed.cityArea = (parsed.cityArea as number).toFixed(2)
        }
        // Validate with Zod
        const validated = ReportSchema.parse(parsed)
        return JSON.stringify(validated)
      } catch (err) {
        return JSON.stringify({ error: 'Validation failed', details: String(err), raw })
      }
    },
  },
]

export { tools }

export const findTool = (name: string): Tool | undefined =>
  tools.find((t) => t.definition.name === name)
