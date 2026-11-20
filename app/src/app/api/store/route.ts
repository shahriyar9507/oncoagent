import { getDb, storageConfigured } from "@/lib/server/db";
import { ensureSchema } from "@/lib/server/store";
import { requireUser } from "@/lib/server/auth";
import { json } from "@/lib/server/api";

// Where this deployment keeps cases, runs and the audit log: "server" (PostgreSQL) or "browser" (local storage).
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (user instanceof Response) return user;
  if (!storageConfigured()) return json({ mode: "browser", driver: null });
  try {
    const db = await getDb();
    if (!db) return json({ mode: "browser", driver: null });
    await ensureSchema(db);
    return json({ mode: "server", driver: db.driver });
  } catch {
    return json({ mode: "browser", driver: null, error: "Server storage is configured but unreachable" });
  }
}
