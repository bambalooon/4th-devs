import { AI_DEVS_API_KEY } from '../../config.js';

const TASK_NAME = 'foodwarehouse';
const API_URL = 'https://hub.ag3nts.org/verify';

export type ApiResponse = Record<string, unknown>;

const sendRequest = async (answer: unknown): Promise<ApiResponse> => {
  const body = JSON.stringify({ apikey: AI_DEVS_API_KEY, task: TASK_NAME, answer });
  console.log('[task] →', JSON.stringify(answer).slice(0, 400));
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const result = await response.json() as ApiResponse;
  console.log('[task] ←', JSON.stringify(result).slice(0, 600));
  return result;
};

export const dbQuery = (query: string): Promise<ApiResponse> =>
  sendRequest({ tool: 'database', query });

export const ordersGet = (id?: string): Promise<ApiResponse> =>
  sendRequest({ tool: 'orders', action: 'get', ...(id ? { id } : {}) });

export const ordersCreate = (
  title: string,
  creatorID: number,
  destination: string | number,
  signature: string
): Promise<ApiResponse> =>
  sendRequest({ tool: 'orders', action: 'create', title, creatorID, destination, signature });

export const ordersAppend = (
  id: string,
  items: Record<string, number>
): Promise<ApiResponse> =>
  sendRequest({ tool: 'orders', action: 'append', id, items });

export const generateSignature = (
  login: string,
  birthday: string,
  destination: string | number
): Promise<ApiResponse> =>
  sendRequest({ tool: 'signatureGenerator', action: 'generate', login, birthday, destination });

export const taskReset = (): Promise<ApiResponse> =>
  sendRequest({ tool: 'reset' });

export const taskDone = (): Promise<ApiResponse> =>
  sendRequest({ tool: 'done' });
