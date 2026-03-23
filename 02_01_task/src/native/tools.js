import {AI_DEVS_API_KEY} from "../../../config.js";

/**
 * Native tool definitions in OpenAI function format.
 */
export const nativeTools = [
  {
    type: "function",
    name: "categorize",
    description: "Call categorize API with prompt",
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
  {
    type: "function",
    name: "reset_and_get_new_items_to_categorize",
    description: "Reset items categorization after failure and get new items for categorization",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false
    },
    strict: true
  }
];

const csvToObjects = (csvContent) => {
  const [header, ...rows] = csvContent.trim().split("\n");
  const keys = header.split(",");

  return rows.map(row => {
    // handle quoted fields containing commas
    const values = row.match(/(".*?"|[^,]+)(?=,|$)/g)
        .map(v => v.replace(/^"|"$/g, ""));
    return Object.fromEntries(keys.map((key, i) => [key, values[i]]));
  });
};

/**
 * Native tool handlers.
 */
export const nativeHandlers = {
  async categorize({ prompt } = {}) {
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

      const result = await response.json();
      console.log("API call result: ", result);
      return result;
    } catch (error) {
      return {
        message: error.message,
        isError: true
      };
    }
  },
  async reset_and_get_new_items_to_categorize() {
    await this.categorize({ prompt: "reset" });

    const response = await fetch(`https://hub.ag3nts.org/data/${AI_DEVS_API_KEY}/categorize.csv`);

    if (!response.ok) {
      return {
        isError: true,
        message: `Failed to download new categorize.csv, response status: ${response.status}, text: ${response.statusText}`
      }
    }

    const csvContent = await response.text();
    return csvToObjects(csvContent);
  }
};

export const executeNativeTool = async (name, args) => {
  const handler = nativeHandlers[name];
  if (!handler) throw new Error(`Unknown native tool: ${name}`);
  return handler.call(nativeHandlers, args);
};
