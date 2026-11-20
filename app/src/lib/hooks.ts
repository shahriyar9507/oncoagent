"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { AuditEntry } from "./types";
import { latestDecisions, readAudit, verifyAudit } from "./audit";
import { RUN_EVENT, parseRun, readRun, readRunRaw, subscribeRuns } from "./runs";
import type { PipelineResult } from "./agents/pipeline";

/** Audit log from this browser, live-updated, with the hash-chain check. */
export function useAudit() {
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [chainOk, setChainOk] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const load = () => {
      const log = readAudit();
      setAudit(log);
      setReady(true);
      verifyAudit(log).then(setChainOk).catch(() => setChainOk(false));
    };
    load();
    window.addEventListener("oncoagent-audit", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener("oncoagent-audit", load);
      window.removeEventListener("storage", load);
    };
  }, []);
  const decisions = useMemo(() => latestDecisions(audit), [audit]);
  return { audit, decisions, chainOk, ready };
}

/** Live runs saved in this browser, keyed by patient. Re-reads when a run is saved or cleared. */
export function useLiveRuns(patientIds: string[]) {
  const key = patientIds.join(",");
  const [runs, setRuns] = useState<Record<string, PipelineResult>>({});
  useEffect(() => {
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
  }, [key]);
  return runs;
}

/** The live run saved in this browser for one patient, or null. Server render and first paint use null. */
export function useStoredRun(patientId: string): PipelineResult | null {
  const raw = useSyncExternalStore(subscribeRuns, () => readRunRaw(patientId), () => null);
  return useMemo(() => parseRun(raw, patientId), [raw, patientId]);
}
