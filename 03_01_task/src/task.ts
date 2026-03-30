import {AI_DEVS_API_KEY} from "../../config.js";
import type {Tool} from "./tools.js";
import {z} from "zod";

export const SensorType = z.enum(['humidity', 'pressure', 'temperature', 'voltage', 'water']);
export type SensorType = z.infer<typeof SensorType>;

const notSet = z.literal(0).transform(() => null);
const optionalInt = (min: number, max: number) =>
    z.union([notSet, z.number().int().min(min).max(max)]);
const optionalFloat = (min: number, max: number) =>
    z.union([notSet, z.number().min(min).max(max)]);

const sensorFieldMap: Record<SensorType, string> = {
    temperature: 'temperature_K',
    pressure: 'pressure_bar',
    water: 'water_level_meters',
    voltage: 'voltage_supply_v',
    humidity: 'humidity_percent',
};

const SensorDataObject = z.object({
    sensor_type: z.string().transform((val) =>
        val.split('/').map((v) => SensorType.parse(v.trim()))
    ).refine((arr) => arr.length >= 1, { message: 'sensor_type must contain at least 1 type' }),
    timestamp: z.number().int().transform((val) => new Date(val * 1000)),
    temperature_K: optionalInt(553, 873),
    pressure_bar: optionalInt(60, 160),
    water_level_meters: optionalFloat(5.0, 15.0),
    voltage_supply_v: optionalFloat(229.0, 231.0),
    humidity_percent: optionalFloat(40.0, 80.0),
    operator_notes: z.string().min(1),
}).strict().superRefine((data, ctx) => {
    const types = new Set(data.sensor_type);
    for (const [type, field] of Object.entries(sensorFieldMap)) {
        const value = data[field as keyof typeof data];
        if (types.has(type as SensorType) && value === null) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: [field],
                message: `${field} must have a value when sensor_type includes '${type}'`,
            });
        }
        if (!types.has(type as SensorType) && value !== null) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: [field],
                message: `${field} must be 0 when sensor_type does not include '${type}'`,
            });
        }
    }
});

export const SensorDataSchema = z
    .union([SensorDataObject, z.string().transform((val) => JSON.parse(val)).pipe(SensorDataObject)]);

export type SensorData = z.output<typeof SensorDataSchema>;

export const imageTools: Tool[] = [
    {
        definition: {
            type: 'function',
            name: 'get_power_plant_map',
            description: 'Return URL of the power plant map image (PNG). Pass this URL to a vision model for analysis.',
            parameters: {
                type: 'object',
                properties: {}
            },
        },
        handler: async (args) => `https://hub.ag3nts.org/data/${AI_DEVS_API_KEY}/drone.png`,
    },
];
    
const sendAnswer = async(recheck_ids:string[]) => {
    const request = {
        apikey: AI_DEVS_API_KEY,
        task: "evaluation",
        answer: {
            recheck: recheck_ids,
        }
    }
    console.log(request);
    const response = await fetch("https://hub.ag3nts.org/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request)
    });

    const data = await response.json();
    console.log(data);
    return JSON.stringify(data);
};

export const evaluationTools: Tool[] = [
    {
        definition: {
            type: 'function',
            name: 'send_answer',
            description: '',
            parameters: {
                type: 'object',
                properties: {
                    recheck_ids: {
                        type: 'array',
                        items: { type: 'string' },
                        minItems: 1,
                    },
                },
                required: ['recheck_ids'],
            },
        },
        handler: async (args) => sendAnswer(args.recheck_ids),
    },
    {
        definition: {
            type: 'function',
            name: 'wait_for',
            description: 'Wait for a given number of seconds before continuing. Use when you get rate-limited (code -9999).',
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
