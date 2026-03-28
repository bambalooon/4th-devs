/**
 * Workspace indexer.
 * Reads text files from a directory, chunks them, generates embeddings,
 * and inserts into SQLite (documents + chunks + FTS5 + vec0).
 */

import {readFile} from "fs/promises";
import {embed} from "./embeddings.js";
import log from "../helpers/logger.js";

const BATCH_SIZE = 20;

const toVecBuffer = (arr) => {
  const f32 = new Float32Array(arr);
  return Buffer.from(f32.buffer);
};

/**
 * Index a single logs file: chunk → embed → insert.
 */
export const indexLogsFile = async (db, filePath, fileName) => {
  const lines = await readFile(filePath, "utf-8")
      .then(content => content.split('\n'))
      .then(lines => lines.map(line => line.trim()));

  // 2. Insert log (triggers populate FTS5 automatically)
  const insertLog = db
      .prepare("INSERT INTO logs (timestamp, level, content) VALUES (?, ?, ?)");

  const logEntries = lines.map(line => {
    const match = line.match(/^\[([^\]]+)\] \[([^\]]+)\] (.+)$/);
    const [, timestamp, level, content] = match;
    const logId = BigInt(insertLog.run(timestamp, level, content).lastInsertRowid);
    return { id: logId, content: content };
  });

  // 4. Generate embeddings in batches
  const contents = logEntries.map((l) => l.content);
  const embeddings = [];

  for (let i = 0; i < contents.length; i += BATCH_SIZE) {
    const batch = contents.slice(i, i + BATCH_SIZE);
    const batchEmbeddings = await embed(batch);
    embeddings.push(...batchEmbeddings);
    process.stdout.write(`  embeddings: ${embeddings.length}/${contents.length}\r`);
  }
  if (contents.length > BATCH_SIZE) console.log();

  // 5. Insert vectors
  const insertVec = db.prepare(
    "INSERT INTO logs_vec (log_id, embedding) VALUES (?, ?)"
  );

  for (let i = 0; i < logEntries.length; i++) {
    insertVec.run(logEntries[i].id, toVecBuffer(embeddings[i]));
  }

  log.success(`Indexed ${fileName}: ${logEntries.length} logs`);
};
