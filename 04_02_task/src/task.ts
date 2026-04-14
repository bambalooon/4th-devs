import {z} from 'zod';
import {zodToJsonSchema} from 'zod-to-json-schema';
import type {Tool} from "./tools.js";
import {AI_DEVS_API_KEY} from "../../config.js";

// ── Schemas ────────────────────────────────────────────────────────

const UpdateAnswerSchema = z.object({
    page: z.enum(['incydenty', 'notatki', 'zadania']),
    id: z.string().regex(/^[0-9a-f]{32}$/, 'id must be a 32-char hex string'),
    content: z.string().optional(),
    title: z.string().optional(),
    done: z.enum(['YES', 'NO']).optional(),
}).refine(
    (d) => d.content !== undefined || d.title !== undefined,
    { message: 'At least one of "content" or "title" must be provided' }
).refine(
    (d) => d.done === undefined || d.page === 'zadania',
    { message: '"done" is only allowed for page "zadania"' }
);

export const sendAnswer = async(answer) => {
    const request = {
        apikey: AI_DEVS_API_KEY,
        task: "okoeditor",
        answer
    };
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
            name: 'okoeditor_update',
            description: 'Update a record. Allowed pages: incydenty, notatki, zadania. At least "content" or "title" must be provided. "done" is only allowed for page "zadania".',
            parameters: zodToJsonSchema(UpdateAnswerSchema, { target: 'openAi' }),
        },
        handler: async (args) => {
            // Strip null/undefined values — LLMs often send explicit nulls for optional fields
            const clean = Object.fromEntries(
                Object.entries(args).filter(([, v]) => v != null)
            );
            const parsed = UpdateAnswerSchema.safeParse(clean);
            if (!parsed.success) {
                return `Validation error: ${parsed.error.issues.map(i => i.message).join('; ')}`;
            }
            return sendAnswer({ action: 'update', ...parsed.data });
        },
    },
    {
        definition: {
            type: 'function',
            name: 'okoeditor_done',
            description: 'Verify if all required data edits are completed. Returns a flag when every condition is satisfied.',
            parameters: {
                type: 'object',
                properties: {},
            },
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
