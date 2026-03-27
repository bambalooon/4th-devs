/**
 * Workspace indexer.
 * Reads text files from a directory, chunks them, generates embeddings,
 * and inserts into SQLite (documents + chunks + FTS5 + vec0).
 */

import { readdir, readFile, mkdir } from "fs/promises";
import { join } from "path";
import { createHash } from "crypto";
import { chunkBySeparators } from "./chunking.js";
import { embed } from "./embeddings.js";
import log from "../helpers/logger.js";

const BATCH_SIZE = 20;
const SUPPORTED_EXT = new Set([".md", ".txt"]);

const hashContent = (content) =>
  createHash("sha256").update(content).digest("hex");

const toVecBuffer = (arr) => {
  const f32 = new Float32Array(arr);
  return Buffer.from(f32.buffer);
};

/**
 * Remove all indexed data for a document (vec, chunks/fts, document row).
 */
const removeDocument = (db, docId) => {
  db.prepare(
    "DELETE FROM chunks_vec WHERE chunk_id IN (SELECT id FROM chunks WHERE document_id = ?)"
  ).run(docId);
  db.prepare("DELETE FROM chunks WHERE document_id = ?").run(docId);
  db.prepare("DELETE FROM documents WHERE id = ?").run(docId);
};

/**
 * Index a single file: chunk → embed → insert.
 */
export const indexFile = async (db, filePath, fileName) => {
  console.log(typeof(await readFile(filePath, "utf-8")));
  const lines = await readFile(filePath, "utf-8").then(content => content.split('\n'));

  // 2. Insert log (triggers populate FTS5 automatically)
  const insertLog = db
      .prepare("INSERT INTO logs (timestamp, level, content) VALUES (?, ?, ?)");

  let logIds = lines.map(line => line.trim()).map(line => {
    const match = line.match(/^\[([^\]]+)\] \[([^\]]+)\] (.+)$/);
    const [, timestamp, level, content] = match;
    return BigInt(insertLog.run(timestamp, level, content).lastInsertRowid);
  });

  // // 4. Generate embeddings in batches
  // const contents = chunks.map((c) => c.content);
  // const embeddings = [];
  //
  // for (let i = 0; i < contents.length; i += BATCH_SIZE) {
  //   const batch = contents.slice(i, i + BATCH_SIZE);
  //   const batchEmbeddings = await embed(batch);
  //   embeddings.push(...batchEmbeddings);
  //   process.stdout.write(`  embeddings: ${embeddings.length}/${contents.length}\r`);
  // }
  // if (contents.length > BATCH_SIZE) console.log();
  //
  // // 5. Insert vectors
  // const insertVec = db.prepare(
  //   "INSERT INTO chunks_vec (chunk_id, embedding) VALUES (?, ?)"
  // );
  //
  // for (let i = 0; i < chunkIds.length; i++) {
  //   insertVec.run(chunkIds[i], toVecBuffer(embeddings[i]));
  // }
  //
  // log.success(`Indexed ${fileName}: ${chunks.length} chunks`);
};
