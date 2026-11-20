import { hasClaude, MODEL } from "@/lib/agents/claude";
import { authConfigured, authRequired } from "@/lib/session";
import { accounts } from "@/lib/server/users";
import { getDb, storageConfigured } from "@/lib/server/db";
import { ensureSchema } from "@/lib/server/store";
import { APP_VERSION } from "@/lib/version";

// Public status for uptime monitors and the "agents online" indicator: version, sign-in readiness, storage, Claude and
// the live evidence sources. No secret, account name or patient data is ever returned.
export const dynamic = "force-dynamic";

async function ping(url: string, init?: RequestInit): Promise<{ ok: boolean; ms: number }> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(4000), cache: "no-store" });
    return { ok: res.ok, ms: Date.now() - t0 };
  } catch {
    return { ok: false, ms: Date.now() - t0 };
  }
}

async function storage(): Promise<{ mode: "server" | "browser"; ok: boolean; driver?: string; ms?: number }> {
  if (!storageConfigured()) return { mode: "browser", ok: true };
  const t0 = Date.now();
  try {
    const db = await getDb();
    if (!db) return { mode: "browser", ok: true };
    await ensureSchema(db);
    await db.query("select 1");
    return { mode: "server", ok: true, driver: db.driver, ms: Date.now() - t0 };
  } catch {
    return { mode: "server", ok: false, ms: Date.now() - t0 };
  }
}

export async function GET() {
  const auth = { required: authRequired(), ready: !authRequired() || (authConfigured() && accounts().length > 0) };
  const [civic, trials, store] = await Promise.all([
    ping("https://civicdb.org/api/graphql", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: "{ __typename }" }) }),
    ping("https://clinicaltrials.gov/api/v2/version"),
    storage(),
  ]);
  const ok = auth.ready && store.ok;
  return Response.json(
    {
      status: ok ? "ok" : "degraded",
      version: APP_VERSION,
      auth,
      storage: store,
      claude: { configured: hasClaude(), model: MODEL },
      civic: { live: civic.ok, ms: civic.ms, fallback: "stored snapshot" },
      trials: { live: trials.ok, ms: trials.ms, fallback: "stored snapshot" },
      checkedAt: new Date().toISOString(),
    },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
