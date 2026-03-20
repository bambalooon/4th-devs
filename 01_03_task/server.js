import http from "http";
import { z } from "zod";
import {logAnswer, logQuestion} from "../01_02_tools/helper.js";
import {chat} from "./ai.js";

const PORT = 3000;

const RequestSchema = z.object({
  sessionID: z.string().min(1),
  msg: z.string().min(1),
});

const history = new Map();

const server = http.createServer((req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method Not Allowed. Use POST." }));
    return;
  }

  let body = "";

  req.on("data", (chunk) => {
    body += chunk.toString();
  });

  req.on("end", async () => {
    let parsed;

    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON body" }));
      return;
    }

    const result = RequestSchema.safeParse(parsed);

    if (!result.success) {
      res.writeHead(422, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Validation failed",
          issues: result.error.issues,
        })
      );
      return;
    }

    const messages = history.get(result.data.sessionID) ?? [];
    const newMessage = { role: "user", content: result.data.msg };
    messages.push(newMessage);

    logQuestion(`[${result.data.sessionID}] ${result.data.msg}`);
    const answer = await chat(messages);
    logAnswer(`[${result.data.sessionID}] ${answer}`);
    messages.push({ role: "assistant", content: answer });
    history.set(result.data.sessionID, messages);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        msg: answer
      })
    );
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

