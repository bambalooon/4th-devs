import http from "http";
import {z} from "zod";
import {hybridSearch, search} from "./src/db/search.js";
import log from "./src/helpers/logger.js";
import {initDb} from "./src/db/index.js";
import {onShutdown} from "./src/helpers/shutdown.js";
import {logStats} from "./src/helpers/stats.js";

const PORT = 57637;

const RequestSchema = z.object({
  params: z.string().min(1),
});

const main = async () => {
  log.box("Hybrid RAG Agent");

  log.start("Initializing database...");
  const db = initDb();
  log.success("Database ready");

  const shutdown = onShutdown(async () => {
    logStats();
    db.close();
  });

  const server = http.createServer((req, res) => {
    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method Not Allowed. Use POST." }));
      return;
    }

    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      let parsed;

      try {
        parsed = JSON.parse(body);
      } catch (err) {
        console.error(`Parse issue: ${JSON.stringify(err)}`)
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
        return;
      }

      const result = RequestSchema.safeParse(parsed);

      if (!result.success) {
        console.error(`Schema parse issue: ${JSON.stringify(err)}`)
        res.writeHead(422, { "Content-Type": "application/json" });
        res.end(
            JSON.stringify({
              error: "Validation failed",
              issues: result.error.issues,
            })
        );
        return;
      }

      try {
        const searchResult = await hybridSearch(db, {keywords: result.data.params, semantic: result.data.params});
        if (searchResult.length == 0) {
          console.error(`No items for ${result.data.params}`)
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
              JSON.stringify({
                msg: "Items matching criteria not found"
              })
          );
        }
        if (searchResult.length > 1) {
          console.error(`Too many items for ${result.data.params}: ${JSON.stringify(searchResult)}`)
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
              JSON.stringify({
                msg: "More than 1 item found for specified criteria. Try to be more specific."
              })
          );
        }
        console.info(`Items found for ${result.data.params}: ${JSON.stringify(searchResult[0])}`)
        const cityNames = search(db, searchResult[0].code).map(city => city.name);
        console.info(`Cities found for item ${searchResult[0].code}: ${JSON.stringify(cityNames)}`)
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
            JSON.stringify({
              cityNames: cityNames,
            })
        );
      } catch (err) {
        log.error("Error", err.message);
        es.writeHead(500, { "Content-Type": "application/json" });
        res.end(
            JSON.stringify({
              error: "Search failed",
              issues: err
            })
        );
      }
    });
  });

  server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

main().catch(console.error);
