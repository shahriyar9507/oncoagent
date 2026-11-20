"use client";

import { useMemo, useSyncExternalStore } from "react";
import { CaseInputSchema, type CaseInput } from "./caseInput";
import { clearRun } from "./runs";
import { dataMode, invalidate, send, useRemote } from "./remote";

// Clinician-entered cases.
// Server mode: stored in PostgreSQL per signed-in user through /api/cases.
// Browser mode: kept in this browser's localStorage. In both modes the run API validates the case and rebuilds the
// record on the server for every run.
const KEY = "oncoagent.cases.v1";
const EVENT = "oncoagent-cases";

export interface StoredCase {
  id: string;
  createdAt: string;
  updatedAt: string;
  input: CaseInput;
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): StoredCase[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as StoredCase[];
    return Array.isArray(list) ? list.filter((c) => c && typeof c.id === "string" && CaseInputSchema.safeParse(c.input).success) : [];
  } catch {
    return [];
  }
}

function write(list: StoredCase[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    throw new Error("This browser blocked local storage, so the case cannot be saved.");
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function readCases(): StoredCase[] {
  return parse(readRaw());
}

/** Save (create or update) a case. */
export async function saveCase(id: string, input: CaseInput): Promise<StoredCase> {
  if (dataMode() === "server") {
    const { case: row } = await send<{ case: StoredCase }>("PUT", `/api/cases/${encodeURIComponent(id)}`, { input });
    invalidate("case");
    return row;
  }
  const list = readCases();
  const now = new Date().toISOString();
  const existing = list.find((c) => c.id === id);
  const next: StoredCase = { id, createdAt: existing?.createdAt ?? now, updatedAt: now, input };
  write([next, ...list.filter((c) => c.id !== id)]);
  return next;
}

export async function deleteCase(id: string): Promise<void> {
  if (dataMode() === "server") {
    await send("DELETE", `/api/cases/${encodeURIComponent(id)}`);
    invalidate("case");
    invalidate("runs:");
    return;
  }
  write(readCases().filter((c) => c.id !== id));
  await clearRun(id);
}

const NO_CASES: StoredCase[] = [];

/** All saved cases, newest first. Empty on the server render and on first paint. */
export function useCases(): StoredCase[] {
  const server = dataMode() === "server";
  const remote = useRemote<{ cases: StoredCase[] }>("cases", "/api/cases", server);
  const raw = useSyncExternalStore(subscribe, () => (server ? null : readRaw()), () => null);
  const local = useMemo(() => parse(raw), [raw]);
  return server ? remote.data?.cases ?? NO_CASES : local;
}

/** One saved case, or undefined; `ready` is false until the store has answered. */
export function useCase(id: string): { stored: StoredCase | undefined; ready: boolean } {
  const server = dataMode() === "server";
  const remote = useRemote<{ case: StoredCase }>(`case:${id}`, `/api/cases/${encodeURIComponent(id)}`, server);
  const raw = useSyncExternalStore(subscribe, () => (server ? "__remote__" : readRaw()), () => "__server__");
  return useMemo(() => {
    if (server) return { stored: remote.data?.case, ready: remote.ready };
    return raw === "__server__" ? { stored: undefined, ready: false } : { stored: parse(raw).find((c) => c.id === id), ready: true };
  }, [server, remote.data, remote.ready, raw, id]);
}
