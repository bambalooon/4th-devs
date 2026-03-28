/**
 * Native tools for the agent.
 * Provides a single hybrid search tool over the indexed document database.
 */

import {count, hybridSearch, search} from "../db/search.js";
import log from "../helpers/logger.js";
import {hub} from "../hub/hub.js";

const TOOLS = [
  {
    type: "function",
    name: "search",
    description:
        "Search the indexed knowledge base using hybrid search (full-text BM25 + semantic vector similarity). " +
        "Returns the most relevant logs with content, timestamp and log level. " +
        "Provide BOTH a keyword query for full-text search AND a natural language query for semantic search.",
    parameters: {
      type: "object",
      properties: {
        keywords: {
          type: "string",
          description:
              "Keywords for full-text search (BM25) — specific terms, names, and phrases that should appear in the text",
        },
        semantic: {
          type: "string",
          description:
              "Natural language query for semantic/vector search — a question or description of the concept you're looking for",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default 5, max 20)",
        },
      },
      required: ["keywords", "semantic"],
    },
    strict: false,
  },
  {
    type: "function",
    name: "select",
    description: "SQLite select query parameters",
    parameters: {
      type: "object",
      properties: {
        query_condition: {
          type: "string",
          description: "WHERE clause conditions, e.g. level='ERROR' AND content MATCH 'timeout'",
        },
        order_by: {
          type: "string",
          description: "ORDER BY clause, e.g. timestamp DESC",
        },
        limit: {
          type: "number",
          description: "LIMIT clause, e.g. 10",
        },
      },
      required: ["query_condition"],
    },
    strict: false,
  },
  {
    type: "function",
    name: "count",
    description: "SQLite select count query parameters, like: SELECT COUNT(1) FROM logs WHERE ${query_condition}",
    parameters: {
      type: "object",
      properties: {
        query_condition: {
          type: "string",
          description: "WHERE clause conditions, e.g. level='ERROR' AND content MATCH 'timeout'",
        }
      },
      required: ["query_condition"],
    },
    strict: true,
  },
  {
    type: "function",
    name: "send_logs",
    description: "Send compressed relevant logs to Hub for verification",
    parameters: {
      type: "object",
      properties: {
        logs: {
          type: "string",
          description: "logs with line breaks",
        }
      },
      required: ["logs"],
    },
    strict: true,
  },
];

/**
 * Creates the tool interface consumed by the agent.
 *
 * @param {import("better-sqlite3").Database} db
 * @returns {{ definitions: object[], handle: (name: string, args: object) => Promise<any> }}
 */
export const createTools = (db) => {
  const handlers = {
    search: async ({ keywords, semantic, limit = 5 }) => {
      const results = await hybridSearch(db, { keywords, semantic }, Math.min(limit, 20));

      return results.map((r) => ({
        id: r.id,
        timestamp: r.timestamp,
        level: r.level,
        content: r.content,
      }));
    },
    select: async ({ query_condition, order_by, limit }) => {
      if (order_by) {
        order_by = `ORDER BY ${order_by}`;
      }
      return search(db, query_condition, order_by, limit);
    },
    count: async ({ query_condition }) => {
      return count(db, query_condition);
    },
    send_logs: async ({ logs }) => {
      return hub.sendLogs(logs);
    },
  };

  return {
    definitions: TOOLS,

    handle: async (name, args) => {
      const handler = handlers[name];
      if (!handler) throw new Error(`Unknown tool: ${name}`);

      log.tool(name, args);

      try {
        const result = await handler(args);
        const output = JSON.stringify(result);
        log.toolResult(name, true, output);
        return output;
      } catch (error) {
        const output = JSON.stringify({ error: error.message });
        log.toolResult(name, false, error.message);
        return output;
      }
    },
  };
};
