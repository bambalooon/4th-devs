/**
 * In-memory MCP server with mock tools (weather, time).
 *
 * Unlike mcp_core which uses stdio transport, this server runs
 * in the same process and connects via InMemoryTransport.
 * The tools are intentionally simple — the point of this example
 * is the unified agent loop, not the tool implementations.
 */

import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";
import {AI_DEVS_API_KEY} from "../../config.js";

const PACKAGES_API_URL = `https://hub.ag3nts.org/api/packages`;

export const createMcpServer = () => {
  const server = new McpServer(
    { name: "demo-mcp-server", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.registerTool(
      "get_package_status",
      {
        description: "Get package status",
        inputSchema: {
          package_id: z.string().min(1).describe("ID of the package to track")
        }
      },
      async ({package_id}) => {
        const response = await fetch(PACKAGES_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: AI_DEVS_API_KEY,
            action: "check",
            packageid: package_id
          })
        });

        const data = await response.json();
        console.log(`Checking package ${package_id}: ${data}`);

        if (!response.ok || data.error) {
          const message = data?.error?.message ?? `Request failed with status ${response.status}`;
          throw new Error(message);
        }

        return data;
      });

  server.registerTool(
      "redirect_package",
      {
        description: "Redirect package to a new destination",
        inputSchema: {
          package_id: z.string().min(1).describe("ID of the package to track"),
          destination: z.string().min(1).describe("New destination address"),
          code: z.string().min(1).describe("Secret code for package redirection")
        }
      },
      async ({package_id, destination, code}) => {
        const response = await fetch(PACKAGES_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: AI_DEVS_API_KEY,
            action: "redirect",
            packageid: package_id,
            destination: destination,
            code: code
          })
        });

        const data = await response.json();
        console.log(`Redirecting package ${package_id} to ${destination} with code ${code}: ${data}`);

        if (!response.ok || data.error) {
          const message = data?.error?.message ?? `Request failed with status ${response.status}`;
          throw new Error(message);
        }

        return data;
      });

  return server;
};
