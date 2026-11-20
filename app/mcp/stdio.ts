// stdio transport for oncoagent-mcp (Claude Desktop, Claude Code, any local MCP client).
// Run: npx tsx mcp/stdio.ts
import { existsSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { registerOncoTools, SERVER_INFO } from "../src/lib/mcp/tools";

for (const f of [".env.local", "../.env.local"]) {
  if (existsSync(f)) process.loadEnvFile(f);
}

serveStdio(() => {
  const server = new McpServer(SERVER_INFO, { capabilities: { tools: {} } });
  registerOncoTools(server);
  return server;
});
