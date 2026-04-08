/**
 * Hybrid search: FTS5 (BM25) + sqlite-vec (cosine distance), combined with Reciprocal Rank Fusion.
 */

import {embed} from "./embeddings.js";
import log from "../helpers/logger.js";

const RRF_K = 60; // Reciprocal Rank Fusion constant

const toVecBuffer = (arr) => {
  const f32 = new Float32Array(arr);
  return Buffer.from(f32.buffer);
};

/**
 * Sanitize a query string for FTS5 MATCH syntax.
 * Strips special characters and joins terms with OR for broad matching.
 */
const toFtsQuery = (query) => {
  const terms = query
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 1);

  if (!terms.length) return null;
  return terms.map((t) => `"${t}"`).join(" OR ");
};

/**
 * Extract unique matched terms from FTS5 highlight() output.
 */
const extractMatchedTerms = (highlighted) => {
  const matches = [...highlighted.matchAll(/«([^»]+)»/g)];
  return [...new Set(matches.map((m) => m[1].toLowerCase()))];
};

/**
 * Full-text search using FTS5 with BM25 ranking.
 * Uses highlight() to identify which keywords triggered each match.
 */
export const searchFts = (db, query, limit = 10) => {
  const ftsQuery = toFtsQuery(query);
  if (!ftsQuery) return [];

  try {
    const rows = db
      .prepare(
        `SELECT l.id, l.content, l.level, l.timestamp,
                rank AS fts_score,
                highlight(logs_fts, 0, '«', '»') AS highlighted
         FROM logs_fts
         JOIN logs l ON l.id = logs_fts.rowid
         WHERE logs_fts MATCH ?
         ORDER BY rank
         LIMIT ?`
      )
      .all(ftsQuery, limit);

    return rows.map(({ highlighted, ...rest }) => ({
      ...rest,
      matched_terms: extractMatchedTerms(highlighted),
    }));
  } catch {
    return [];
  }
};

/**
 * Vector similarity search using sqlite-vec.
 */
export const searchVector = (db, queryEmbedding, limit = 10) => {
  const rows = db
    .prepare(
      `SELECT item_code, distance
       FROM item_vec
       WHERE embedding MATCH ?
       ORDER BY distance
       LIMIT ?`
    )
    .all(toVecBuffer(queryEmbedding), limit);

  if (!rows.length) return [];

  const codes = rows.map((r) => r.item_code);
  const placeholders = codes.map(() => "?").join(",");

  const items = db
    .prepare(
      `SELECT code, name
       FROM item
       WHERE code IN (${placeholders})`
    )
    .all(...codes);

  const itemsMap = new Map(items.map((l) => [l.code, l]));

  return rows
    .map((r) => ({ ...itemsMap.get(r.item_code), vec_distance: r.distance }))
    .filter(Boolean);
};

/**
 * Hybrid search: runs FTS5 + vector search with separate queries, merges with RRF.
 *
 * @param {object} db - SQLite database
 * @param {{ keywords: string, semantic: string }} query - Separate queries for each search type
 * @param {number} limit - Max results
 */
export const hybridSearch = async (db, { keywords, semantic }, limit = 5) => {
  const ftsLimit = limit * 3;

  log.searchHeader(keywords, semantic);

  // FTS runs first — synchronous, always available
  const ftsResults = searchFts(db, keywords, ftsLimit);
  log.searchFts(ftsResults);

  // Vector search — may fail (API issues), degrade gracefully to FTS-only
  let vecResults = [];
  try {
    const [queryEmbedding] = await embed(semantic);
    vecResults = searchVector(db, queryEmbedding, ftsLimit);
  } catch (err) {
    log.warn(`Semantic search unavailable: ${err.message}`);
  }
  log.searchVec(vecResults);

  // Build RRF scores
  const scores = new Map();

  const upsert = (id, data) => {
    if (!scores.has(id)) scores.set(id, { ...data, rrf: 0 });
    return scores.get(id);
  };

  ftsResults.forEach((r, rank) => {
    const entry = upsert(r.id, r);
    entry.rrf += 1 / (RRF_K + rank + 1);
    entry.fts_rank = rank + 1;
  });

  vecResults.forEach((r, rank) => {
    const entry = upsert(r.id, r);
    entry.rrf += 1 / (RRF_K + rank + 1);
    entry.vec_rank = rank + 1;
    entry.vec_distance = r.vec_distance;
  });

  const merged = [...scores.values()]
    .sort((a, b) => b.rrf - a.rrf)
    .slice(0, limit);

  log.searchRrf(merged);

  return merged.map(({ rrf, fts_score, ...rest }) => rest);
};

export const search = (db, queryCondition, orderBy = "", limit = 5) => {
  try {
    return db
        .prepare(
            `SELECT id, timestamp, level, content FROM item WHERE ${queryCondition} ${orderBy} LIMIT ?`
        )
        .all(limit);
  } catch {
    return [];
  }
};

export const count = (db, queryCondition) => {
  try {
    return db
        .prepare(
            `SELECT COUNT(1) FROM logs WHERE ${queryCondition}`
        ).get();
  } catch {
    return -1;
  }
};
