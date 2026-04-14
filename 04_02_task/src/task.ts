import {z} from 'zod';
import {zodToJsonSchema} from 'zod-to-json-schema';
import type {Tool} from "./tools.js";
import {AI_DEVS_API_KEY} from "../../config.js";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must use YYYY-MM-DD');
const hourSchema = z.string().regex(/^(?:[01]\d|2[0-3]):00:00$/, 'startHour must use HH:00:00');
const timestampSchema = z.string().regex(/^\d{4}-\d{2}-\d{2} (?:[01]\d|2[0-3]):00:00$/, 'config keys must use YYYY-MM-DD HH:00:00');
const pitchAngleSchema = z.number().finite();
const windMsSchema = z.number().finite();
const turbineModeSchema = z.enum(['production', 'idle']);
const unlockCodeSchema = z.string().min(1, 'unlockCode is required');

const ConfigPointSchema = z.object({
    pitchAngle: pitchAngleSchema,
    turbineMode: turbineModeSchema,
    unlockCode: unlockCodeSchema,
}).strict();

const GetSchema = z.object({
    param: z.enum(['weather', 'turbinecheck', 'powerplantcheck', 'documentation']),
}).strict();

const UnlockCodeGeneratorSchema = z.object({
    startDate: dateSchema,
    startHour: hourSchema,
    windMs: windMsSchema,
    pitchAngle: pitchAngleSchema,
}).strict();

const DoneSchema = z.object({}).strict();

const ConfigSchema = z.object({
    startDate: dateSchema.optional(),
    startHour: hourSchema.optional(),
    pitchAngle: pitchAngleSchema.optional(),
    turbineMode: turbineModeSchema.optional(),
    unlockCode: unlockCodeSchema.optional(),
    configs: z.unknown().optional(),
}).strict().refine(
    (data) => {
        const hasBatch = data.configs !== undefined;
        const hasSingle = data.startDate !== undefined
            || data.startHour !== undefined
            || data.pitchAngle !== undefined
            || data.turbineMode !== undefined
            || data.unlockCode !== undefined;

        if (hasBatch) {
            if (hasSingle || data.configs === null || typeof data.configs !== 'object' || Array.isArray(data.configs)) {
                return false;
            }

            return Object.entries(data.configs as Record<string, unknown>).every(
                ([key, value]) => timestampSchema.safeParse(key).success && ConfigPointSchema.safeParse(value).success
            );
        }

        return data.startDate !== undefined
            && data.startHour !== undefined
            && data.pitchAngle !== undefined
            && data.turbineMode !== undefined
            && data.unlockCode !== undefined;
    },
    { message: 'Provide either a single config point or a configs batch' }
);

const cleanArgs = (args: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(args).filter(([, value]) => value != null));

export const sendAnswer = async (answer: Record<string, unknown>) => {
    const request = {
        apikey: AI_DEVS_API_KEY,
        task: 'windpower',
        answer,
    };
    console.log(request);
    const response = await fetch('https://hub.ag3nts.org/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    });

    const data = JSON.stringify(await response.json());
    console.log(data);
    return data;
};

const makeActionTool = <T extends z.ZodTypeAny>(name: string, description: string, action: string, schema: T): Tool => ({
    definition: {
        type: 'function',
        name,
        description,
        parameters: zodToJsonSchema(schema),
    },
    handler: async (args) => {
        const parsed = schema.safeParse(cleanArgs(args));
        if (!parsed.success) {
            return `Validation error: ${parsed.error.issues.map((i) => i.message).join('; ')}`;
        }
        return sendAnswer({ action, ...parsed.data });
    },
});

export const taskTools: Tool[] = [
    makeActionTool('windpower_start', 'Start a new windpower service window.', 'start', DoneSchema),
    makeActionTool('windpower_get', 'Request task data for weather, turbinecheck, powerplantcheck, or documentation.', 'get', GetSchema),
    makeActionTool('windpower_get_result', 'Fetch one completed queued response.', 'getResult', DoneSchema),
    makeActionTool('windpower_config', 'Store a single config point or a batch of config points.', 'config', ConfigSchema),
    makeActionTool('windpower_unlock_code_generator', 'Generate an unlock code for a config point.', 'unlockCodeGenerator', UnlockCodeGeneratorSchema),
    makeActionTool('windpower_done', 'Validate the final configuration.', 'done', DoneSchema),
    {
        definition: {
            type: 'function',
            name: 'wait_for',
            description: 'Wait for a given number of seconds before continuing. Use when you get rate-limited.',
            parameters: {
                type: 'object',
                properties: {
                    seconds: { type: 'number', description: 'Number of seconds to wait. Recommended: 1–3 on first retry, double on each subsequent retry.' },
                },
                required: ['seconds'],
            },
        },
        handler: async (args) => {
            const seconds = typeof args.seconds === 'number' ? args.seconds : 5;
            await new Promise(resolve => setTimeout(resolve, seconds * 1000));
            return `Waited ${seconds} second(s).`;
        },
    },
];
