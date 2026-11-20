import { getUser } from "@/lib/server/auth";
import { authRequired } from "@/lib/session";

// The signed-in user (name, role, username), for the top bar and the audit-log actor.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401, headers: { "cache-control": "no-store" } });
  return Response.json({ user: { username: user.sub, name: user.name, role: user.role }, authRequired: authRequired() }, { headers: { "cache-control": "no-store" } });
}
