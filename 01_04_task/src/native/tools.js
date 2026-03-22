/**
 * Native tool: understand_image
 * 
 * Analyzes images using OpenAI Vision API.
 * This is a native tool (not MCP) that allows the agent to ask questions about images.
 */

import {readFile, writeFile} from "fs/promises";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { vision } from "./vision.js";
import log from "../helpers/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "../..");

/**
 * MIME type mapping for common image formats.
 */
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
        image_path: {
          type: "string",
          description: "Path to the image file relative to the workspace root (e.g., './docs/documentation.jpg')"
        },
        question: {
          type: "string",
          description: "Question to ask about the image (e.g., 'Who is in this image?', 'Describe the person's appearance')"
        }
      },
      required: ["image_path", "question"],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: "function",
    name: "download_file",
    description: "Download file from URL to destination relative to workspace directory",
    parameters: {
      type: "object",
      properties: {
        source_file_url: {
          type: "string",
          description: "URL of a file to download')"
        },
        target_file_path: {
          type: "string",
          description: "Target path of the file relative to the workspace root (e.g., './docs/documentation.jpg')"
        }
      },
      required: ["source_file_url", "target_file_path"],
      additionalProperties: false
    },
    strict: true
  },
];

/**
 * Native tool handlers.
 */
export const nativeHandlers = {
  async understand_image({ image_path, question }) {
    const fullPath = join(PROJECT_ROOT, 'workspace', image_path);
    log.vision(image_path, question);

    try {
      const imageBuffer = await readFile(fullPath);
      const imageBase64 = imageBuffer.toString("base64");
      const mimeType = getMimeType(image_path);

      const answer = await vision({
        imageBase64,
        mimeType,
        question
      });

      log.visionResult(answer);
      return { answer, image_path };
    } catch (error) {
      log.error("Vision error", error.message);
      return { error: error.message, image_path };
    }
  },
  async download_file({ source_file_url, target_file_path}) {
    if (target_file_path.includes("..")) {
      return {
        message: "Invalid target_file_path: path traversal is not allowed",
        isError: true
      }
    }
    try {
      const response = await fetch(source_file_url);
      if (!response.ok) {
        return {
          message: `File download failed with response status code: ${response.status}`,
          isError: true
        }
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      await writeFile(join(PROJECT_ROOT, '/workspace/', target_file_path), buffer);
      return {
        success: true,
        file_path: join('./workspace/', target_file_path)
      };
    } catch (error) {
      return {
        message: error.message,
        isError: true
      };
    }
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
