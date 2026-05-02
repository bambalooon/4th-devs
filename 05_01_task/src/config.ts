import OpenAI from 'openai'
// @ts-expect-error — root config is untyped JS
import { AI_API_KEY, CHAT_API_BASE_URL, EXTRA_API_HEADERS, resolveModelForProvider } from '../../config.js'
import {observeOpenAI} from "@langfuse/openai";

export const openai = observeOpenAI(new OpenAI({
  apiKey: AI_API_KEY as string,
  baseURL: CHAT_API_BASE_URL as string,
  defaultHeaders: EXTRA_API_HEADERS as Record<string, string>,
}));

// Whisper client — bypass Langfuse wrapper (it can corrupt multipart requests)
// Uses same OpenRouter base URL but without the observeOpenAI wrapper
export const openaiDirect = new OpenAI({
  apiKey: AI_API_KEY as string,
  baseURL: CHAT_API_BASE_URL as string,
  defaultHeaders: EXTRA_API_HEADERS as Record<string, string>,
});

export { resolveModelForProvider }
