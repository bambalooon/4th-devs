import {AI_DEVS_API_KEY} from "../../config.js";
import type {Tool} from "./tools.js";

export const executeShellCommand = async(cmd:string) => {
    const request = {
        apikey: AI_DEVS_API_KEY,
        cmd: cmd
    }
    console.log(request);
    const response = await fetch("https://hub.ag3nts.org/api/shell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request)
    });

    const data = await response.json();
    console.log(data);
    return JSON.stringify(data);
};

export const vmTools: Tool[] = [
    {
        definition: {
            type: 'function',
            name: 'execute_shell_command',
            description: 'Execute shell command on VM',
            parameters: {
                type: 'object',
                properties: {
                    cmd: {
                        type: 'string',
                        description: 'Shell command, e.g. help, reboot',
                    },
                },
                required: ['cmd'],
            },
        },
        handler: async (args) => executeShellCommand(args.cmd),
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

export const sendAnswer = async(confirmation_code:string) => {
    const request = {
        apikey: AI_DEVS_API_KEY,
        task: "firmware",
        answer: {
            confirmation: confirmation_code,
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
    {
        definition: {
            type: 'function',
            name: 'send_answer',
            description: 'Send answer after successfully starting cooler unit',
            parameters: {
                type: 'object',
                properties: {
                    confirmation_code: {
                        type: 'string',
                        description: 'Confirmation code in format: ECCS-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
                    },
                },
                required: ['confirmation_code'],
            },
        },
        handler: async (args) => sendAnswer(args.confirmation_code),
    }
];
