// Fixed-window limiter kept in memory per server instance. Enough to stop a public demo from running up the
// model bill; production uses a shared store and per-clinician quotas.
const hits = new Map<string, number[]>();

export function allow(key: string, max: number, windowMs: number): { ok: boolean; retryInS: number } {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return { ok: false, retryInS: Math.ceil((windowMs - (now - recent[0])) / 1000) };
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return { ok: true, retryInS: 0 };
}

export const CLAUDE_RUNS_PER_IP = 6;
export const CLAUDE_WINDOW_MS = 10 * 60 * 1000;
export const MCP_CLAUDE_RUNS_PER_HOUR = 10;
