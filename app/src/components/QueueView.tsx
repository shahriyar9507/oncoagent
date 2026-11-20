"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AuditEntry } from "@/lib/types";
import { latestDecisions, readAudit } from "@/lib/audit";
import { IconInbox } from "./icons";

interface Item { id: string; patientId: string; patientName: string; agent: string; kind: string; proposal: string; confidence: string; critic: "pass" | "flag"; origin: "rules" | "claude" }

const ORDER: Record<string, number> = { safety: 0, treatment: 1, test: 2, dose: 3, trial: 4, monitoring: 5, summary: 6 };

export function QueueView({ items }: { items: Item[] }) {
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [show, setShow] = useState<"pending" | "decided" | "all">("pending");
  useEffect(() => {
    const load = () => setAudit(readAudit());
    load();
    window.addEventListener("oncoagent-audit", load);
    return () => window.removeEventListener("oncoagent-audit", load);
  }, []);
  const decided = useMemo(() => latestDecisions(audit), [audit]);
  const rows = items
    .filter((i) => (show === "all" ? true : show === "pending" ? !decided[i.id] : !!decided[i.id]))
    .sort((a, b) => Number(b.critic === "flag") - Number(a.critic === "flag") || (ORDER[a.kind] ?? 9) - (ORDER[b.kind] ?? 9));
  const pending = items.filter((i) => !decided[i.id]).length;

  return (
    <>
      <section className="panel hero">
        <p className="eyebrow">Decision queue</p>
        <h1 style={{ marginTop: 8 }}>{pending} cards <b>wait for a clinician</b></h1>
        <p>Flagged cards come first, then safety, treatment and tests. Nothing here acts on a patient until it is approved in the patient&apos;s record.</p>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title"><IconInbox /> Cards</h2>
          <div className="row" role="tablist" aria-label="Filter">
            {(["pending", "decided", "all"] as const).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={show === k} className={`btn sm${show === k ? " primary" : ""}`} onClick={() => setShow(k)}>{k[0].toUpperCase() + k.slice(1)}</button>
            ))}
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="empty">Nothing here. {show === "decided" ? "Decide a card in a patient record to see it here." : "Every card has a decision."}</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Patient</th><th>Agent</th><th>Kind</th><th>Proposal</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const d = decided[r.id];
                  return (
                    <tr key={r.id}>
                      <td className="strong"><Link href={`/patients/${r.patientId}`} style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>{r.patientName}</Link><br /><span className="muted mono">{r.patientId}</span></td>
                      <td>{r.origin === "claude" ? <span className="chip solid">Claude</span> : r.agent}</td>
                      <td><span className="chip">{r.kind}</span></td>
                      <td style={{ maxWidth: 560 }}>{r.proposal}</td>
                      <td>
                        {d ? <span className={`chip ${d.action === "reject" ? "red" : "mint"}`}>{d.action}</span> : r.critic === "flag" ? <span className="chip amber">critic flag</span> : <span className="chip ghost">pending</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
