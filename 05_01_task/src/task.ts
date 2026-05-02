// @ts-expect-error — root config is untyped JS
import { AI_DEVS_API_KEY } from '../../config.js';
import { z } from 'zod';

const TASK_NAME = 'radiomonitoring';
const API_URL = 'https://hub.ag3nts.org/verify';

export type ApiResponse = Record<string, unknown>;

const sendRequest = async (answer: unknown): Promise<ApiResponse> => {
  const body = JSON.stringify({ apikey: AI_DEVS_API_KEY, task: TASK_NAME, answer });
  console.log('[radio] →', JSON.stringify(answer).slice(0, 200));
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const result = await response.json() as ApiResponse;
  // Log without attachment to keep output readable
  const logResult = { ...result };
  if (typeof logResult.attachment === 'string') {
    logResult.attachment = `<base64 ${logResult.attachment.length} chars>`;
  }
  console.log('[radio] ←', JSON.stringify(logResult).slice(0, 400));
  return result;
};

export const radioStart = (): Promise<ApiResponse> =>
  sendRequest({ action: 'start' });

export const radioListen = (): Promise<ApiResponse> =>
  sendRequest({ action: 'listen' });

export type TransmitReport = {
  cityName: string;
  cityArea: string;    // "12.34" — exactly 2 decimal places
  warehousesCount: number;
  phoneNumber: string;
};

export const radioTransmit = (report: TransmitReport): Promise<ApiResponse> =>
  sendRequest({ action: 'transmit', ...report });

/** Zod schema for the final synthesized report */
export const ReportSchema = z.object({
  cityName: z.string().describe('Real city name behind codename "Syjon"'),
  cityArea: z.string().regex(/^\d+\.\d{2}$/, 'Must be exactly 2 decimal places, e.g. "123.45"'),
  warehousesCount: z.number().int().nonnegative(),
  phoneNumber: z.string().describe('Contact phone number as string'),
});

export type Report = z.infer<typeof ReportSchema>;

