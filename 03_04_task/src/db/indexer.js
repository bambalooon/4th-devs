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

const TABLE_COLUMNS = {
  city: ["name", "code"],
  item: ["name", "code"],
  connection: ["item", "city"]
}

/**
 * Index a single logs file: chunk → embed → insert.
 */
export const indexCsv = async (db, filePath, tableName) => {
  const lines = await readFile(filePath, "utf-8")
      .then(content => content.split('\n'))
      .then(lines => lines.map(line => line.trim()));

  // 2. Insert into table (if item triggers populate FTS5 automatically)
  const insertTable = db
      .prepare(`INSERT INTO ${tableName} (${TABLE_COLUMNS[tableName].join(', ')}) VALUES (?, ?)`);

  const entries = lines.map(line => {
    const [name, code] = line.split(','); // name, code doesn't match exactly for connection table, but doesn't matter
    const rowId = BigInt(insertTable.run(name, code).lastInsertRowid);
    return { code: code, name: name, rowId: rowId };
  });

  if (tableName === "item") {
    // 4. Generate embeddings in batches
    const names = entries.map((l) => l.name);
    const embeddings = [];

    for (let i = 0; i < names.length; i += BATCH_SIZE) {
      const batch = names.slice(i, i + BATCH_SIZE);
      const batchEmbeddings = await embed(batch);
      embeddings.push(...batchEmbeddings);
      process.stdout.write(`  embeddings: ${embeddings.length}/${names.length}\r`);
    }
    if (names.length > BATCH_SIZE) console.log();

    // 5. Insert vectors
    const insertVec = db.prepare(
        "INSERT INTO item_vec (item_code, embedding) VALUES (?, ?)"
    );

    for (let i = 0; i < entries.length; i++) {
      insertVec.run(entries[i].code, toVecBuffer(embeddings[i]));
    }
  }

  log.success(`Indexed ${filePath}: ${entries.length} logs`);
};
