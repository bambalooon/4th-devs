import {AI_DEVS_API_KEY} from "../../config.js";
import type {Tool} from "./tools.js";

export const robotTools: Tool[] = [
    {
        definition: {
            type: 'function',
            name: 'execute_robot_command',
            description: 'Execute one of robot commands: start, reset, left, wait or right',
            parameters: {
                type: 'object',
                properties: {
                    cmd: {
                        type: 'string',
                        enum: ['start', 'reset', 'left', 'wait', 'right'],
                        description: 'Robot command',
                    },
                },
                required: ['cmd'],
            },
        },
        handler: async (args) => sendAnswer(args.cmd),
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

export const sendAnswer = async(cmd:string) => {
    const request = {
        apikey: AI_DEVS_API_KEY,
        task: "reactor",
        answer: {
            command: cmd,
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

export const taskTools: Tool[] = [
];
