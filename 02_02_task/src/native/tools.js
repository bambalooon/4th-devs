/**
 * Native tool: understand_image
 * 
 * Analyzes images using OpenAI Vision API.
 * This is a native tool (not MCP) that allows the agent to ask questions about images.
 */

import {extname} from "path";
import {vision} from "./vision.js";
import log from "../helpers/logger.js";
import {AI_DEVS_API_KEY} from "../../../config.js";

const getMimeType = (filepath) => {
  const ext = extname(filepath).toLowerCase();
  const mimeTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp"
  };
  return mimeTypes[ext] || "image/jpeg";
};

/**
 * Native tool definitions in OpenAI function format.
 */
export const nativeTools = [
  {
    type: "function",
    name: "understand_image",
    description: "Analyze an image and answer questions about it. Use this to identify people, objects, scenes, or any visual content in images.",
    parameters: {
      type: "object",
      properties: {
        image_url: {
          type: "string",
          description: "URL to the image to analyze"
        },
        question: {
          type: "string",
          description: "Question to ask about the image (e.g., 'Who is in this image?', 'Describe the person's appearance')"
        }
      },
      required: ["image_url", "question"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "rotate",
    description: "Rotate specified board field",
    parameters: {
      type: "object",
      properties: {
        row: {
          type: "string",
          enum: ["1", "2", "3"],
          description: "Board field row number"
        },
        column: {
          type: "string",
          enum: ["1", "2", "3"],
          description: "Board field column number"
        }
      },
      required: ["row", "column"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "reset",
    description: "Reset board to initial state",
    parameters: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false
    },
    strict: true
  }
];

/**
 * Native tool handlers.
 */
export const nativeHandlers = {
  async understand_image({ image_url, question }) {
    log.vision(image_url, question);

    try {
      const response = await fetch(image_url);
      if (!response.ok) {
        return {
          isError: true,
          message: `Failed to download image: ${response.status} ${response.statusText}`
        }
      }

      const buffer = await response.arrayBuffer();
      const imageBase64 = Buffer.from(buffer).toString("base64");
      const mimeType = getMimeType(image_url);

      const answer = await vision({
        images: [ { base64: imageBase64, mimeType } ],
        question
      });

      log.visionResult(answer);
      return { answer, image_url };
    } catch (error) {
      log.error("Vision error", error.message);
      return { error: error.message, image_url };
    }
  },
  async rotate({ row, column }){
    const request = {
      apikey: AI_DEVS_API_KEY,
      task: "electricity",
      answer: {
        rotate: `${row}x${column}`,
      }
    }
    console.log(request);
    const response = await fetch("https://hub.ag3nts.org/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    });

    const data = await response.json();
    console.log(data);
    return data;
  },
  async reset(){
    const response = await fetch(`https://hub.ag3nts.org/data/${AI_DEVS_API_KEY}/electricity.png?reset=1`);
    if (response.ok) {
      return {
        message: "Board was successfully reset"
      }
    } else {
      return {
        isError: true,
        message: "Board reset failed"
      }
    }
  },
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
