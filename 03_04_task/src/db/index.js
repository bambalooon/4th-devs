/**
 * SQLite database with FTS5 (full-text search) and sqlite-vec (vector search).
 */

import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import {existsSync, mkdirSync, rmSync} from "fs";
import { dirname } from "path";
import log from "../helpers/logger.js";

const EMBEDDING_DIM = 1536; // openai/text-embedding-3-small
const DB_PATH = "data/hybrid.db";

export const removeDb = () => {
  if (existsSync(DB_PATH)) {
    rmSync(DB_PATH);
  }
}

export const initDb = () => {
  mkdirSync(dirname(DB_PATH), { recursive: true });

  const db = new Database(DB_PATH);
  sqliteVec.load(db);

  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  const version = db.prepare("SELECT vec_version() AS v").get();
  log.info(`sqlite-vec ${version.v}`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS city (
      code TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS item (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS connection (
      item TEXT NOT NULL REFERENCES item(code),
      city TEXT NOT NULL REFERENCES city(code),
      PRIMARY KEY (item, city)
    );
    
    -- FTS5 external-content table backed by item
    CREATE VIRTUAL TABLE IF NOT EXISTS item_fts USING fts5(
      name,
      content='item',
      content_rowid='rowid'
    );

    -- Triggers to keep FTS5 in sync with item table
    CREATE TRIGGER IF NOT EXISTS item_ai AFTER INSERT ON item BEGIN
      INSERT INTO item_fts(rowid, name) VALUES (new.rowid, new.name);
    END;

    CREATE TRIGGER IF NOT EXISTS item_ad AFTER DELETE ON item BEGIN
      INSERT INTO item_fts(item_fts, rowid, name) VALUES ('delete', old.rowid, old.name);
    END;

    CREATE TRIGGER IF NOT EXISTS item_au AFTER UPDATE ON item BEGIN
      INSERT INTO item_fts(item_fts, rowid, name) VALUES ('delete', old.rowid, old.name);
      INSERT INTO item_fts(rowid, name) VALUES (new.rowid, new.name);
    END;

    -- sqlite-vec virtual table for vector similarity search
    CREATE VIRTUAL TABLE IF NOT EXISTS item_vec USING vec0(
      item_code TEXT PRIMARY KEY,
      embedding float[${EMBEDDING_DIM}]
    );
  `);

  return db;
};
