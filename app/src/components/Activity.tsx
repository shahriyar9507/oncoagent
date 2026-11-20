"use client";

import Link from "next/link";
import { useAudit, useLiveRuns } from "@/lib/hooks";
import { fmtDateTime } from "@/lib/format";
import { IconHistory } from "./icons";


/** Recent agent runs and decisions from the audit log (server or this browser, depending on the deployment). */
export function PendingStat({ stored }: { stored: Record<string, string[]> }) {
  const { decisions } = useAudit();
  const runs = useLiveRuns(Object.keys(stored));
  const total = Object.entries(stored).reduce((n, [id, ids]) => n + (runs[id]?.cards.map((c) => c.id) ?? ids).length, 0);
  const pending = Object.entries(stored).reduce((n, [id, ids]) => n + (runs[id]?.cards.map((c) => c.id) ?? ids).filter((x) => !decisions[x]).length, 0);
  return (
    <>
      <span className="big">{pending}<small>of {total}</small></span>
      <span className="foot">cards wait for a clinician · <Link href="/queue" className="ul">open queue</Link></span>
    </>
  );
}

export function RecentActivity({ names }: { names: Record<string, string> }) {
  const { audit, chainOk, ready } = useAudit();
  const recent = [...audit].reverse().slice(0, 6);
  return (
    <section className="panel" aria-labelledby="act-t">
      <div className="panel-head">
        <h2 id="act-t" className="panel-title"><IconHistory /> Recent activity</h2>
        {audit.length > 0 && <span className={`chip ${chainOk === false ? "red" : "mint"}`}>{chainOk === false ? "chain broken" : `${audit.length} signed entries`}</span>}
      </div>
      {!ready ? (
        <p className="empty">Loading…</p>
      ) : recent.length === 0 ? (
        <div className="empty-state">
          <p><b>No decisions recorded yet.</b></p>
          <p className="sub">Open a case, run the agents and approve, modify or reject a card. Each action is signed into a hash-chained log and appears here.</p>
          <Link href="/patients/P-001" className="btn sm primary arrow" style={{ marginTop: 12 }}>Open Rahela Khatun</Link>
        </div>
      ) : (
        <ol className="audit-list">
          {recent.map((a) => (
            <li key={a.seq} className={`aud ${a.action}`}>
              <span className="aud-dot" aria-hidden="true" />
              <div>
                <b>{a.action === "agent-run" ? "Agent run" : a.action[0].toUpperCase() + a.action.slice(1)} · <Link href={`/patients/${a.patientId}`} className="ul">{names[a.patientId] ?? a.patientId}</Link></b>
                <span>{a.actor} · {fmtDateTime(a.at)}{a.reasonText ? ` · “${a.reasonText}”` : ""}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
