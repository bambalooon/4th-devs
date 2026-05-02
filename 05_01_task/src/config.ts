import OpenAI from 'openai'
// @ts-expect-error — root config is untyped JS
import { AI_API_KEY, CHAT_API_BASE_URL, EXTRA_API_HEADERS, resolveModelForProvider } from '../../config.js'
import { observeOpenAI } from "@langfuse/openai";
import { OpenRouter } from "@openrouter/sdk";

export const openai = observeOpenAI(new OpenAI({
  apiKey: AI_API_KEY as string,
  baseURL: CHAT_API_BASE_URL as string,
  defaultHeaders: EXTRA_API_HEADERS as Record<string, string>,
}));

// OpenRouter native SDK — used for STT (Whisper) which uses a different API format
export const openrouter = new OpenRouter({
  apiKey: AI_API_KEY as string,
});

export { resolveModelForProvider }
