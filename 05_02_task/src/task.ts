// @ts-expect-error — root config is untyped JS
import { AI_DEVS_API_KEY } from '../../config.js';
import { openrouter } from './config.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const TASK_NAME = 'phonecall';
const API_URL = 'https://hub.ag3nts.org/verify';
const AUDIO_DIR = join(process.cwd(), 'workspace', 'audio');

export type ApiResponse = Record<string, unknown>;

// ── Audio file logging ────────────────────────────────────────────────────────

let turnCounter = 0;

const saveAudio = async (audioBase64: string, label: string): Promise<void> => {
  try {
    await mkdir(AUDIO_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `turn_${String(turnCounter).padStart(2, '0')}_${label}_${ts}.mp3`;
    const filePath = join(AUDIO_DIR, filename);
    await writeFile(filePath, Buffer.from(audioBase64, 'base64'));
    console.log(`[phonecall] 🎵 Saved audio: workspace/audio/${filename}`);
  } catch (err) {
    console.warn('[phonecall] Warning: could not save audio file:', err instanceof Error ? err.message : err);
  }
};

// ── Internal helpers ──────────────────────────────────────────────────────────

const sendRequest = async (answer: unknown): Promise<ApiResponse> => {
  const body = JSON.stringify({ apikey: AI_DEVS_API_KEY, task: TASK_NAME, answer });
  const answerLog = JSON.stringify(answer);
  // Don't log full audio base64
  const logAnswer = answerLog.length > 200
    ? answerLog.slice(0, 200) + `… (${answerLog.length} chars)`
    : answerLog;
  console.log('[phonecall] →', logAnswer);
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const result = await response.json() as ApiResponse;
  const logResult = { ...result };
  if (typeof logResult.audio === 'string') {
    logResult.audio = `<base64 ${logResult.audio.length} chars>`;
  }
  if (typeof logResult.attachment === 'string') {
    logResult.attachment = `<base64 ${logResult.attachment.length} chars>`;
  }
  console.log('[phonecall] ←', JSON.stringify(logResult).slice(0, 400));
  return result;
};

/** Text → base64 MP3 via OpenRouter TTS */
export const tts = async (text: string): Promise<string> => {
  const stream = await openrouter.tts.createSpeech({
    speechRequest: {
      model: 'openai/gpt-4o-mini-tts-2025-12-15',
      input: text,
      voice: 'alloy',
      responseFormat: 'mp3',
    },
  });
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return Buffer.from(merged).toString('base64');
};

/** base64 audio → Polish transcript via OpenRouter STT */
export const stt = async (audioBase64: string): Promise<string> => {
  const result = await openrouter.stt.createTranscription({
    sttRequest: {
      model: 'openai/whisper-large-v3-turbo',
      inputAudio: {
        data: audioBase64,
        format: 'mp3',
      },
      language: 'pl',
    },
  });
  return result.text;
};

/** Extract audio base64 from API response (checks audio and attachment fields) */
const extractAudio = (result: ApiResponse): string | null => {
  if (typeof result.audio === 'string' && result.audio.length > 0) return result.audio;
  if (typeof result.attachment === 'string' && result.attachment.length > 0) return result.attachment;
  return null;
};

// ── Public API tools ──────────────────────────────────────────────────────────

/**
 * Start a new phonecall session.
 * Returns the operator's opening message as transcribed text.
 * Also returns the raw API response in case it contains a flag.
 */
export const startConversation = async (): Promise<{ transcript: string; raw: ApiResponse }> => {
  turnCounter = 0;
  const raw = await sendRequest({ action: 'start' });
  const audio = extractAudio(raw);
  if (audio) {
    await saveAudio(audio, 'received');
  }
  const transcript = audio
    ? await stt(audio)
    : String(raw.message ?? raw.text ?? JSON.stringify(raw));
  console.log('[phonecall] Operator (start):', transcript);
  return { transcript, raw };
};

/**
 * Send a text message to the operator.
 * Converts text → audio via TTS, sends it, receives audio response, transcribes with STT.
 * Returns the operator's response as text plus raw response (may contain flag).
 */
export const sendMessage = async (text: string): Promise<{ transcript: string; raw: ApiResponse }> => {
  turnCounter += 1;
  const audioBase64 = await tts(text);
  await saveAudio(audioBase64, 'sent');
  const raw = await sendRequest({ audio: audioBase64 });
  const responseAudio = extractAudio(raw);
  if (responseAudio) {
    await saveAudio(responseAudio, 'received');
  }
  const transcript = responseAudio
    ? await stt(responseAudio)
    : String(raw.message ?? raw.text ?? JSON.stringify(raw));
  console.log('[phonecall] Operator:', transcript);
  return { transcript, raw };
};
