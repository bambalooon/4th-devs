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
import sharp from "sharp";

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
        }
      },
      required: ["image_url"],
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
  }
];

const toBlackAndWhiteBase64 = async (imageBase64) => {
  const buffer = Buffer.from(imageBase64, "base64");
  const bwBuffer = await sharp(buffer).grayscale().threshold(128).toBuffer();
  return bwBuffer.toString("base64");
};

const cropImage = async (imageBase64, { left, top, width, height }) => {
  const buffer = Buffer.from(imageBase64, "base64");
  const sliced = await sharp(buffer)
      .extract({ left, top, width, height })
      .toBuffer();
  return sliced.toString("base64");
};

const transformImage = async (imageBase64, mimeType) => {
  const size = { width: 290, height: 290 };
  const croppedBWImage = await cropImage(imageBase64, { left: 236, top: 98, ...size }).then(img => toBlackAndWhiteBase64(img));
  const currentBoard = [];
  const cellSize = { width: Math.floor(size.width / 3) - 4, height: Math.floor(size.height / 3) - 4 };
  for (let row = 0; row < 3; row++) {
    currentBoard.push([]);
    for (let col = 0; col < 3; col++) {
      currentBoard[row][col] = await cropImage(croppedBWImage, {
        left: col * cellSize.width + 6,
        top: row * cellSize.height + 5,
        width: cellSize.width,
        height: cellSize.height
      });
    }
  }

  const visionImages = [];
  currentBoard.flatMap(row => row).forEach((cell) => visionImages.push({ imageBase64: cell, mimeType: mimeType }));
  return visionImages;
}

const VISION_QUERY = `
Analyze all 9 images and create ASCII representation of them.
Thick line should be changed to X, empty field or thin line should be left as space.
Below I've shown where X can occur - some of this fields will hold X and some will be empty (space):
 X 
XXX
 X 
You should return 3x3 string for each image.
`;

/**
 * Native tool handlers.
 */
export const nativeHandlers = {
  async understand_image({ image_url }) {
    log.vision(image_url, VISION_QUERY);

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
        images: await transformImage(imageBase64, mimeType),
        question: VISION_QUERY
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
