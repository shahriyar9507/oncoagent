"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DecisionAction, RecommendationCard } from "@/lib/types";
import { useAudit, useLiveRuns } from "@/lib/hooks";
import { useCases } from "@/lib/cases";
import { fmtDateTime } from "@/lib/format";
import { DecisionDialog } from "./DecisionDialog";
import { IconAlert, IconCheck, IconEdit, IconInbox, IconShield, IconX } from "./icons";

const ORDER: Record<string, number> = { safety: 0, treatment: 1, test: 2, dose: 3, trial: 4, monitoring: 5, summary: 6 };
const KINDS = ["safety", "treatment", "test", "dose", "trial", "monitoring", "summary"] as const;
const KIND_LABEL: Record<string, string> = { summary: "molecular" };

export function QueueView({ stored, names }: { stored: Record<string, RecommendationCard[]>; names: Record<string, string> }) {
  const { decisions } = useAudit();
  const cases = useCases();
  const runs = useLiveRuns([...Object.keys(stored), ...cases.map((c) => c.id)]);
  // Entered cases join the queue once they have a run; their names come from the clinician's label or the case ID.
  const allNames: Record<string, string> = { ...names, ...Object.fromEntries(cases.map((c) => [c.id, c.input.label || `Case ${c.id}`])) };
  const [show, setShow] = useState<"pending" | "decided" | "all">("pending");
  const [patient, setPatient] = useState<string>("all");
  const [kind, setKind] = useState<string>("all");
  const [dialog, setDialog] = useState<{ card: RecommendationCard; action: DecisionAction } | null>(null);

  const items = useMemo(
    () => [
      ...Object.entries(stored).flatMap(([pid, cards]) => (runs[pid]?.cards ?? cards).map((c) => ({ ...c, patientId: pid, live: !!runs[pid] }))),
      ...cases.flatMap((cs) => (runs[cs.id]?.cards ?? []).map((c) => ({ ...c, patientId: cs.id, live: true }))),
    ],
    [stored, runs, cases],
  );
  const patientIds = Array.from(new Set(items.map((i) => i.patientId)));
  const pending = items.filter((i) => !decisions[i.id]);
  const decided = items.filter((i) => decisions[i.id]);
  const flaggedPending = pending.filter((i) => i.critic.verdict === "flag").length;
  const count = (a: DecisionAction) => decided.filter((i) => decisions[i.id].action === a).length;

  const rows = items
    .filter((i) => (show === "all" ? true : show === "pending" ? !decisions[i.id] : !!decisions[i.id]))
    .filter((i) => patient === "all" || i.patientId === patient)
    .filter((i) => kind === "all" || i.kind === kind)
    .sort((a, b) => Number(b.critic.verdict === "flag") - Number(a.critic.verdict === "flag") || (ORDER[a.kind] ?? 9) - (ORDER[b.kind] ?? 9));

  return (
    <>
      <section className="panel hero">
        <p className="eyebrow">Decision queue</p>
        <h1 style={{ marginTop: 8 }}>{pending.length} cards <b>wait for a clinician</b></h1>
        <p>Flagged cards come first, then safety, treatment and tests. Decide here or open the record for the full reasoning and evidence. Nothing acts on a patient until it is approved.</p>
      </section>

      <div className="grid g4">
        <section className="panel stat accent"><span className="label">Pending</span><span className="big">{pending.length}</span><span className="foot">across {patientIds.length} patients and cases</span></section>
        <section className="panel stat"><span className="label">Flagged by the critic</span><span className="big" style={{ color: flaggedPending ? "#ffc65c" : undefined }}>{flaggedPending}</span><span className="foot">review these first</span></section>
        <section className="panel stat"><span className="label">Decided in this browser</span><span className="big">{decided.length}</span><span className="foot">{count("approve")} approved · {count("modify")} modified · {count("reject")} rejected</span></section>
        <section className="panel stat"><span className="label">Live runs in use</span><span className="big">{Object.keys(runs).length}</span><span className="foot">others show the stored run</span></section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title"><IconInbox /> Cards</h2>
          <div className="row" role="tablist" aria-label="Status">
            {(["pending", "decided", "all"] as const).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={show === k} className={`btn sm${show === k ? " primary" : ""}`} onClick={() => setShow(k)}>
                {k[0].toUpperCase() + k.slice(1)} <span style={{ opacity: 0.7 }}>{k === "pending" ? pending.length : k === "decided" ? decided.length : items.length}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="filters">
          <div className="row" style={{ gap: 6 }} aria-label="Patient">
            <button type="button" className={`chip as-btn${patient === "all" ? " mint" : ""}`} onClick={() => setPatient("all")}>All patients</button>
            {patientIds.map((pid) => (
              <button key={pid} type="button" className={`chip as-btn${patient === pid ? " mint" : ""}`} onClick={() => setPatient(pid)}>{allNames[pid] ?? pid}</button>
            ))}
          </div>
          <div className="row" style={{ gap: 6 }} aria-label="Kind">
            <button type="button" className={`chip as-btn${kind === "all" ? " mint" : ""}`} onClick={() => setKind("all")}>All kinds</button>
            {KINDS.filter((k) => items.some((i) => i.kind === k)).map((k) => (
              <button key={k} type="button" className={`chip as-btn${kind === k ? " mint" : ""}`} onClick={() => setKind(k)}>{KIND_LABEL[k] ?? k}</button>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="empty">{show === "decided" ? "No decisions yet for this filter. Approve, modify or reject a card to see it here." : "Nothing pending for this filter. Every card has a decision."}</p>
        ) : (
          <ol className="qlist">
            {rows.map((r) => {
              const d = decisions[r.id];
              return (
                <li key={r.id} className={`qrow${r.critic.verdict === "flag" ? " flagged" : ""}`}>
                  <div className="q-who">
                    <Link href={`${r.patientId.startsWith("C-") ? "/cases" : "/patients"}/${r.patientId}#cards`} className="ul"><b>{allNames[r.patientId] ?? r.patientId}</b></Link>
                    <span className="muted mono">{r.patientId}{r.live ? " · live run" : ""}</span>
                  </div>
                  <div className="q-what">
                    <div className="row" style={{ gap: 6 }}>
                      <span className={`chip ${r.origin === "claude" ? "solid" : "mint"}`}>{r.origin === "claude" ? "Claude" : r.agent}</span>
                      <span className="chip">{KIND_LABEL[r.kind] ?? r.kind}</span>
                      {r.critic.verdict === "flag" ? <span className="chip amber"><IconAlert /> critic flag</span> : <span className="chip ghost"><IconShield /> passed</span>}
                      <span className="chip ghost">{r.confidence} confidence</span>
                    </div>
                    <p className="q-prop">{r.proposal}</p>
                    {r.critic.verdict === "flag" && <p className="critic flag">{r.critic.notes.join(" ")}</p>}
                  </div>
                  <div className="q-act">
                    {d ? (
                      <div className="q-done">
                        <span className={`chip ${d.action === "reject" ? "red" : "mint"}`}>{d.action === "approve" ? "Approved" : d.action === "modify" ? "Modified" : "Rejected"}</span>
                        <span className="muted">{fmtDateTime(d.at)}</span>
                      </div>
                    ) : (
                      <>
                        <button type="button" className="btn primary sm" onClick={() => setDialog({ card: r, action: "approve" })} aria-label={`Approve: ${r.proposal.slice(0, 60)}`}><IconCheck /> Approve</button>
                        <button type="button" className="btn sm" onClick={() => setDialog({ card: r, action: "modify" })} aria-label="Modify"><IconEdit /></button>
                        <button type="button" className="btn danger sm" onClick={() => setDialog({ card: r, action: "reject" })} aria-label="Reject"><IconX /></button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
      {dialog && <DecisionDialog card={dialog.card} action={dialog.action} patientId={dialog.card.patientId} patientName={allNames[dialog.card.patientId]} onClose={() => setDialog(null)} />}
    </>
  );
}
