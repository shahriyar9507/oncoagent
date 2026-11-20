import { createMcpHandler } from "mcp-handler";
import { timingSafeEqual } from "node:crypto";
import { registerOncoTools, SERVER_INFO } from "@/lib/mcp/tools";
import { getUser } from "@/lib/server/auth";
import { authRequired } from "@/lib/session";

// Streamable HTTP endpoint for oncoagent-mcp.
// Access: a valid "Authorization: Bearer <MCP_BEARER_TOKEN>" header (for external MCP clients), or a signed-in
// session cookie (for the in-app tester). With AUTH_MODE=off and no token set, the endpoint is open.
export const maxDuration = 300;

const handler = createMcpHandler(
  (server) => {
    registerOncoTools(server);
  },
  { serverInfo: SERVER_INFO },
);

function bearerOk(req: Request, token: string): boolean {
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${token}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

async function guarded(req: Request): Promise<Response> {
  const token = process.env.MCP_BEARER_TOKEN;
  const byToken = !!token && bearerOk(req, token);
  const open = !token && !authRequired();
  if (!byToken && !open && !(await getUser(req))) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json", "www-authenticate": "Bearer" } });
  }
  return handler(req);
}

export { guarded as GET, guarded as POST, guarded as DELETE };
