"use client";

import type { AuditEntry, DecisionAction } from "./types";

// Append-only, hash-chained audit log kept in this browser for the demo.
// Production stores the same rows in an append-only database table.
const KEY = "oncoagent.audit.v1";

export function readAudit(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuditEntry[]) : [];
  } catch {
    return [];
  }
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function appendAudit(e: { actor: string; action: DecisionAction | "agent-run"; patientId: string; cardId?: string; reasonCode?: string; reasonText?: string }): Promise<AuditEntry[]> {
  const log = readAudit();
  const prevHash = log.length ? log[log.length - 1].hash : "0".repeat(64);
  const entry: Omit<AuditEntry, "hash"> = { seq: log.length + 1, at: new Date().toISOString(), prevHash, ...e };
  const hash = await sha256(JSON.stringify(entry));
  const next = [...log, { ...entry, hash }];
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: keep the in-memory copy */
  }
  window.dispatchEvent(new Event("oncoagent-audit"));
  return next;
}

export async function verifyAudit(log: AuditEntry[]): Promise<boolean> {
  let prev = "0".repeat(64);
  for (const e of log) {
    const { hash, ...rest } = e;
    if (rest.prevHash !== prev) return false;
    if ((await sha256(JSON.stringify(rest))) !== hash) return false;
    prev = hash;
  }
  return true;
}

export function clearAudit() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("oncoagent-audit"));
}

export function latestDecisions(log: AuditEntry[]): Record<string, AuditEntry> {
  const out: Record<string, AuditEntry> = {};
  for (const e of log) if (e.cardId && e.action !== "agent-run") out[e.cardId] = e;
  return out;
}
