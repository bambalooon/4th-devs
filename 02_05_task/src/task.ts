import {AI_DEVS_API_KEY} from "../../config.js";
import type {Tool} from "./tools.js";

const zMailHandler = async (action:string, args:any) => {
    const request = {
        apikey: AI_DEVS_API_KEY,
        action: action,
        ...args
    }
    console.log(request);
    const response = await fetch("https://hub.ag3nts.org/api/zmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request)
    });

    const data = await response.json();
    console.log(JSON.stringify(data));
    return JSON.stringify(data);
};

export const mailTools: Tool[] = [
    {
        definition: {
            type: 'function',
            name: 'get_inbox',
            description: 'Return list of threads in your mailbox.',
            parameters: {
                type: 'object',
                properties: {
                    page: { type: 'number', description: 'Page number (optional). Integer >= 1. Default: 1.' },
                    perPage: { type: 'number', description: 'Number of results per page (optional) Integer between 5 and 20. Default: 5.' }
                }
            },
        },
        handler: async (args) => zMailHandler('getInbox', args),
    },
    {
        definition: {
            type: 'function',
            name: 'get_thread',
            description: 'Return rowID and messageID list for a selected thread. No message body.',
            parameters: {
                type: 'object',
                properties: {
                    threadID: { type: 'number', description: 'Required. Numeric thread identifier.' },
            }
            },
        },
        handler: async (args) => zMailHandler('getThread', args),
    },
    {
        definition: {
            type: 'function',
            name: 'get_messages',
            description: 'Return one or more messages by rowID/messageID (hash).',
            parameters: {
                type: 'object',
                properties: {
                    ids: { description: 'Required. Numeric rowID, 32-char messageID, or an array of them.' },
                },
                required: ['ids'],
            },
        },
        handler: async (args) => zMailHandler('getMessages', args),
    },
    {
        definition: {
            type: 'function',
            name: 'search',
            description: 'Search messages with full-text style query and Gmail-like operators. Supports words, "phrase", -exclude, from:, to:, subject:, OR, AND.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Required. Supports words, "phrase", -exclude, from:, to:, subject:, subject:"phrase", subject:(phrase), OR, AND. Missing operator means AND.' },
                    page: { type: 'number', description: 'Optional. Integer >= 1. Default: 1.' },
                    perPage: { type: 'number', description: 'Optional. Integer between 5 and 20. Default: 5.' },
                },
                required: ['query'],
            },
        },
        handler: async (args) => zMailHandler('search', args),
    },
    {
        definition: {
            type: 'function',
            name: 'reset',
            description: 'Reset request counter for this apikey in memcache (in case of fuckup).',
            parameters: {
                type: 'object',
                properties: {},
            },
        },
        handler: async () => zMailHandler('reset', {}),
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
    
const sendAnswerHandler = async(password:string, date:string, confirmationCode:string) => {
    const request = {
        apikey: AI_DEVS_API_KEY,
        task: "mailbox",
        answer: {
            password: password,
            date: date,
            confirmation_code: confirmationCode
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

export const verifyTools: Tool[] = [
    {
        definition: {
            type: 'function',
            name: 'send_answer',
            description: 'Send answer to Hub (Centrala) for verification',
            parameters: {
                type: 'object',
                properties: {
                    password: { type: 'string', description: 'hasło do systemu pracowniczego, które prawdopodobnie nadal znajduje się na tej skrzynce' },
                    date: { type: 'string', description: 'kiedy (format YYYY-MM-DD) dział bezpieczeństwa planuje atak na naszą elektrownię' },
                    confirmationCode: { type: 'string', description: 'kod potwierdzenia z ticketa wysłanego przez dział bezpieczeństwa (format: SEC- + 32 znaki = 36 znaków łącznie)' }
                },
                required: ['password', 'date', 'confirmationCode'],
            },
        },
        handler: async (args) => sendAnswerHandler(args.password, args.date, args.confirmationCode),
    }
];