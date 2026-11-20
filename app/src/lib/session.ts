import { SignJWT, jwtVerify } from "jose";

// Signed session tokens (HS256) shared by the proxy and the route handlers. The token holds the user's ID, display
// name and role only; it lives in an httpOnly cookie and is checked on every request.
export const SESSION_COOKIE = "oa_session";
export const SESSION_TTL_S = 12 * 60 * 60;
const ISSUER = "oncoagent";

export interface SessionUser {
  sub: string;
  name: string;
  role: string;
}

/** AUTH_MODE=off disables sign-in (local experiments only). Any other value means sign-in is required. */
export function authRequired(): boolean {
  return (process.env.AUTH_MODE ?? "required").toLowerCase() !== "off";
}

function secret(): Uint8Array | null {
  const s = process.env.AUTH_SECRET;
  return s && s.length >= 32 ? new TextEncoder().encode(s) : null;
}

/** Bump AUTH_SESSION_VERSION to sign everyone out at once (for example after a password change or a lost device). */
function sessionVersion(): string {
  return process.env.AUTH_SESSION_VERSION ?? "1";
}

export function authConfigured(): boolean {
  return secret() !== null;
}

export async function signSession(user: SessionUser): Promise<string> {
  const key = secret();
  if (!key) throw new Error("AUTH_SECRET is not set (32+ characters required)");
  return new SignJWT({ name: user.name, role: user.role, v: sessionVersion() })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.sub)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_S}s`)
    .sign(key);
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionUser | null> {
  const key = secret();
  if (!token || !key) return null;
  try {
    const { payload } = await jwtVerify(token, key, { issuer: ISSUER, algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || payload.v !== sessionVersion()) return null;
    return {
      sub: payload.sub,
      name: typeof payload.name === "string" ? payload.name : payload.sub,
      role: typeof payload.role === "string" ? payload.role : "clinician",
    };
  } catch {
    return null;
  }
}

/** Only same-site relative paths are accepted as a post-login destination. */
export function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") && !next.startsWith("/login") ? next : "/";
}

/** Read one cookie value from a raw Cookie header. */
export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}
