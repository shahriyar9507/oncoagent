import { z } from "zod";
import { SESSION_COOKIE, SESSION_TTL_S, authConfigured, safeNext, signSession } from "@/lib/session";
import { authenticate } from "@/lib/server/users";
import { clientIp } from "@/lib/server/auth";
import { blocked, record, reset } from "@/lib/ratelimit";
import { log } from "@/lib/server/log";

// Sign-in: checks the credentials, then sets a signed, httpOnly session cookie for 12 hours.
const Body = z.object({ username: z.string().trim().min(1).max(64), password: z.string().min(1).max(256), next: z.string().max(512).optional() });

// Failed attempts are limited per IP and per username (stops both guessing and spraying across addresses).
const IP_FAILS = 10;
const USER_FAILS = 20;
const WINDOW_MS = 15 * 60 * 1000;

function tooMany(retryInS: number, ip: string) {
  log("warn", "auth.login.rate_limited", { ip });
  return Response.json({ error: `Too many failed attempts. Try again in ${Math.max(1, Math.ceil(retryInS / 60))} minutes.` }, { status: 429, headers: { "retry-after": String(retryInS) } });
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  const byIp = blocked(`login:${ip}`, IP_FAILS, WINDOW_MS);
  if (byIp.blocked) return tooMany(byIp.retryInS, ip);
  if (!authConfigured()) {
    log("error", "auth.not_configured", {});
    return Response.json({ error: "Sign-in is not configured on this server (AUTH_SECRET missing)." }, { status: 503 });
  }
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return Response.json({ error: "Enter a username and a password." }, { status: 400 });
  }
  const userKey = `login-user:${body.username.toLowerCase()}`;
  const byUser = blocked(userKey, USER_FAILS, WINDOW_MS);
  if (byUser.blocked) return tooMany(byUser.retryInS, ip);
  const user = authenticate(body.username, body.password);
  if (!user) {
    record(`login:${ip}`);
    record(userKey);
    log("warn", "auth.login.failed", { ip, username: body.username.slice(0, 64) });
    return Response.json({ error: "Wrong username or password." }, { status: 401 });
  }
  reset(`login:${ip}`);
  reset(userKey);
  const token = await signSession(user);
  log("info", "auth.login.ok", { ip, user: user.sub });
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return Response.json(
    { ok: true, user: { name: user.name, role: user.role, username: user.sub }, next: safeNext(body.next) },
    { headers: { "set-cookie": `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_S}${secure}`, "cache-control": "no-store" } },
  );
}
