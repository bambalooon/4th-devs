import { AI_DEVS_API_KEY } from '../../config.js';

const TASK_NAME = 'filesystem';
const API_URL = 'https://hub.ag3nts.org/verify';

export interface FilesystemAction {
  action: string;
  path?: string;
  content?: string;
}

const sendRequest = async (answer: unknown): Promise<unknown> => {
  const body = JSON.stringify({ apikey: AI_DEVS_API_KEY, task: TASK_NAME, answer });
  console.log('[task] →', body.slice(0, 200));
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const result = await response.json();
  console.log('[task] ←', JSON.stringify(result));
  return result;
};

export const executeFilesystemBatch = (actions: FilesystemAction[]): Promise<unknown> => {
  console.log(`[task] Sending batch of ${actions.length} actions...`);
  return sendRequest(actions);
};

export const executeFilesystemDone = (): Promise<unknown> => {
  console.log('[task] Calling done...');
  return sendRequest({ action: 'done' });
};
