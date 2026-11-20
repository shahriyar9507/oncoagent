import { SESSION_COOKIE } from "@/lib/session";

// Sign-out: expires the session cookie.
export async function POST() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return Response.json({ ok: true }, { headers: { "set-cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`, "cache-control": "no-store" } });
}
