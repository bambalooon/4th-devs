import type {Tool} from "./tools.js";
import {AI_DEVS_API_KEY} from "../../config.js";

export const sendAnswer = async({ answer, apikey }: { answer: any; apikey?: string }) => {
    const request = {
        ...(apikey && { apikey }),
        task: "okoeditor",
        answer
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
            name: 'okoeditor_help',
            description: '',
            parameters: {
                type: 'object',
                properties: {},
            },
        },
        handler: async (args) => sendAnswer({ answer: { action: 'help' }, apikey: AI_DEVS_API_KEY }),
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
