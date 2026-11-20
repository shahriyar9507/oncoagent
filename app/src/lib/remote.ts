"use client";

import { useEffect, useSyncExternalStore } from "react";

// Where data lives for this deployment. The root layout decides at build time from DATABASE_URL:
// "server" → PostgreSQL through the API; "browser" → localStorage on this device.
export type DataMode = "server" | "browser";
let mode: DataMode = "browser";

export function setDataMode(m: DataMode) {
  mode = m;
}

export function dataMode(): DataMode {
  return mode;
}

// A small keyed cache for API resources with subscribe / refetch, used by the storage hooks in server mode.
interface Entry<T = unknown> {
  data?: T;
  error?: string;
  status?: number;
  ready: boolean;
}
const cache = new Map<string, Entry>();
const urls = new Map<string, string>();
const inflight = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();
const EMPTY: Entry = { ready: false };

function emit() {
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

async function load(key: string, url: string): Promise<void> {
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    try {
      const res = await fetch(url, { cache: "no-store", credentials: "same-origin" });
      if (res.status === 401) {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full load drops all cached data
        window.location.assign(`/login?next=${encodeURIComponent(location.pathname)}`);
        return;
      }
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      cache.set(key, res.ok ? { data: body, ready: true, status: res.status } : { error: String(body.error ?? `HTTP ${res.status}`), status: res.status, ready: true });
    } catch (e) {
      cache.set(key, { error: (e as Error).message, ready: true });
    } finally {
      inflight.delete(key);
      emit();
    }
  })();
  inflight.set(key, p);
  return p;
}

/** Subscribe to an API resource. `enabled=false` returns an idle entry and fetches nothing. */
export function useRemote<T>(key: string, url: string, enabled = true): Entry<T> {
  const entry = useSyncExternalStore(subscribe, () => (enabled ? cache.get(key) ?? EMPTY : EMPTY), () => EMPTY) as Entry<T>;
  useEffect(() => {
    if (!enabled) return;
    urls.set(key, url);
    if (!cache.has(key)) void load(key, url);
  }, [enabled, key, url]);
  return entry;
}

/** Refetch every cached resource whose key starts with `prefix`. */
export function invalidate(prefix: string) {
  for (const [key, url] of urls) if (key.startsWith(prefix)) void load(key, url);
}

/** JSON request helper for mutations; throws with the server's error message. */
export async function send<T>(method: "POST" | "PUT" | "DELETE", url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method, credentials: "same-origin", headers: body !== undefined ? { "content-type": "application/json" } : undefined, body: body !== undefined ? JSON.stringify(body) : undefined });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.status === 401) {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full load drops all cached data
    window.location.assign(`/login?next=${encodeURIComponent(location.pathname)}`);
    throw new Error("Sign in required");
  }
  if (!res.ok) throw new Error(Array.isArray(j.issues) && j.issues.length ? `${j.error}: ${(j.issues as string[]).join("; ")}` : String(j.error ?? `HTTP ${res.status}`));
  return j as T;
}

/** The signed-in user, for display and as the actor of browser-kept audit entries. */
export function useSessionUser(): { name: string; username: string; role: string } | null {
  const e = useRemote<{ user: { name: string; username: string; role: string } }>("session", "/api/auth/session");
  return e.data?.user ?? null;
}
