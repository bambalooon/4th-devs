import {resolveModelForProvider} from "../../config.js";

export const api = {
  model: resolveModelForProvider("gpt-5-mini"),
  maxOutputTokens: 16384,
  reasoning: { effort: "medium", summary: "auto" },
  instructions: ``,
};
