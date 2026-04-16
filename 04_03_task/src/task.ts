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

const CreateSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('scout'),
  }).strict(),
  z.object({
    type: z.literal('transporter'),
    passengers: z.number().int().min(1).max(4),
  }).strict(),
]);

const MoveSchema = z.object({
  object: objectIdSchema,
  where: coordinateSchema,
}).strict();

const InspectSchema = z.object({
  object: objectIdSchema,
}).strict();

const DismountSchema = z.object({
  object: objectIdSchema,
  passengers: z.number().int().min(1).max(4),
}).strict();

const GetMapSchema = z.object({
  symbols: z.array(mapTokenSchema).min(1).optional(),
}).strict();

const SearchSymbolSchema = z.object({
  symbol: symbolSchema,
}).strict();

const CallHelicopterSchema = z.object({
  destination: coordinateSchema,
}).strict();

const TASK_STARTED_AT = Date.now();

const elapsedSeconds = () => ((Date.now() - TASK_STARTED_AT) / 1000).toFixed(1);

const logWithElapsed = (data: unknown) => console.log(`[+${elapsedSeconds()}s]`, data);

const cleanArgs = (args: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(args).filter(([, value]) => value != null));

const sendAnswer = async (answer: Record<string, unknown>, loggerFunc = logWithElapsed) => {
  const request = {
    apikey: AI_DEVS_API_KEY,
    task: TASK_NAME,
    answer,
  };

  loggerFunc(JSON.stringify(request));

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  const text = await response.text();
  loggerFunc(text);

  try {
    return JSON.stringify(JSON.parse(text));
  } catch {
    return text;
  }
};

const makeTool = (
  name: string,
  description: string,
  answer: Record<string, unknown> | ((args: Record<string, unknown>) => Record<string, unknown>),
  parameters = zodToJsonSchema(EmptySchema),
): Tool => ({
  definition: {
    type: 'function',
    name,
    description,
    parameters,
  },
  handler: async (args) => {
    const payload = typeof answer === 'function' ? answer(args) : answer;
    return sendAnswer(payload);
  },
});

export const taskTools: Tool[] = [
  makeTool('domatowo_reset', 'Reset the Domatowo board state, queue, and action points.', { action: 'reset' }),
  {
    definition: {
      type: 'function',
      name: 'domatowo_create',
      description: 'Create a scout or transporter unit.',
      parameters: zodToJsonSchema(CreateSchema),
    },
    handler: async (args) => {
      const parsed = CreateSchema.safeParse(cleanArgs(args));
      if (!parsed.success) {
        return `Validation error: ${parsed.error.issues.map((i) => i.message).join('; ')}`;
      }

      const payload =
        parsed.data.type === 'transporter'
          ? { action: 'create', type: parsed.data.type, passengers: parsed.data.passengers }
          : { action: 'create', type: parsed.data.type };

      return sendAnswer(payload);
    },
  },
  {
    definition: {
      type: 'function',
      name: 'domatowo_move',
      description: 'Queue movement of a unit to a target field.',
      parameters: zodToJsonSchema(MoveSchema),
    },
    handler: async (args) => {
      const parsed = MoveSchema.safeParse(cleanArgs(args));
      if (!parsed.success) {
        return `Validation error: ${parsed.error.issues.map((i) => i.message).join('; ')}`;
      }

      return sendAnswer({
        action: 'move',
        object: parsed.data.object,
        where: parsed.data.where,
      });
    },
  },
  {
    definition: {
      type: 'function',
      name: 'domatowo_inspect',
      description: 'Inspect the current field of a scout unit.',
      parameters: zodToJsonSchema(InspectSchema),
    },
    handler: async (args) => {
      const parsed = InspectSchema.safeParse(cleanArgs(args));
      if (!parsed.success) {
        return `Validation error: ${parsed.error.issues.map((i) => i.message).join('; ')}`;
      }

      return sendAnswer({ action: 'inspect', object: parsed.data.object });
    },
  },
  {
    definition: {
      type: 'function',
      name: 'domatowo_dismount',
      description: 'Remove scouts from a transporter and spawn them around the vehicle.',
      parameters: zodToJsonSchema(DismountSchema),
    },
    handler: async (args) => {
      const parsed = DismountSchema.safeParse(cleanArgs(args));
      if (!parsed.success) {
        return `Validation error: ${parsed.error.issues.map((i) => i.message).join('; ')}`;
      }

      return sendAnswer({
        action: 'dismount',
        object: parsed.data.object,
        passengers: parsed.data.passengers,
      });
    },
  },
  {
    definition: {
      type: 'function',
      name: 'domatowo_getObjects',
      description: 'Return all currently known units with type, position, and identifier.',
      parameters: zodToJsonSchema(EmptySchema),
    },
    handler: async () => sendAnswer({ action: 'getObjects' }),
  },
  {
    definition: {
      type: 'function',
      name: 'domatowo_getMap',
      description: 'Return the clean map layout; optionally filter by selected symbols or coordinates.',
      parameters: zodToJsonSchema(GetMapSchema),
    },
    handler: async (args) => {
      const parsed = GetMapSchema.safeParse(cleanArgs(args));
      if (!parsed.success) {
        return `Validation error: ${parsed.error.issues.map((i) => i.message).join('; ')}`;
      }

      return sendAnswer(
        parsed.data.symbols ? { action: 'getMap', symbols: parsed.data.symbols } : { action: 'getMap' },
      );
    },
  },
  {
    definition: {
      type: 'function',
      name: 'domatowo_searchSymbol',
      description: 'Search the clean map for all fields matching the provided symbol.',
      parameters: zodToJsonSchema(SearchSymbolSchema),
    },
    handler: async (args) => {
      const parsed = SearchSymbolSchema.safeParse(cleanArgs(args));
      if (!parsed.success) {
        return `Validation error: ${parsed.error.issues.map((i) => i.message).join('; ')}`;
      }

      return sendAnswer({ action: 'searchSymbol', symbol: parsed.data.symbol });
    },
  },
  makeTool('domatowo_getLogs', 'Return collected inspect log entries.', { action: 'getLogs' }),
  makeTool('domatowo_expenses', 'Return the action points spending history.', { action: 'expenses' }),
  makeTool('domatowo_actionCost', 'Return action point cost rules for all operations.', { action: 'actionCost' }),
  {
    definition: {
      type: 'function',
      name: 'domatowo_callHelicopter',
      description: 'Call the evacuation helicopter to the selected destination after a scout confirms a human.',
      parameters: zodToJsonSchema(CallHelicopterSchema),
    },
    handler: async (args) => {
      const parsed = CallHelicopterSchema.safeParse(cleanArgs(args));
      if (!parsed.success) {
        return `Validation error: ${parsed.error.issues.map((i) => i.message).join('; ')}`;
      }

      return sendAnswer({ action: 'callHelicopter', destination: parsed.data.destination });
    },
  },
];
