import {
  AI_API_KEY,
  buildResponsesRequest,
  EXTRA_API_HEADERS,
  resolveModelForProvider,
  RESPONSES_API_ENDPOINT
} from "../config.js";
import {buildNextConversation, getFinalText, getToolCalls} from "../01_02_tools/helper.js";

const model = resolveModelForProvider("gpt-5-mini");

const MAX_TOOL_STEPS = 5;

export const createAgent = ({ tools, handlers }) => ({
  async requestResponse(input){
    const webSearch = true;
    const body = buildResponsesRequest({
      model,
      input,
      tools,
      webSearch,
    });

    const response = await fetch(RESPONSES_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_API_KEY}`,
        ...EXTRA_API_HEADERS,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message ?? `Request failed (${response.status})`);
    return data;
  },

  async chat(conversation) {
    let currentConversation = conversation;
    let stepsRemaining = MAX_TOOL_STEPS;

    while (stepsRemaining > 0) {
      stepsRemaining -= 1;

      const response = await this.requestResponse(currentConversation);
      const toolCalls = getToolCalls(response);

      if (toolCalls.length === 0) {
        console.log(`Loop run ${MAX_TOOL_STEPS - stepsRemaining} times`)
        return getFinalText(response);
      }

      currentConversation = await buildNextConversation(currentConversation, toolCalls, handlers);
    }

    throw new Error(`Tool calling did not finish within ${MAX_TOOL_STEPS} steps.`);
  }

});