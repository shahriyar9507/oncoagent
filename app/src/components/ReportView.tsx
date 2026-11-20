"use client";

import Link from "next/link";
import type { Patient } from "@/lib/types";
import type { PipelineResult } from "@/lib/agents/pipeline";
import type { RecistAssessment } from "@/lib/clinical/recist";
import { useAudit, useStoredRun } from "@/lib/hooks";
import { fmtDate, fmtDateTime, fmtNum, monthsBetween } from "@/lib/format";
import { DatourMark } from "./Logo";
import { IconPrinter } from "./icons";

const KIND_ORDER: Record<string, number> = { treatment: 0, test: 1, safety: 2, dose: 3, trial: 4, monitoring: 5, summary: 6 };

/** Printable tumour-board pre-read: the record, the AI draft, every card with its decision, the dose card and sources. */
export function ReportView({ patient: p, recist, stored, untested, backHref }: { patient: Patient; recist: RecistAssessment[]; stored: PipelineResult | null; untested: string[]; backHref?: string }) {
  const saved = useStoredRun(p.id);
  const live = saved !== null;
  const { audit, decisions, chainOk } = useAudit();
  const back = backHref ?? `/patients/${p.id}`;
  const maybeRun = saved ?? stored;
  if (!maybeRun) {
    return (
      <section className="panel">
        <div className="empty-state">
          <p><b>No agent run yet for {p.displayName}.</b></p>
          <p className="sub">The report is built from the latest run and the clinician&apos;s decisions. Run the agents first.</p>
          <Link href={`${back}#agents`} className="btn sm primary arrow" style={{ marginTop: 12 }}>Open the case</Link>
        </div>
      </section>
    );
  }
  const run: PipelineResult = maybeRun;

  const cards = [...run.cards].sort((a, b) => (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9));
  const cited = new Set(cards.flatMap((c) => c.evidenceIds));
  const refs = run.evidence.filter((e) => cited.has(e.id) && e.kind !== "patient");
  const refNo = new Map(refs.map((e, i) => [e.id, i + 1]));
  const last = recist[recist.length - 1];
  const patientAudit = audit.filter((a) => a.patientId === p.id);
  const head = patientAudit[patientAudit.length - 1];
  const decidedN = cards.filter((c) => decisions[c.id]).length;

  return (
    <div className="report-wrap">
      <div className="report-bar no-print">
        <Link href={back} className="btn sm">← Back to record</Link>
        <span className="sub">{decidedN} of {cards.length} cards decided · {live ? "live run" : "stored run"} · A4 layout</span>
        <button type="button" className="btn primary sm" onClick={() => window.print()}><IconPrinter /> Print or save as PDF</button>
      </div>

      <article className="paper" aria-label="Tumour-board report">
        <header className="pp-head">
          <div className="pp-brand"><DatourMark size={22} /> <span>Onco<b>Agent</b></span></div>
          <div className="pp-meta">
            <b>Tumour-board pre-read</b>
            <span>Prepared {fmtDateTime(run.ranAt)} · {run.mode === "claude" ? `synthesis ${run.model}` : "rules only"}</span>
          </div>
        </header>
        <p className="pp-banner">Draft for clinician review. Not a prescription. {p.id.startsWith("C-") ? "Clinician-entered, de-identified case" : "Fictional patient for demonstration"}; every recommendation needs a clinician&apos;s decision.</p>

        <section className="pp-sec pp-grid">
          <div>
            <h1>{p.displayName}</h1>
            <p>{p.id} · {p.age} years · {p.sex === "F" ? "female" : "male"} · {p.smoking}</p>
            <p>{p.diagnosis}; {p.histology}</p>
            <p>Stage {p.stage} · ECOG {p.ecog}{p.pdl1Tps !== undefined ? ` · PD-L1 TPS ${p.pdl1Tps}%` : ""}</p>
          </div>
          <dl className="pp-kv">
            <dt>Latest RECIST 1.1</dt><dd><b className={last.category === "PD" ? "pp-red" : ""}>{last.category}</b> · {last.sumMm} mm on {fmtDate(last.date)}</dd>
            <dt>Medications</dt><dd>{p.medications.map((m) => m.name).join("; ")}</dd>
            <dt>Kidney · body</dt><dd>Creatinine {p.serumCreatinineMgDl} mg/dL ({fmtDate(p.creatinineDate)}) · {p.weightKg} kg · {p.heightCm} cm</dd>
            <dt>Allergies</dt><dd>{p.allergies.length ? p.allergies.join(", ") : "None recorded"}</dd>
          </dl>
        </section>

        <section className="pp-sec">
          <h2>Question for the board</h2>
          <p>{p.question}</p>
        </section>

        {run.boardSummary && (
          <section className="pp-sec">
            <h2>AI pre-read <span className="pp-tag">draft · cites evidence only</span></h2>
            <p className="pp-summary">{run.boardSummary}</p>
          </section>
        )}

        <section className="pp-sec">
          <h2>Disease course</h2>
          <table className="pp-table">
            <thead><tr><th>Line</th><th>Regimen</th><th>Dates</th><th>Best response</th><th>Stopped</th></tr></thead>
            <tbody>
              {p.therapyLines.length === 0 ? (
                <tr><td colSpan={5}>Treatment-naive; first-line decision pending.</td></tr>
              ) : (
                p.therapyLines.map((l) => (
                  <tr key={l.line}><td>{l.line}</td><td>{l.regimen}</td><td>{fmtDate(l.start)} → {l.end ? `${fmtDate(l.end)} (${monthsBetween(l.start, l.end)} mo)` : "ongoing"}</td><td>{l.bestResponse ?? "—"}</td><td>{l.stopReason ?? "—"}</td></tr>
                ))
              )}
            </tbody>
          </table>
          <table className="pp-table" style={{ marginTop: 10 }}>
            <thead><tr><th>Scan</th><th>Sum (mm)</th><th>From baseline</th><th>From nadir</th><th>RECIST</th></tr></thead>
            <tbody>
              {recist.map((r) => (
                <tr key={r.date}><td>{fmtDate(r.date)}</td><td>{r.sumMm}</td><td>{r.changeFromBaselinePct.toFixed(1)}%</td><td>{r.changeFromNadirPct.toFixed(1)}%</td><td>{r.category}{r.newLesions ? " · new lesion" : ""}</td></tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="pp-sec">
          <h2>Molecular profile</h2>
          <table className="pp-table">
            <thead><tr><th>Alteration</th><th>Sample</th><th>VAF</th><th>Reported</th><th>Lab</th></tr></thead>
            <tbody>
              {p.variants.map((v) => (
                <tr key={`${v.gene}${v.alteration}`}><td><b>{v.gene} {v.alteration}</b>{v.hgvsP ? ` (${v.hgvsP})` : ""}</td><td>{v.sample}</td><td>{v.vafPercent !== undefined ? `${v.vafPercent}%` : "—"}</td><td>{fmtDate(v.reportedOn)}</td><td>{v.lab}</td></tr>
              ))}
            </tbody>
          </table>
          {untested.length > 0 && <p className="pp-note">Guideline panel markers not yet reported: {untested.join(", ")}.</p>}
        </section>

        <section className="pp-sec">
          <h2>Recommendations and decisions</h2>
          <table className="pp-table pp-cards">
            <thead><tr><th>#</th><th>Proposal</th><th>Sources</th><th>Decision</th></tr></thead>
            <tbody>
              {cards.map((c, i) => {
                const d = decisions[c.id];
                return (
                  <tr key={c.id}>
                    <td>{i + 1}</td>
                    <td>
                      <span className="pp-kind">{c.kind === "summary" ? "molecular" : c.kind} · {c.origin === "claude" ? "Claude" : c.agent} · {c.confidence} confidence{c.critic.verdict === "flag" ? " · CRITIC FLAG" : ""}</span>
                      {c.proposal}
                      {c.critic.verdict === "flag" && <span className="pp-flag">{c.critic.notes.join(" ")}</span>}
                    </td>
                    <td className="pp-refs">{c.evidenceIds.map((id) => (refNo.has(id) ? `[${refNo.get(id)}]` : id.replace("pt:", "rec "))).join(" ")}</td>
                    <td>{d ? <><b>{d.action === "approve" ? "Approved" : d.action === "modify" ? "Modified" : "Rejected"}</b><br />{d.actor}, {fmtDateTime(d.at)}{d.reasonText ? <><br />“{d.reasonText}”</> : null}</> : <span className="pp-pending">Pending ☐ approve ☐ modify ☐ reject</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {run.dose && (
          <section className="pp-sec">
            <h2>Dose card <span className="pp-tag">{run.dose.blocks.length ? "blocked" : "calculated · pharmacist to verify"}</span></h2>
            <p>{run.dose.regimenName} · BSA {run.dose.bsa.toFixed(2)} m² (Mosteller) · CrCl {run.dose.crcl.toFixed(0)} mL/min (Cockcroft–Gault)</p>
            <table className="pp-table">
              <thead><tr><th>Drug</th><th>Dose</th><th>Formula</th><th>Schedule</th></tr></thead>
              <tbody>
                {run.dose.lines.map((l) => <tr key={l.drug}><td><b>{l.drug}</b></td><td><b>{l.text}</b></td><td>{l.formula}{l.raw !== undefined ? ` = ${l.raw.toFixed(1)} mg` : ""}</td><td>{l.schedule}</td></tr>)}
              </tbody>
            </table>
            {[...run.dose.blocks, ...run.dose.warnings].map((w) => <p key={w} className="pp-flag">{w}</p>)}
            {run.dose.premedication.length > 0 && <p className="pp-note">Premedication: {run.dose.premedication.join("; ")}</p>}
            <p className="pp-note">{run.dose.asOf}</p>
          </section>
        )}

        <section className="pp-sec pp-sign">
          <div><span>Treating oncologist</span><i /></div>
          <div><span>Oncology pharmacist</span><i /></div>
          <div><span>Tumour-board chair</span><i /></div>
        </section>

        <section className="pp-sec">
          <h2>Sources</h2>
          <ol className="pp-refs-list">
            {refs.map((e) => (
              <li key={e.id}><b>{e.label}</b> <span className="pp-id">{e.id}</span> — {e.detail}{e.url ? ` ${e.url}` : ""}</li>
            ))}
          </ol>
          <p className="pp-note">“rec eN” refers to an event in the patient record on the timeline.</p>
        </section>

        <footer className="pp-foot">
          <span>OncoAgent by DatourX · run {run.mode}{run.usage ? ` · ${fmtNum(run.usage.inputTokens)}/${fmtNum(run.usage.outputTokens)} tokens` : ""}</span>
          <span>Audit chain {chainOk === false ? "BROKEN" : chainOk ? "intact" : "—"}{head ? ` · head #${head.seq} ${head.hash.slice(0, 16)}…` : " · no entries"}</span>
        </footer>
      </article>
    </div>
  );
}
