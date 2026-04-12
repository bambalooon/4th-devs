import type {Tool} from "./tools.js";
import {AI_DEVS_API_KEY} from "../../config.js";

export const callTool = async(url_suffix:string, query:string) => {
    const request = {
        apikey: AI_DEVS_API_KEY,
        query
    }
    console.log(request);
    const response = await fetch(`https://hub.ag3nts.org${url_suffix}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request)
    });

    const data = JSON.stringify(await response.json());
    console.log(data);
    return data;
};

export const sendAnswer = async(answer:string[]) => {
    const request = {
        apikey: AI_DEVS_API_KEY,
        task: "savethem",
        answer: answer
    }
    console.log(request);
    const response = await fetch("https://hub.ag3nts.org/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request)
    });

    const data = JSON.stringify(await response.json());
    console.log(data);
    return data;
};

export const taskTools: Tool[] = [
    {
        definition: {
            type: 'function',
            name: 'call_tool',
            description: 'Call an external API tool. For /api/toolsearch: query can be natural language keywords. For /api/maps: query must be a CITY NAME (e.g. "Skolwin"). For /api/wehicles: query must be an EXACT vehicle name (one of: rocket, horse, walk, car). Keep queries short.',
            parameters: {
                type: 'object',
                properties: {
                    url_suffix: {
                        type: 'string',
                        description: 'API endpoint suffix to call (e.g. "/api/toolsearch").',
                    },
                    query: {
                        type: 'string',
                        description: 'API endpoint query to send in the request body.',
                    },
                },
                required: ['url_suffix', 'query'],
            },
        },
        handler: async (args) => callTool(args.url_suffix as string, args.query as string),
    },
    {
        definition: {
            type: 'function',
            name: 'send_answer',
            description: 'Send optimal route as an answer, e.g. "wehicle_name", "right", "right", "up", "down", "up","..."',
            parameters: {
                type: 'object',
                properties: {
                    answer: {
                        type: 'array',
                        items: {
                            type: 'string'
                        },
                        minItems: 1,
                    },
                },
                required: ['answer'],
            },
        },
        handler: async (args) => sendAnswer(args.answer),
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
