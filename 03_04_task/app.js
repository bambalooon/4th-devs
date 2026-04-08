/**
 * Hybrid RAG Agent
 *
 * Indexes workspace text files into SQLite (FTS5 + sqlite-vec),
 * then runs an interactive agent that searches via hybrid retrieval.
 */

import {initDb} from "./src/db/index.js";
import {onShutdown} from "./src/helpers/shutdown.js";
import {logStats} from "./src/helpers/stats.js";
import log from "./src/helpers/logger.js";
import {hybridSearch} from "./src/db/search.js";

const main = async () => {
  log.box("Hybrid RAG Agent");

  log.start("Initializing database...");
  const db = initDb();
  log.success("Database ready");

  const shutdown = onShutdown(async () => {
    logStats();
    db.close();
  });

  try {
    console.log(hybridSearch(db, {keywords: "tranzystor TO-92", semantic: "tranzystor TO-92"}));
  } catch (err) {
    log.error("Error", err.message);
    console.log("");
  }
  await shutdown();
};

main().catch((err) => {
  log.error("Startup error", err.message);
  process.exit(1);
});
