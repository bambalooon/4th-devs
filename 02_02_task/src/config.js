import {resolveModelForProvider} from "../../config.js";

export const api = {
  model: resolveModelForProvider("anthropic/claude-sonnet-4.6"),
  visionModel: resolveModelForProvider("google/gemini-3-flash-preview"),
  maxOutputTokens: 16384,
  instructions: ``
};
