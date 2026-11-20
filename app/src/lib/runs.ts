"use client";

import type { PipelineResult } from "./agents/pipeline";

// The latest live agent run per patient, kept in this browser so decisions on live cards survive a reload.
// Production keeps runs server-side with the audit log.
const PREFIX = "oncoagent.run.v1.";
export const RUN_EVENT = "oncoagent-run";

export function readRun(patientId: string): PipelineResult | null {
  try {
    const raw = localStorage.getItem(PREFIX + patientId);
    if (!raw) return null;
    const r = JSON.parse(raw) as PipelineResult;
    return r && r.patientId === patientId && Array.isArray(r.cards) ? r : null;
  } catch {
    return null;
  }
}

export function saveRun(r: PipelineResult) {
  try {
    localStorage.setItem(PREFIX + r.patientId, JSON.stringify(r));
  } catch {
    /* storage full or blocked: the run stays on screen only */
  }
  window.dispatchEvent(new Event(RUN_EVENT));
}

export function clearRun(patientId: string) {
  try {
    localStorage.removeItem(PREFIX + patientId);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(RUN_EVENT));
}

/** The run a clinician currently sees for a patient: the latest live run, otherwise the stored one. */
export function currentRun(patientId: string, stored: PipelineResult): { run: PipelineResult; live: boolean } {
  const live = readRun(patientId);
  return live ? { run: live, live: true } : { run: stored, live: false };
}
