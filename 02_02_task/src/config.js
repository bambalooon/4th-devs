import {resolveModelForProvider} from "../../config.js";

export const api = {
  model: resolveModelForProvider("gpt-5.2"),
  visionModel: resolveModelForProvider("google/gemini-3-flash-preview"),
  maxOutputTokens: 16384,
  instructions: ``
};
