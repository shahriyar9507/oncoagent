import { createMcpHandler } from "mcp-handler";
import { registerOncoTools, SERVER_INFO } from "@/lib/mcp/tools";

// Streamable HTTP endpoint for oncoagent-mcp. Set MCP_BEARER_TOKEN to require a bearer token.
export const maxDuration = 300;

const handler = createMcpHandler(
  (server) => {
    registerOncoTools(server);
  },
  { serverInfo: SERVER_INFO },
);

async function guarded(req: Request): Promise<Response> {
  const token = process.env.MCP_BEARER_TOKEN;
  if (token && req.headers.get("authorization") !== `Bearer ${token}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json", "www-authenticate": "Bearer" } });
  }
  return handler(req);
}

export { guarded as GET, guarded as POST, guarded as DELETE };
