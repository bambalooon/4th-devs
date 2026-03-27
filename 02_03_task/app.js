/**
 * Hybrid RAG Agent
 *
 * Indexes workspace text files into SQLite (FTS5 + sqlite-vec),
 * then runs an interactive agent that searches via hybrid retrieval.
 */

import {initDb} from "./src/db/index.js";
import {createTools} from "./src/agent/tools.js";
import {createReadline, runRepl} from "./src/repl.js";
import {onShutdown} from "./src/helpers/shutdown.js";
import {logStats} from "./src/helpers/stats.js";
import log from "./src/helpers/logger.js";
import {AI_DEVS_API_KEY} from "../config.js";
import downloadFile from "./src/helpers/download.js";
import {indexFile} from "./src/db/indexer.js";

const main = async () => {
  log.box("Hybrid RAG Agent");

  // 1. Database
  log.start("Initializing database...");
  const db = initDb();
  log.success("Database ready");

  // 2. Download failure.log
  await downloadFile(`https://hub.ag3nts.org/data/${AI_DEVS_API_KEY}/failure.log`, './workspace');

  // 2. Index workspace
  log.start("Indexing workspace...");
  await indexFile(db, './workspace/failure.log', 'failure.log');
  log.success("Indexing complete");

  // 3. Agent tools
  const tools = createTools(db);

  // 4. REPL
  const rl = createReadline();

  const shutdown = onShutdown(async () => {
    logStats();
    rl?.close();
    db.close();
  });

  await runRepl({ tools, rl, db });
  await shutdown();
};

main().catch((err) => {
  log.error("Startup error", err.message);
  process.exit(1);
});
