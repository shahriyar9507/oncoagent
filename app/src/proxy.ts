import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authRequired, verifySessionToken, safeNext } from "@/lib/session";

// Optimistic gate in front of every page and API: no valid session cookie, no access.
// Route handlers verify the session again before reading or writing data.
// The MCP endpoint has its own bearer-token check, and /api/health stays public for uptime monitors.
const PUBLIC = [/^\/login\/?$/, /^\/api\/auth\//, /^\/api\/health\/?$/, /^\/api\/mcp(\/|$)/];

function sameOrigin(origin: string, req: NextRequest): boolean {
  if (origin === req.nextUrl.origin) return true;
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false; // "null" or malformed
  }
}

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  // Cross-site request guard for state-changing API calls (on top of SameSite=Lax cookies).
  // External MCP clients send no Origin header, so they are not affected.
  if (UNSAFE.has(req.method) && pathname.startsWith("/api/")) {
    const origin = req.headers.get("origin");
    if (origin && !sameOrigin(origin, req)) return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });
  }
  if (!authRequired()) return NextResponse.next();
  const user = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (pathname === "/login" && user) return NextResponse.redirect(new URL(safeNext(req.nextUrl.searchParams.get("next")), req.url));
  if (user || PUBLIC.some((r) => r.test(pathname))) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const login = new URL("/login", req.url);
  if (pathname !== "/") login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|opengraph-image|twitter-image|robots.txt|sitemap.xml).*)"],
};
