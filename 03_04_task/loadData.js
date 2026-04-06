/**
 * Hybrid RAG Agent
 *
 * Indexes workspace text files into SQLite (FTS5 + sqlite-vec),
 * then runs an interactive agent that searches via hybrid retrieval.
 */

import {initDb, removeDb} from "./src/db/index.js";
import {onShutdown} from "./src/helpers/shutdown.js";
import {logStats} from "./src/helpers/stats.js";
import log from "./src/helpers/logger.js";
import {indexCsv} from "./src/db/indexer.js";

const main = async () => {
  log.box("Hybrid RAG Agent");

  log.start("Initializing database...");
  removeDb();
  const db = initDb();
  log.success("Database ready");

  // 3. Index workspace
  log.start("Indexing workspace...");
  await indexCsv(db, './workspace/data/cities.csv', 'city');
  await indexCsv(db, './workspace/data/items.csv', 'item');
  await indexCsv(db, './workspace/data/connections.csv', 'connection');
  log.success("Indexing complete");

  const shutdown = onShutdown(async () => {
    logStats();
    db.close();
  });

  await shutdown();
};

main().catch((err) => {
  log.error("Startup error", err.message);
  process.exit(1);
});
