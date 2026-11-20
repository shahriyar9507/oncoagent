"use client";

import { useMemo, useSyncExternalStore } from "react";
import { CaseInputSchema, type CaseInput } from "./caseInput";
import { clearRun } from "./runs";

// Clinician-entered cases live in this browser only (localStorage). The server rebuilds the record from the
// validated input on each run and stores nothing. Production would keep cases in the hospital's own database.
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

export function getCase(id: string): StoredCase | undefined {
  return readCases().find((c) => c.id === id);
}

export function saveCase(id: string, input: CaseInput): StoredCase {
  const list = readCases();
  const now = new Date().toISOString();
  const existing = list.find((c) => c.id === id);
  const next: StoredCase = { id, createdAt: existing?.createdAt ?? now, updatedAt: now, input };
  write([next, ...list.filter((c) => c.id !== id)]);
  return next;
}

export function deleteCase(id: string) {
  write(readCases().filter((c) => c.id !== id));
  clearRun(id);
}

/** All saved cases, newest first. Empty on the server and on first paint. */
export function useCases(): StoredCase[] {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  return useMemo(() => parse(raw), [raw]);
}

/** One saved case, or undefined; `ready` is false until the browser store has been read. */
export function useCase(id: string): { stored: StoredCase | undefined; ready: boolean } {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "__server__");
  return useMemo(() => (raw === "__server__" ? { stored: undefined, ready: false } : { stored: parse(raw).find((c) => c.id === id), ready: true }), [raw, id]);
}
