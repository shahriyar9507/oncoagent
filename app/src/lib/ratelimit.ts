// Sliding-window limiter kept in memory per server instance. Enough to stop a public demo from running up the
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

/** Check a limit without counting this request (used with `record` to count failures only). */
export function blocked(key: string, max: number, windowMs: number): { blocked: boolean; retryInS: number } {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.set(key, recent);
  return recent.length >= max ? { blocked: true, retryInS: Math.ceil((windowMs - (now - recent[0])) / 1000) } : { blocked: false, retryInS: 0 };
}

export function record(key: string) {
  const list = hits.get(key) ?? [];
  list.push(Date.now());
  hits.set(key, list);
  if (hits.size > 5000) hits.clear();
}

export function reset(key: string) {
  hits.delete(key);
}

export const CLAUDE_RUNS_PER_IP = 6;
export const CLAUDE_WINDOW_MS = 10 * 60 * 1000;
export const MCP_CLAUDE_RUNS_PER_HOUR = 10;
