import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { Tool } from './tools.js';
import { AI_DEVS_API_KEY } from '../../config.js';

const TASK_NAME = 'domatowo';
const API_URL = 'https://hub.ag3nts.org/verify';

const coordinateSchema = z.string().regex(/^[A-K](?:[1-9]|10|11)$/, 'Coordinate must be A1..K11');
const objectIdSchema = z.string().min(1, 'object must be a non-empty string');
const symbolSchema = z.string().regex(/^[A-Za-z0-9]{2}$/, 'symbol must be exactly 2 alphanumeric characters');
const mapTokenSchema = z.string().regex(/^[A-Za-z0-9]{2,3}$/, 'symbols must be 2- or 3-character alphanumeric tokens');

const EmptySchema = z.object({}).strict();

const CreateSchema = z.object({
  type: z.enum(['scout', 'transporter']),
  passengers: z.number().int().min(1).max(4).optional(),
}).strict().superRefine((data, ctx) => {
  if (data.type === 'transporter' && data.passengers === undefined) {
    ctx.addIssue({ code: 'custom', message: 'passengers is required when type is transporter' });
  }

  if (data.type === 'scout' && data.passengers !== undefined) {
    ctx.addIssue({ code: 'custom', message: 'passengers is not allowed when type is scout' });
  }
});

const MoveSchema = z.object({
  object: objectIdSchema,
  where: coordinateSchema
}).strict();

const InspectSchema = z.object({
  object: objectIdSchema
}).strict();

const DismountSchema = z.object({
  object: objectIdSchema,
  passengers: z.number().int().min(1).max(4)
}).strict();

const GetMapSchema = z.object({
  symbols: z.array(mapTokenSchema).min(1).optional()
}).strict();

const SearchSymbolSchema = z.object({
  symbol: symbolSchema
}).strict();

const CallHelicopterSchema = z.object({
  destination: coordinateSchema
}).strict();

const cleanArgs = (args: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(args).filter(([, value]) => value != null));

const validationError = (tool: string, issues: Array<{ message: string }>) => JSON.stringify({
  code: -400,
  message: `Validation error in ${tool}`,
  details: issues.map((issue) => issue.message),
});

const BaseResponseSchema = z.object({
  code: z.number(),
  message: z.string()
}).passthrough();

const sendAnswer = async (answer: Record<string, unknown>) => {
  const request = JSON.stringify({
    apikey: AI_DEVS_API_KEY,
    task: TASK_NAME,
    answer
  });
  console.log(request);

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: request,
  });

  let raw: unknown;
  try {
    raw = await response.json();
  } catch (error) {
    const payload = JSON.stringify({ code: -500, message: 'Non-JSON API response', details: [error instanceof Error ? error.message : String(error)] });
    console.log(payload)
    return payload;
  }

  const parsed = BaseResponseSchema.safeParse(raw);
  if (!parsed.success) {
    const payload = JSON.stringify({
      code: -501,
      message: 'Unexpected API response shape',
      details: parsed.error.issues.map((issue) => issue.message),
      raw,
    });
    console.log(payload)
    return payload;
  }

  const text = JSON.stringify(parsed.data);
  console.log(text)
  return text;
};

const makeJsonTool = <TInput extends Record<string, unknown>>(
  name: string,
  description: string,
  inputSchema: z.ZodType<TInput>,
  buildAnswer: (input: TInput) => Record<string, unknown>,
): Tool => ({
  definition: {
    type: 'function',
    name,
    description,
    parameters: zodToJsonSchema(inputSchema),
  },
  handler: async (args) => {
    const parsed = inputSchema.safeParse(cleanArgs(args));
    if (!parsed.success) {
      return validationError(name, parsed.error.issues);
    }

    return sendAnswer(buildAnswer(parsed.data));
  },
});

const makeNoArgTool = (name: string, description: string, answer: Record<string, unknown>): Tool => ({
  definition: {
    type: 'function',
    name,
    description,
    parameters: zodToJsonSchema(EmptySchema),
  },
  handler: async () => sendAnswer(answer),
});

export const taskTools: Tool[] = [
  makeNoArgTool('domatowo_reset', 'Reset the Domatowo board state, queue, and action points.', { action: 'reset' }),
  makeJsonTool('domatowo_create', 'Create one unit. Scout payload: { type: "scout" }. Transporter payload: { type: "transporter", passengers: 2..4 if it must move }.', CreateSchema, (input) => ({ action: 'create', ...input })),
  makeJsonTool('domatowo_move', 'Queue movement of a unit. Args: { object, where }.', MoveSchema, ({ object, where }) => ({ action: 'move', object, where })),
  makeJsonTool('domatowo_inspect', 'Inspect the current field of a scout. Args: { object }.', InspectSchema, ({ object }) => ({ action: 'inspect', object })),
  makeJsonTool('domatowo_dismount', 'Remove scouts from a transporter. Args: { object, passengers }.', DismountSchema, ({ object, passengers }) => ({ action: 'dismount', object, passengers })),
  makeNoArgTool('domatowo_getObjects', 'Return all currently known units with type, position, and identifier.', { action: 'getObjects' }),
  makeJsonTool('domatowo_getMap', 'Return the clean map layout. Optional args: { symbols }.', GetMapSchema, ({ symbols }) => (symbols ? { action: 'getMap', symbols } : { action: 'getMap' })),
  makeJsonTool('domatowo_searchSymbol', 'Search the clean map for a 2-character symbol. Args: { symbol }.', SearchSymbolSchema, ({ symbol }) => ({ action: 'searchSymbol', symbol })),
  makeNoArgTool('domatowo_getLogs', 'Return collected inspect log entries.', { action: 'getLogs' }),
  makeNoArgTool('domatowo_expenses', 'Return the action points spending history.', { action: 'expenses' }),
  makeNoArgTool('domatowo_actionCost', 'Return action point cost rules for all operations.', { action: 'actionCost' }),
  makeJsonTool('domatowo_callHelicopter', 'Call the evacuation helicopter. Args: { destination }.', CallHelicopterSchema, ({ destination }) => ({ action: 'callHelicopter', destination })),
];
