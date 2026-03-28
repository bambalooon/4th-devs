/**
 * Hybrid RAG Agent
 *
 * Indexes workspace text files into SQLite (FTS5 + sqlite-vec),
 * then runs an interactive agent that searches via hybrid retrieval.
 */

import {initDb} from "./src/db/index.js";
import {createTools} from "./src/agent/tools.js";
import {onShutdown} from "./src/helpers/shutdown.js";
import {logStats} from "./src/helpers/stats.js";
import log from "./src/helpers/logger.js";
import {run} from "./src/agent/index.js";

const main = async () => {
  log.box("Hybrid RAG Agent");

  // 1. Database
  log.start("Initializing database...");
  const db = initDb();
  log.success("Database ready");

  // 2. Agent tools
  const tools = createTools(db);

  const shutdown = onShutdown(async () => {
    logStats();
    db.close();
  });

  try {
    const result = await run('', { tools });
    console.log(`\nAssistant: ${result.response}\n`);
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
