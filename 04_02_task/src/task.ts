import {z} from 'zod';
import {zodToJsonSchema} from 'zod-to-json-schema';
import type {Tool} from "./tools.js";
import {AI_DEVS_API_KEY} from "../../config.js";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must use YYYY-MM-DD');
const hourSchema = z.string().regex(/^(?:[01]\d|2[0-3]):00:00$/, 'startHour must use HH:00:00');
const pitchAngleSchema = z.number().finite();
const windMsSchema = z.number().finite();
const turbineModeSchema = z.enum(['production', 'idle']);

const ConfigInputSchema = z.object({
    startDate: dateSchema,
    startHour: hourSchema,
    windMs: windMsSchema,
    pitchAngle: pitchAngleSchema,
    turbineMode: turbineModeSchema,
}).strict();

const GetSchema = z.object({
    params: z.array(z.enum(['weather', 'turbinecheck', 'powerplantcheck', 'documentation'])).min(1),
}).strict().superRefine((data, ctx) => {
    const seen = new Set<string>();
    for (const param of data.params) {
        if (seen.has(param)) {
            ctx.addIssue({ code: 'custom', message: `Duplicate param: ${param}` });
            return;
        }
        seen.add(param);
    }
});

const DoneSchema = z.object({}).strict();

const ConfigSchema = z.object({
    configs: z.array(ConfigInputSchema).min(1),
}).strict();

const TASK_STARTED_AT = Date.now();

const elapsedSeconds = () => ((Date.now() - TASK_STARTED_AT) / 1000).toFixed(1);

const logWithElapsed = (data: unknown) => console.log(`[+${elapsedSeconds()}s]`, data);

const cleanArgs = (args: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(args).filter(([, value]) => value != null));

const isString = (value: unknown): value is string => typeof value === 'string';

const sendAnswer = async (answer: Record<string, unknown>, loggerFunc = logWithElapsed) => {
    const request = {
        apikey: AI_DEVS_API_KEY,
        task: 'windpower',
        answer,
    };
    loggerFunc(request);
    const response = await fetch('https://hub.ag3nts.org/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    });

    const data = JSON.stringify(await response.json());
    loggerFunc(data);
    return data;
};

const extractUnlockCode = (value: unknown): string | null => {
    if (isString(value)) {
        return value.match(/[a-f0-9]{32}/i)?.[0] ?? null;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            const found = extractUnlockCode(item);
            if (found) return found;
        }
        return null;
    }

    if (value && typeof value === 'object') {
        for (const nested of Object.values(value as Record<string, unknown>)) {
            const found = extractUnlockCode(nested);
            if (found) return found;
        }
    }

    return null;
};

const parseResponse = (value: string): Record<string, unknown> => {
    try {
        return JSON.parse(value) as Record<string, unknown>;
    } catch {
        return {};
    }
};

const normalizeSignedNumber = (value: unknown) => {
    const numberValue = typeof value === 'string' ? Number(value) : value;
    return typeof numberValue === 'number' && Number.isFinite(numberValue)
        ? numberValue.toFixed(1)
        : String(value);
};

const configSignature = (item: { [key: string]: unknown }) =>
    [item.startDate, item.startHour, normalizeSignedNumber(item.windMs), normalizeSignedNumber(item.pitchAngle)].join('|');

const waitForQueuedResult = async (expectedSourceFunction?: string) => {
    let delay = 10;

    while (true) {
        const result = parseResponse(await sendAnswer({ action: 'getResult' }, () => {}));

        if (result.code === 11 && result.message === 'No completed queued response is available yet.') {
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
        }

        logWithElapsed(result);
        if (!expectedSourceFunction || result['sourceFunction'] === expectedSourceFunction) {
            return result;
        }
    }
};

export const taskTools: Tool[] = [
    {
        definition: {
            type: 'function',
            name: 'windpower_start',
            description: 'Start a new windpower service window.',
            parameters: zodToJsonSchema(DoneSchema),
        },
        handler: async () => sendAnswer({ action: 'start' }),
    },
    {
        definition: {
            type: 'function',
            name: 'windpower_get',
            description: 'Request multiple task reports at once and return the collected results.',
            parameters: zodToJsonSchema(GetSchema),
        },
        handler: async (args) => {
            const parsed = GetSchema.safeParse(cleanArgs(args));
            if (!parsed.success) {
                return `Validation error: ${parsed.error.issues.map((i) => i.message).join('; ')}`;
            }

            const queued = parsed.data.params.filter((param) => param !== 'documentation');
            const directDocs = parsed.data.params.includes('documentation')
                ? await sendAnswer({ action: 'get', param: 'documentation' })
                : null;

            await Promise.all(queued.map((param) => sendAnswer({ action: 'get', param })));

            const collected: Record<string, unknown> = {};
            while (Object.keys(collected).length < queued.length) {
                const result = await waitForQueuedResult();
                const source = result['sourceFunction'];
                if (typeof source === 'string' && queued.includes(source) && collected[source] === undefined) {
                    collected[source] = result;
                }
            }

            return JSON.stringify({
                documentation: directDocs,
                results: collected,
            });
        },
    },
    {
        definition: {
            type: 'function',
            name: 'windpower_config',
            description: 'Store a batch of config points; unlock codes are generated and flattened in code.',
            parameters: zodToJsonSchema(ConfigSchema),
        },
        handler: async (args) => {
            const parsed = ConfigSchema.safeParse(cleanArgs(args));
            if (!parsed.success) {
                const validationError = `Validation error: ${parsed.error.issues.map((i) => i.message).join('; ')}`;
                logWithElapsed(`windpower_config ${validationError}`);
                return validationError;
            }

            const configItems = parsed.data.configs;
            await Promise.all(configItems.map((item) => sendAnswer({
                action: 'unlockCodeGenerator',
                startDate: item.startDate,
                startHour: item.startHour,
                windMs: item.windMs,
                pitchAngle: item.pitchAngle,
            })));

            const unlockCodeBySignature = new Map<string, string>();
            while (unlockCodeBySignature.size < configItems.length) {
                const unlockResponse = await waitForQueuedResult('unlockCodeGenerator');
                const unlockCode = extractUnlockCode(unlockResponse);
                const signedParams = unlockResponse['signedParams'];

                if (!unlockCode || !signedParams || typeof signedParams !== 'object') {
                    logWithElapsed(`windpower_config failed: could not extract unlockCode`);
                    return 'Validation error: could not extract unlockCode';
                }

                const key = configSignature({
                    startDate: String((signedParams as Record<string, unknown>).startDate ?? ''),
                    startHour: String((signedParams as Record<string, unknown>).startHour ?? ''),
                    windMs: (signedParams as Record<string, unknown>).windMs,
                    pitchAngle: (signedParams as Record<string, unknown>).pitchAngle,
                });
                unlockCodeBySignature.set(key, unlockCode);
            }

            const configs: Record<string, Record<string, unknown>> = {};
            for (const item of configItems) {
                const unlockCode = unlockCodeBySignature.get(configSignature(item));
                if (!unlockCode) {
                    logWithElapsed(`windpower_config failed could not extract unlockCode`);
                    return 'Validation error: could not extract unlockCode';
                }

                const key = `${item.startDate} ${item.startHour}`;
                configs[key] = {
                    pitchAngle: item.pitchAngle,
                    turbineMode: item.turbineMode,
                    unlockCode,
                };
            }

            const result = await sendAnswer({ action: 'config', configs });
            logWithElapsed(`windpower_config finished`);
            return result;
        },
    },
    {
        definition: {
            type: 'function',
            name: 'windpower_done',
            description: 'Validate the final configuration.',
            parameters: zodToJsonSchema(DoneSchema),
        },
        handler: async () => sendAnswer({ action: 'done' }),
    },
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
