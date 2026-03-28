import {resolveModelForProvider} from "../../config.js";
import {readFileSync} from "fs";
import {resolve} from "path";

export const api = {
  model: resolveModelForProvider("gpt-4.1-mini"),
  maxOutputTokens: 16384,
  reasoning: { effort: "medium", summary: "auto" },
  instructions: readFileSync(resolve(import.meta.dirname, "agent", "prompt_sonnet.md"), "utf-8"),
};
