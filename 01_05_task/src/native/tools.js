/**
 * Native tool: understand_image
 * 
 * Analyzes images using OpenAI Vision API.
 * This is a native tool (not MCP) that allows the agent to ask questions about images.
 */

import {AI_DEVS_API_KEY} from "../../../config.js";

/**
 * Native tool definitions in OpenAI function format.
 */
export const nativeTools = [
  {
    type: "function",
    name: "call_railway_api",
    description: "Call Railway API with data object",
    parameters: {
      type: "object",
      properties: {
        data: {
          type: "object",
          description: 'Data object with API instructions, e.g. { action: "help" }'
        }
      },
      required: ["data"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    name: "wait_for",
    description: "Wait for a specified number of seconds",
    parameters: {
      type: "object",
      properties: {
        seconds: {
          type: "number",
          description: 'Number of seconds to wait for'
        }
      },
      required: ["seconds"],
      additionalProperties: false
    },
    strict: true
  },
];

/**
 * Native tool handlers.
 */
export const nativeHandlers = {
  async call_railway_api({ data }) {
    try {
      const request = {
        apikey: AI_DEVS_API_KEY,
        task: "railway",
        answer: data
      }
      console.log("API request: ", request);

      const response = await fetch("https://hub.ag3nts.org/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request)
      });

      const result = {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        url: response.url,
        headers: Object.fromEntries(response.headers.entries()),
        body: JSON.stringify(await response.json()),
      }
      console.log("API call result: ", result);
      return result;
    } catch (error) {
      return {
        message: error.message,
        isError: true
      };
    }
  },
  wait_for: async ({ seconds }) => {
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    return { message: `Waited for ${seconds} seconds` };
  }
};

/**
 * Check if a tool is native (not MCP).
 */
export const isNativeTool = (name) => name in nativeHandlers;

/**
 * Execute a native tool.
 */
export const executeNativeTool = async (name, args) => {
  const handler = nativeHandlers[name];
  if (!handler) throw new Error(`Unknown native tool: ${name}`);
  return handler(args);
};
