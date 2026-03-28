import {resolveModelForProvider} from "../../config.js";
import {readFileSync} from "fs";
import {resolve} from "path";

export const api = {
  model: resolveModelForProvider("gpt-5.2"),
  maxOutputTokens: 16384,
  reasoning: { effort: "medium", summary: "auto" },
  instructions: readFileSync(resolve(import.meta.dirname, "agent", "prompt.md"), "utf-8"),
};
