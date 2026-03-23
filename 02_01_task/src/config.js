import { resolveModelForProvider } from "../../config.js";

export const api = {
  model: resolveModelForProvider("gpt-5.4"),
  maxOutputTokens: 16384,
  instructions: ""
};
