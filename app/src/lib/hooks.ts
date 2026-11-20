"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { AuditEntry } from "./types";
import { AUDIT_EVENT, latestDecisions, readAudit, verifyAudit } from "./audit";
import { RUN_EVENT, parseRun, readRun, readRunRaw, subscribeRuns } from "./runs";
import { dataMode, useRemote } from "./remote";
import type { PipelineResult } from "./agents/pipeline";

// Storage hooks used by every screen. Each one reads from the server (PostgreSQL via the API) in server mode and
// from this browser's localStorage in browser mode. The mode is fixed per deployment, so both paths are always
// called (keeping hook order stable) and the inactive one stays idle.

const NO_ENTRIES: AuditEntry[] = [];

/** Audit log, live-updated, with the hash-chain check. */
export function useAudit() {
  const server = dataMode() === "server";
  const remote = useRemote<{ entries: AuditEntry[]; chainOk: boolean }>("audit", "/api/audit", server);

  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [chainOk, setChainOk] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (server) return;
    const load = () => {
      const log = readAudit();
      setAudit(log);
      setReady(true);
      verifyAudit(log).then(setChainOk).catch(() => setChainOk(false));
    };
    load();
    window.addEventListener(AUDIT_EVENT, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(AUDIT_EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, [server]);

  const entries = server ? remote.data?.entries ?? NO_ENTRIES : audit;
  const decisions = useMemo(() => latestDecisions(entries), [entries]);
  return server
    ? { audit: entries, decisions, chainOk: remote.ready ? (remote.data?.chainOk ?? false) : null, ready: remote.ready }
    : { audit, decisions, chainOk, ready };
}

/** Latest live runs keyed by patient. */
export function useLiveRuns(patientIds: string[]) {
  const server = dataMode() === "server";
  const key = patientIds.join(",");
  const remote = useRemote<{ runs: Record<string, PipelineResult> }>(`runs:${key}`, `/api/runs?ids=${encodeURIComponent(key)}`, server && key.length > 0);

  const [runs, setRuns] = useState<Record<string, PipelineResult>>({});
  useEffect(() => {
    if (server) return;
    const ids = key.split(",").filter(Boolean);
    const load = () => {
      const out: Record<string, PipelineResult> = {};
      for (const id of ids) {
        const r = readRun(id);
        if (r) out[id] = r;
      }
      setRuns(out);
    };
    load();
    window.addEventListener(RUN_EVENT, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(RUN_EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, [key, server]);
  return server ? remote.data?.runs ?? EMPTY_RUNS : runs;
}

const EMPTY_RUNS: Record<string, PipelineResult> = {};

/** The latest live run for one patient, or null. Server render and first paint use null. */
export function useStoredRun(patientId: string): PipelineResult | null {
  const server = dataMode() === "server";
  const remote = useRemote<{ runs: Record<string, PipelineResult> }>(`runs:${patientId}`, `/api/runs?ids=${encodeURIComponent(patientId)}`, server);
  const raw = useSyncExternalStore(subscribeRuns, () => (server ? null : readRunRaw(patientId)), () => null);
  const local = useMemo(() => parseRun(raw, patientId), [raw, patientId]);
  return server ? remote.data?.runs?.[patientId] ?? null : local;
}
