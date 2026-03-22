import {AI_DEVS_API_KEY} from "../../../config.js";

/**
 * Native tool definitions in OpenAI function format.
 */
export const nativeTools = [
  {
    type: "function",
    name: "categorize",
    description: "Call Railway API with data object",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Prompt..."
        }
      },
      required: ["prompt"],
      additionalProperties: false
    },
    strict: true
  },
];

/**
 * Native tool handlers.
 */
export const nativeHandlers = {
  async categorize(prompt) {
    try {
      const request = {
        apikey: AI_DEVS_API_KEY,
        task: "categorize",
        answer: {
          prompt: prompt
        }
      }
      console.log("API request: ", request);

      const response = await fetch("https://hub.ag3nts.org/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        return {
          isError: true,
          message: `Categorize call failed with response status ${response.status}`
        }
      }

      const result = response.json();
      console.log("API call result: ", result);
      return result;
    } catch (error) {
      return {
        message: error.message,
        isError: true
      };
    }
  }
};
