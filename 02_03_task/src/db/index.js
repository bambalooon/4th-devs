/**
 * SQLite database with FTS5 (full-text search) and sqlite-vec (vector search).
 */

import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { mkdirSync } from "fs";
import { dirname } from "path";
import log from "../helpers/logger.js";

const EMBEDDING_DIM = 1536; // openai/text-embedding-3-small

export const initDb = (dbPath = "data/hybrid.db") => {
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  sqliteVec.load(db);

  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  const version = db.prepare("SELECT vec_version() AS v").get();
  log.info(`sqlite-vec ${version.v}`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      level TEXT NOT NULL CHECK (level IN ('INFO', 'WARN', 'ERRO', 'CRIT')),
      content TEXT NOT NULL
    );
    
    -- FTS5 external-content table backed by logs
    CREATE VIRTUAL TABLE IF NOT EXISTS logs_fts USING fts5(
      content,
      content='logs',
      content_rowid='id'
    );

    -- Triggers to keep FTS5 in sync with chunks table
    CREATE TRIGGER IF NOT EXISTS log_ai AFTER INSERT ON logs BEGIN
      INSERT INTO logs_fts(rowid, content) VALUES (new.id, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS log_ad AFTER DELETE ON logs BEGIN
      INSERT INTO logs_fts(logs_fts, rowid, content) VALUES ('delete', old.id, old.content);
    END;

    CREATE TRIGGER IF NOT EXISTS log_au AFTER UPDATE ON logs BEGIN
      INSERT INTO logs_fts(logs_fts, rowid, content) VALUES ('delete', old.id, old.content);
      INSERT INTO logs_fts(rowid, content) VALUES (new.id, new.content);
    END;

    -- sqlite-vec virtual table for vector similarity search
    CREATE VIRTUAL TABLE IF NOT EXISTS logs_vec USING vec0(
      log_id INTEGER PRIMARY KEY,
      embedding float[${EMBEDDING_DIM}]
    );
  `);

  return db;
};
