"use client";

import type { AuditEntry, DecisionAction } from "./types";
import { dataMode, invalidate, send } from "./remote";

// Append-only, hash-chained audit log.
// Server mode: rows go to PostgreSQL through /api/audit (the server sets the actor from the session and refuses edits).
// Browser mode: the same chain is kept in this browser's localStorage.
const KEY = "oncoagent.audit.v1";
export const AUDIT_EVENT = "oncoagent-audit";

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

export interface AuditDraft {
  actor: string;
  action: DecisionAction | "agent-run";
  patientId: string;
  cardId?: string;
  reasonCode?: string;
  reasonText?: string;
}

/** Append one entry and return it (with its sequence number and hash). */
export async function appendAudit(e: AuditDraft): Promise<AuditEntry> {
  if (dataMode() === "server") {
    const { actor: _ignored, ...body } = e;
    void _ignored;
    const { entry } = await send<{ entry: AuditEntry }>("POST", "/api/audit", body);
    invalidate("audit");
    window.dispatchEvent(new Event(AUDIT_EVENT));
    return entry;
  }
  const log = readAudit();
  const prevHash = log.length ? log[log.length - 1].hash : "0".repeat(64);
  const entry: Omit<AuditEntry, "hash"> = { seq: log.length + 1, at: new Date().toISOString(), prevHash, actor: e.actor, action: e.action, patientId: e.patientId, cardId: e.cardId, reasonCode: e.reasonCode, reasonText: e.reasonText };
  const hash = await sha256(JSON.stringify(entry));
  const full = { ...entry, hash };
  try {
    localStorage.setItem(KEY, JSON.stringify([...log, full]));
  } catch {
    /* storage unavailable: keep the in-memory copy */
  }
  window.dispatchEvent(new Event(AUDIT_EVENT));
  return full;
}

export async function verifyAudit(log: AuditEntry[]): Promise<boolean> {
  let prev = "0".repeat(64);
  for (const e of log) {
    const { hash, ...rest } = e;
    if (rest.prevHash !== prev) return false;
    const canonical = { seq: rest.seq, at: rest.at, prevHash: rest.prevHash, actor: rest.actor, action: rest.action, patientId: rest.patientId, cardId: rest.cardId, reasonCode: rest.reasonCode, reasonText: rest.reasonText };
    if ((await sha256(JSON.stringify(canonical))) !== hash) return false;
    prev = hash;
  }
  return true;
}

export function latestDecisions(log: AuditEntry[]): Record<string, AuditEntry> {
  const out: Record<string, AuditEntry> = {};
  for (const e of log) if (e.cardId && e.action !== "agent-run") out[e.cardId] = e;
  return out;
}
