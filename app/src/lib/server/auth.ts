import { SESSION_COOKIE, authRequired, readCookie, verifySessionToken, type SessionUser } from "../session";

const DEMO_USER: SessionUser = { sub: "demo", name: "Dr. Demo", role: "clinician" };

/** The signed-in user for a request, or null. With AUTH_MODE=off every request acts as the demo user. */
export async function getUser(req: Request): Promise<SessionUser | null> {
  if (!authRequired()) return DEMO_USER;
  return verifySessionToken(readCookie(req.headers.get("cookie"), SESSION_COOKIE));
}

/** Route-handler guard: the user, or a 401 response to return as is. */
export async function requireUser(req: Request): Promise<SessionUser | Response> {
  const user = await getUser(req);
  return user ?? Response.json({ error: "Sign in required" }, { status: 401 });
}

/** Client IP for rate limiting (first X-Forwarded-For hop on Vercel). */
export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
}
