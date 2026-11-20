import { hasClaude, MODEL } from "@/lib/agents/claude";

// Real status for the "agents online" indicator: is Claude configured, and do the live evidence sources answer?
// The key itself is never returned.
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

export async function GET() {
  const [civic, trials] = await Promise.all([
    ping("https://civicdb.org/api/graphql", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: "{ __typename }" }) }),
    ping("https://clinicaltrials.gov/api/v2/version"),
  ]);
  return Response.json(
    {
      claude: { configured: hasClaude(), model: MODEL },
      civic: { live: civic.ok, ms: civic.ms, fallback: "stored snapshot" },
      trials: { live: trials.ok, ms: trials.ms, fallback: "stored snapshot" },
      checkedAt: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
