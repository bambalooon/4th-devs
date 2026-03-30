import {AI_DEVS_API_KEY} from "../../config.js";
import type {Tool} from "./tools.js";
import {z} from "zod";

export const SensorType = z.enum(['humidity', 'pressure', 'temperature', 'voltage', 'water']);
export type SensorType = z.infer<typeof SensorType>;

const SensorDataObject = z.object({
    sensor_type: z.string().transform((val) =>
        val.split('/').map((v) => SensorType.parse(v.trim()))
    ),
    timestamp: z.number(),
    temperature_K: z.number(),
    pressure_bar: z.number(),
    water_level_meters: z.number(),
    voltage_supply_v: z.number(),
    humidity_percent: z.number(),
    operator_notes: z.string(),
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
