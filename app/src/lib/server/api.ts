import { getDb, type Db } from "./db";
import { requireUser } from "./auth";
import { log } from "./log";
import type { SessionUser } from "../session";

// Shared plumbing for the storage API: authentication, the database handle and uniform errors.
export const PATIENT_ID = /^(P-\d{3}|C-[A-Z0-9]{6})$/;

const NO_STORE = { "cache-control": "no-store" };

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: NO_STORE });
}

export function fail(status: number, error: string, extra: Record<string, unknown> = {}): Response {
  return json({ error, ...extra }, status);
}

/** Authenticate, then hand the user and database to the handler. 503 when server storage is not configured. */
export async function withStore(req: Request, route: string, fn: (ctx: { user: SessionUser; db: Db }) => Promise<Response>): Promise<Response> {
  const user = await requireUser(req);
  if (user instanceof Response) return user;
  let db: Db | null;
  try {
    db = await getDb();
  } catch (e) {
    log("error", "store.connect_failed", { route, message: (e as Error).message });
    return fail(503, "Server storage is unavailable");
  }
  if (!db) return fail(503, "Server storage is not configured", { mode: "browser" });
  try {
    return await fn({ user, db });
  } catch (e) {
    log("error", "store.request_failed", { route, user: user.sub, message: (e as Error).message });
    return fail(500, "Storage request failed");
  }
}

/** Parse a JSON body with a size limit. */
export async function readJson(req: Request, maxBytes = 256 * 1024): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) throw new Error("Body too large");
  return JSON.parse(text);
}
