"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AuditEntry, DecisionAction, EvidenceItem, RecommendationCard } from "@/lib/types";
import type { PipelineResult, StepEvent } from "@/lib/agents/pipeline";
import { appendAudit, latestDecisions, readAudit, verifyAudit } from "@/lib/audit";
import { IconAlert, IconCalc, IconCheck, IconEdit, IconFile, IconFlask, IconPlay, IconShield, IconSpark, IconX } from "./icons";

const AGENTS = ["Sentinel", "Genomic-interpreter", "Test-advisor", "Guideline", "Pharmacology-safety", "Trial-matcher", "Dose-optimizer", "Synthesis (Claude)", "Safety-critic"];
const FILTERS: { key: string; label: string; kinds: RecommendationCard["kind"][] }[] = [
  { key: "all", label: "All", kinds: [] },
  { key: "treatment", label: "Treatment", kinds: ["treatment"] },
  { key: "test", label: "Tests", kinds: ["test"] },
  { key: "safety", label: "Safety", kinds: ["safety"] },
  { key: "trial", label: "Trials", kinds: ["trial"] },
  { key: "dose", label: "Dose", kinds: ["dose"] },
  { key: "molecular", label: "Molecular", kinds: ["summary"] },
  { key: "monitoring", label: "Monitoring", kinds: ["monitoring"] },
];
const REASONS = ["Patient preference or circumstances", "Clinical judgement", "Information missing or wrong", "Evidence outdated", "Drug not available or not affordable", "Other"];

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function AgentWorkspace({ patientId, snapshot }: { patientId: string; snapshot: PipelineResult }) {
  const [result, setResult] = useState<PipelineResult>(snapshot);
  const [running, setRunning] = useState(false);
  const [live, setLive] = useState<StepEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useClaude, setUseClaude] = useState(true);
  const [filter, setFilter] = useState("all");
  const [focusEvidence, setFocusEvidence] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [chainOk, setChainOk] = useState<boolean | null>(null);
  const [dialog, setDialog] = useState<{ card: RecommendationCard; action: DecisionAction } | null>(null);

  const refreshAudit = useCallback(() => {
    const log = readAudit();
    setAudit(log);
    verifyAudit(log).then(setChainOk).catch(() => setChainOk(false));
  }, []);

  useEffect(() => {
    refreshAudit();
    window.addEventListener("oncoagent-audit", refreshAudit);
    return () => window.removeEventListener("oncoagent-audit", refreshAudit);
  }, [refreshAudit]);

  const decisions = useMemo(() => latestDecisions(audit), [audit]);
  const evidenceById = useMemo(() => new Map(result.evidence.map((e) => [e.id, e])), [result.evidence]);
  const cards = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter)!;
    return result.cards.filter((c) => !f.kinds.length || f.kinds.includes(c.kind));
  }, [result.cards, filter]);
  const patientAudit = audit.filter((a) => a.patientId === patientId);

  async function runLive() {
    setRunning(true);
    setError(null);
    setLive([]);
    try {
      const res = await fetch("/api/agents/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId, useClaude }) });
      if (!res.ok || !res.body) throw new Error(`Run failed (HTTP ${res.status})`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const msg = JSON.parse(line) as { type: "step"; step: StepEvent } | { type: "result"; result: PipelineResult } | { type: "error"; message: string };
          if (msg.type === "step") setLive((s) => [...(s ?? []), msg.step]);
          else if (msg.type === "result") setResult(msg.result);
          else if (msg.type === "error") throw new Error(msg.message);
        }
      }
      await appendAudit({ actor: "Dr. Demo", action: "agent-run", patientId, reasonText: useClaude ? "Live run with Claude" : "Live rules-only run" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
      setLive(null);
    }
  }

  const steps = live ?? result.steps;
  const doneNames = new Set(steps.map((s) => s.agent));
  const flagged = result.cards.filter((c) => c.critic.verdict === "flag").length;
  const pending = result.cards.filter((c) => !decisions[c.id]).length;

  return (
    <div className="stack">
      <section className="panel glow" aria-labelledby="agents-title">
        <div className="panel-head">
          <div>
            <h2 id="agents-title" className="panel-title"><IconSpark /> Agent run</h2>
            <p className="sub" style={{ marginTop: 4 }}>
              {running ? "Agents are working…" : (
                <>Last run {fmtTime(result.ranAt)} · {result.mode === "claude" ? <>synthesis by <span className="mono">{result.model}</span></> : "rules only"}{result.usage ? ` · ${result.usage.inputTokens.toLocaleString()} in / ${result.usage.outputTokens.toLocaleString()} out tokens` : ""}</>
              )}
            </p>
          </div>
          <div className="row">
            <label className="chip" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={useClaude} onChange={(e) => setUseClaude(e.target.checked)} style={{ accentColor: "#17ff88" }} />
              Claude synthesis
            </label>
            <button type="button" className="btn primary" onClick={runLive} disabled={running}>
              <IconPlay /> {running ? "Running…" : "Run agents live"}
            </button>
          </div>
        </div>
        <div className="steps" aria-live="polite">
          {AGENTS.map((name) => {
            const s = steps.find((x) => x.agent === name);
            const isRunning = running && !doneNames.has(name) && AGENTS.filter((a) => !doneNames.has(a))[0] === name;
            const cls = s ? s.status : isRunning ? "running" : "";
            return (
              <div key={name} className={`stepc ${cls}`} title={s?.note}>
                <span className="n">
                  <span className={`dot${!s ? (isRunning ? " pulse" : " off") : s.status === "error" ? " red" : s.status === "skipped" ? " amber" : ""}`} />
                  {name}
                </span>
                <span className="t">{s ? (s.status === "skipped" ? "skipped" : `${s.ms.toLocaleString()} ms`) : isRunning ? "working" : running ? "queued" : "—"}</span>
              </div>
            );
          })}
        </div>
        {error && <p className="critic flag" style={{ marginTop: 12 }} role="alert"><IconAlert width={14} height={14} style={{ verticalAlign: -2 }} /> {error}. The stored run is still shown.</p>}
        {result.boardSummary && (
          <div style={{ marginTop: 16 }}>
            <p className="eyebrow" style={{ marginBottom: 8 }}>Tumour-board pre-read</p>
            <p className="summary-box">{result.boardSummary}</p>
          </div>
        )}
        <div className="row" style={{ marginTop: 14 }}>
          <span className="chip mint"><span className="dot" /> {result.cards.length} cards</span>
          <span className="chip">{pending} awaiting decision</span>
          <span className={`chip ${flagged ? "amber" : "mint"}`}><IconShield /> Safety-critic: {flagged ? `${flagged} flagged` : "all passed"}</span>
          <span className="chip ghost">{result.evidence.length} evidence items</span>
        </div>
      </section>

      <div className="split">
        <section className="stack" aria-label="Recommendation cards">
          <div className="row" role="tablist" aria-label="Filter cards">
            {FILTERS.map((f) => {
              const n = f.kinds.length ? result.cards.filter((c) => f.kinds.includes(c.kind)).length : result.cards.length;
              if (!n && f.key !== "all") return null;
              return (
                <button key={f.key} role="tab" aria-selected={filter === f.key} type="button" className={`btn sm${filter === f.key ? " primary" : ""}`} onClick={() => setFilter(f.key)}>
                  {f.label} <span style={{ opacity: 0.7 }}>{n}</span>
                </button>
              );
            })}
          </div>
          {cards.map((c) => (
            <Card key={c.id} card={c} evidence={evidenceById} decision={decisions[c.id]} onEvidence={setFocusEvidence} onDecide={(action) => setDialog({ card: c, action })} />
          ))}
        </section>

        <aside className="stack" aria-label="Evidence and audit">
          {result.dose && <DoseView dose={result.dose} />}
          <section className="panel">
            <div className="panel-head"><h3 className="panel-title"><IconFile /> Evidence</h3><span className="chip ghost">{result.evidence.length}</span></div>
            <div className="evidence-list">
              {result.evidence.map((e) => (
                <EvidenceRow key={e.id} e={e} highlight={focusEvidence === e.id} />
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="panel-head">
              <h3 className="panel-title"><IconShield /> Audit log</h3>
              <span className={`chip ${chainOk === false ? "red" : "mint"}`}>{chainOk === null ? "checking" : chainOk ? "hash chain intact" : "chain broken"}</span>
            </div>
            {patientAudit.length === 0 ? (
              <p className="empty" style={{ padding: 12 }}>No decisions yet. Approve, modify or reject a card to write the first entry.</p>
            ) : (
              <div className="evidence-list" style={{ maxHeight: 300 }}>
                {[...patientAudit].reverse().map((a) => (
                  <div key={a.seq} className="evi">
                    <b>#{a.seq} · {a.action}{a.reasonCode ? ` · ${a.reasonCode}` : ""}</b>
                    {a.actor} · {fmtTime(a.at)}{a.reasonText ? ` · “${a.reasonText}”` : ""}
                    <div className="id">sha256 {a.hash.slice(0, 16)}… ← {a.prevHash.slice(0, 8)}…</div>
                  </div>
                ))}
              </div>
            )}
            <p className="footer-note" style={{ marginTop: 10 }}>Demo log is stored in this browser. Production writes the same hash-chained rows to an append-only table.</p>
          </section>
        </aside>
      </div>

      {dialog && <DecisionDialog card={dialog.card} action={dialog.action} onClose={() => setDialog(null)} patientId={patientId} />}
    </div>
  );
}

function Card({ card, evidence, decision, onEvidence, onDecide }: { card: RecommendationCard; evidence: Map<string, EvidenceItem>; decision?: AuditEntry; onEvidence: (id: string) => void; onDecide: (a: DecisionAction) => void }) {
  const level = card.confidence === "high" ? 3 : card.confidence === "moderate" ? 2 : 1;
  const icon = card.kind === "dose" ? <IconCalc width={14} height={14} /> : card.kind === "test" ? <IconFlask width={14} height={14} /> : card.kind === "safety" ? <IconAlert width={14} height={14} /> : null;
  return (
    <article className={`rc${card.origin === "claude" ? " claude" : ""}${decision ? ` decided-${decision.action}` : ""}`}>
      <div className="rc-head">
        <span className={`chip ${card.origin === "claude" ? "solid" : "mint"}`}>{icon}{card.origin === "claude" ? "AI draft · Claude" : `AI draft · ${card.agent}`}</span>
        <span className="chip">{card.kind}</span>
        {card.critic.verdict === "flag" && <span className="chip amber"><IconAlert /> critic flag</span>}
        {decision && <span className={`chip ${decision.action === "reject" ? "red" : "mint"}`}>{decision.action === "approve" ? "Approved" : decision.action === "modify" ? "Modified" : "Rejected"}</span>}
      </div>
      <p className="rc-proposal">{card.proposal}</p>
      {card.why.length > 0 && (
        <ul className="rc-why">{card.why.slice(0, 6).map((w, i) => <li key={i}>{w}</li>)}</ul>
      )}
      <div className="rc-grid">
        <span className="k">Evidence</span>
        <span className="v ev">
          {card.evidenceIds.map((id) => {
            const e = evidence.get(id);
            return (
              <button key={id} type="button" className="chip" onClick={() => onEvidence(id)} title={e ? `${e.label}: ${e.detail}` : "Unknown evidence"} aria-label={`Show evidence ${id}`}>
                {id}
              </button>
            );
          })}
        </span>
        <span className="k">Confidence</span>
        <span className="v"><span className="meter" aria-hidden="true">{[1, 2, 3].map((i) => <i key={i} className={i <= level ? "on" : ""} />)}</span>{card.confidence} · {card.confidenceReason}</span>
        <span className="k">Uncertain</span>
        <span className="v">{card.uncertain}</span>
        {card.alternatives.length > 0 && (<><span className="k">Alternatives</span><span className="v">{card.alternatives.join(" · ")}</span></>)}
        {card.changesIf && (<><span className="k">Changes if</span><span className="v">{card.changesIf}</span></>)}
        {card.safety.length > 0 && (<><span className="k">Safety</span><span className="v">{card.safety.join(" · ")}</span></>)}
      </div>
      <p className={`critic ${card.critic.verdict}`}>
        {card.critic.verdict === "pass" ? "Safety-critic: every cited source exists; no unsourced drug, trial or dose." : `Safety-critic: ${card.critic.notes.join(" ")}`}
      </p>
      <div className="rc-actions">
        {decision ? (
          <p className="decision">
            <b>{decision.action === "approve" ? "Approved" : decision.action === "modify" ? "Modified" : "Rejected"}</b> by {decision.actor} · {fmtTime(decision.at)}
            {decision.reasonCode ? ` · ${decision.reasonCode}` : ""}{decision.reasonText ? ` · “${decision.reasonText}”` : ""}
          </p>
        ) : (
          <>
            <button type="button" className="btn primary sm" onClick={() => onDecide("approve")}><IconCheck /> Approve</button>
            <button type="button" className="btn sm" onClick={() => onDecide("modify")}><IconEdit /> Modify</button>
            <button type="button" className="btn danger sm" onClick={() => onDecide("reject")}><IconX /> Reject</button>
          </>
        )}
      </div>
    </article>
  );
}

function EvidenceRow({ e, highlight }: { e: EvidenceItem; highlight: boolean }) {
  useEffect(() => {
    if (highlight) document.getElementById(`ev-${e.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlight, e.id]);
  return (
    <div id={`ev-${e.id}`} className={`evi${highlight ? " hl" : ""}`}>
      <span className="id">{e.id}</span>
      <b>{e.label}</b>
      {e.detail}
      {e.url && (<> · <a href={e.url} target="_blank" rel="noreferrer">source</a></>)}
    </div>
  );
}

function DoseView({ dose }: { dose: NonNullable<PipelineResult["dose"]> }) {
  return (
    <section className="panel glow">
      <div className="panel-head">
        <h3 className="panel-title"><IconCalc /> Dose card</h3>
        {dose.blocks.length ? <span className="chip red">blocked</span> : <span className="chip mint">calculated · verify</span>}
      </div>
      <p className="sub">{dose.regimenName}</p>
      <div className="grid g2" style={{ marginTop: 12 }}>
        <div className="stat"><span className="label">Body surface area</span><span className="big" style={{ fontSize: 34 }}>{dose.bsa.toFixed(2)}<small>m²</small></span><span className="foot">Mosteller</span></div>
        <div className="stat"><span className="label">Creatinine clearance</span><span className="big" style={{ fontSize: 34 }}>{dose.crcl.toFixed(0)}<small>mL/min</small></span><span className="foot">Cockcroft–Gault</span></div>
      </div>
      <div className="table-wrap" style={{ marginTop: 14 }}>
        <table className="data" style={{ minWidth: 0 }}>
          <thead><tr><th>Drug</th><th>Dose</th><th>How</th></tr></thead>
          <tbody>
            {dose.lines.map((l) => (
              <tr key={l.drug}>
                <td className="strong">{l.drug}</td>
                <td className="num strong" style={{ color: "#6dffb6" }}>{l.text}</td>
                <td>{l.formula}{l.raw !== undefined ? ` = ${l.raw.toFixed(1)} mg` : ""}<br /><span className="muted">{l.schedule} · <a href={l.url} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>{l.source}</a></span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dose.blocks.map((b) => <p key={b} className="critic flag" style={{ marginTop: 8 }}>{b}</p>)}
      {dose.warnings.map((w) => <p key={w} className="critic flag" style={{ marginTop: 8 }}>{w}</p>)}
      {dose.premedication.length > 0 && (
        <ul className="rc-why" style={{ marginTop: 10 }}>{dose.premedication.map((m) => <li key={m}>{m}</li>)}</ul>
      )}
      <p className="footer-note" style={{ marginTop: 10 }}>{dose.asOf}. Deterministic formulas with unit tests; the language model never writes a dose.</p>
    </section>
  );
}

function DecisionDialog({ card, action, onClose, patientId }: { card: RecommendationCard; action: DecisionAction; onClose: () => void; patientId: string }) {
  const [reasonCode, setReasonCode] = useState(action === "approve" ? "" : REASONS[0]);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const needsReason = action !== "approve";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (needsReason && text.trim().length < 5) {
      setErr(action === "modify" ? "Describe the change (at least 5 characters)." : "Give the reason (at least 5 characters).");
      return;
    }
    setSaving(true);
    await appendAudit({ actor: "Dr. Demo", action, patientId, cardId: card.id, reasonCode: needsReason ? reasonCode : undefined, reasonText: text.trim() || undefined });
    setSaving(false);
    onClose();
  }

  const title = action === "approve" ? "Approve this card" : action === "modify" ? "Modify this card" : "Reject this card";
  return (
    <div className="overlay" role="presentation" onClick={onClose}>
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-title" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h3 id="dlg-title">{title}</h3>
        <p className="sub">{card.proposal}</p>
        {needsReason && (
          <label className="field" htmlFor="dlg-reason">Reason (required)
            <select id="dlg-reason" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
              {REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
        )}
        <label className="field" htmlFor="dlg-text">{action === "modify" ? "What you changed" : action === "reject" ? "Why" : "Note (optional)"}
          <textarea id="dlg-text" value={text} onChange={(e) => { setText(e.target.value); setErr(null); }} placeholder={action === "modify" ? "e.g. Add liquid biopsy: patient travels far" : ""} aria-invalid={!!err} aria-describedby={err ? "dlg-err" : undefined} />
          {err && <span id="dlg-err" className="err">{err}</span>}
        </label>
        <p className="footer-note">Signed as Dr. Demo (demo session). The entry is hash-chained to the previous one and cannot be edited.</p>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className={`btn ${action === "reject" ? "danger" : "primary"}`} disabled={saving}>{saving ? "Signing…" : action === "approve" ? "Approve and sign" : action === "modify" ? "Save modification" : "Reject"}</button>
        </div>
      </form>
    </div>
  );
}
