"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AuditEntry, DecisionAction, EvidenceItem, RecommendationCard } from "@/lib/types";
import type { PipelineResult, StepEvent } from "@/lib/agents/pipeline";
import { appendAudit } from "@/lib/audit";
import { clearRun, saveRun } from "@/lib/runs";
import { useAudit, useStoredRun } from "@/lib/hooks";
import { fmtDateTime, fmtNum } from "@/lib/format";
import { DecisionDialog, toast } from "./DecisionDialog";
import type { CaseInput } from "@/lib/caseInput";
import { IconAlert, IconCalc, IconCheck, IconChevronDown, IconEdit, IconExternal, IconFile, IconFlask, IconHistory, IconPill, IconPlay, IconPrinter, IconRefresh, IconShield, IconSpark, IconX, IconActivity, IconDna } from "./icons";

export const AGENTS = ["Sentinel", "Genomic-interpreter", "Test-advisor", "Guideline", "Pharmacology-safety", "Trial-matcher", "Dose-optimizer", "Synthesis (Claude)", "Safety-critic"];
const AGENT_JOB: Record<string, string> = {
  Sentinel: "RECIST 1.1 and ctDNA trend",
  "Genomic-interpreter": "CIViC evidence per alteration",
  "Test-advisor": "Missing biomarkers and tests",
  Guideline: "Ranked options from the pack",
  "Pharmacology-safety": "Interactions with current drugs",
  "Trial-matcher": "Recruiting trials by biomarker",
  "Dose-optimizer": "BSA, CrCl and Calvert",
  "Synthesis (Claude)": "Tumour-board pre-read",
  "Safety-critic": "Checks every card",
};

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

export const EVIDENCE_KINDS: { kind: EvidenceItem["kind"]; label: string }[] = [
  { kind: "patient", label: "Patient record" },
  { kind: "guideline", label: "Knowledge pack" },
  { kind: "civic", label: "CIViC" },
  { kind: "trial", label: "Trials" },
  { kind: "label", label: "Drug labels" },
  { kind: "calculator", label: "Calculators" },
];

function kindIcon(kind: RecommendationCard["kind"]) {
  const p = { width: 14, height: 14 };
  if (kind === "dose") return <IconCalc {...p} />;
  if (kind === "test") return <IconFlask {...p} />;
  if (kind === "safety") return <IconAlert {...p} />;
  if (kind === "trial") return <IconPill {...p} />;
  if (kind === "monitoring") return <IconActivity {...p} />;
  if (kind === "summary") return <IconDna {...p} />;
  return <IconSpark {...p} />;
}

export function AgentWorkspace({ patientId, patientName, snapshot, caseInput, reportHref }: { patientId: string; patientName: string; snapshot: PipelineResult | null; caseInput?: CaseInput; reportHref?: string }) {
  const stored = useStoredRun(patientId);
  // Fallback when browser storage is blocked: keep the finished run on screen for this visit.
  const [sessionRun, setSessionRun] = useState<PipelineResult | null>(null);
  const current = stored ?? sessionRun ?? snapshot;
  const hasRun = current !== null;
  const result: PipelineResult = current ?? { patientId, ranAt: "", mode: "rules-only", steps: [], evidence: [], cards: [], warnings: [] };
  const report = reportHref ?? `/patients/${patientId}/report`;
  const isLive = stored !== null || sessionRun !== null;
  const [running, setRunning] = useState(false);
  const [live, setLive] = useState<StepEvent[] | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [useClaude, setUseClaude] = useState(true);
  const [filter, setFilter] = useState("all");
  const [expandAll, setExpandAll] = useState(false);
  const [drawer, setDrawer] = useState<{ title: string; ids: string[]; focus?: string } | null>(null);
  const [dialog, setDialog] = useState<{ card: RecommendationCard; action: DecisionAction } | null>(null);
  const { audit, decisions, chainOk } = useAudit();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

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
    const t0 = performance.now();
    setElapsed(0);
    timer.current = setInterval(() => setElapsed((performance.now() - t0) / 1000), 100);
    try {
      const res = await fetch("/api/agents/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(caseInput ? { caseId: patientId, caseInput, useClaude } : { patientId, useClaude }) });
      if (!res.ok || !res.body) {
        let msg = `Run failed (HTTP ${res.status})`;
        try {
          const j = (await res.json()) as { error?: string; issues?: string[] };
          if (j.error) msg = j.issues?.length ? `${j.error}: ${j.issues.join("; ")}` : j.error;
        } catch {
          /* not JSON */
        }
        throw new Error(msg);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let final: PipelineResult | null = null;
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
          else if (msg.type === "result") final = msg.result;
          else if (msg.type === "error") throw new Error(msg.message);
        }
      }
      if (!final) throw new Error("The run ended without a result");
      saveRun(final);
      setSessionRun(final);
      setFilter("all");
      await appendAudit({ actor: "Dr. Demo", action: "agent-run", patientId, reasonText: useClaude ? "Live run with Claude synthesis" : "Live rules-only run" });
      const flagged = final.cards.filter((c) => c.critic.verdict === "flag").length;
      toast(`Run finished in ${((performance.now() - t0) / 1000).toFixed(1)} s · ${final.cards.length} cards${flagged ? ` · ${flagged} flagged` : ""}`, flagged ? "amber" : "mint");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      setRunning(false);
      setLive(null);
    }
  }

  function restoreStored() {
    clearRun(patientId);
    setSessionRun(null);
    toast("Showing the stored run again");
  }

  const steps = live ?? result.steps;
  const doneNames = new Set(steps.map((s) => s.agent));
  const nextAgent = AGENTS.find((a) => !doneNames.has(a));
  const flagged = result.cards.filter((c) => c.critic.verdict === "flag").length;
  const pending = result.cards.filter((c) => !decisions[c.id]).length;
  const progress = running ? Math.min(1, (live?.length ?? 0) / AGENTS.length) : 1;
  const totalMs = result.steps.reduce((a, s) => a + s.ms, 0);

  return (
    <div className="stack">
      <section className="panel glow" id="agents" aria-labelledby="agents-title">
        <div className="panel-head">
          <div>
            <h2 id="agents-title" className="panel-title"><IconSpark /> Agent run</h2>
            <p className="sub" style={{ marginTop: 4 }}>
              {running ? (
                <>Agents are working · <span className="mono">{elapsed.toFixed(1)} s</span>{nextAgent ? <> · now: <b style={{ color: "var(--text)" }}>{nextAgent}</b></> : null}</>
              ) : !hasRun ? (
                <>No run yet. Press <b style={{ color: "var(--text)" }}>Run agents live</b>: nine agents will read this case (about 2 s rules-only, about 25 s with Claude).</>
              ) : (
                <>
                  <span className={`chip ${isLive ? "mint" : "ghost"}`} style={{ marginRight: 8 }}>{isLive ? "Live run" : "Stored run"}</span>
                  {fmtDateTime(result.ranAt)} · {result.mode === "claude" ? <>synthesis by <span className="mono">{result.model}</span></> : "rules only"}
                  {result.usage ? ` · ${fmtNum(result.usage.inputTokens)} in / ${fmtNum(result.usage.outputTokens)} out tokens` : ""} · {(totalMs / 1000).toFixed(1)} s
                </>
              )}
            </p>
          </div>
          <div className="row">
            <label className="chip toggle">
              <input type="checkbox" checked={useClaude} onChange={(e) => setUseClaude(e.target.checked)} disabled={running} />
              Claude synthesis
            </label>
            {isLive && !running && snapshot && <button type="button" className="btn sm" onClick={restoreStored} title="Discard the live run in this browser and show the stored run"><IconHistory /> Stored run</button>}
            <button type="button" className="btn primary" onClick={runLive} disabled={running} aria-describedby="run-hint">
              {running ? <IconRefresh className="spin" /> : <IconPlay />} {running ? "Running…" : "Run agents live"}
            </button>
          </div>
        </div>
        <p id="run-hint" className="sr-only">Runs nine agents on this fictional case. With Claude synthesis a run takes about 25 seconds.</p>

        <div className="progress" aria-hidden={!running}><span style={{ width: `${progress * 100}%`, opacity: running ? 1 : 0 }} /></div>

        <ol className="steps" aria-live="polite" aria-label="Agent steps">
          {AGENTS.map((name, i) => {
            const s = steps.find((x) => x.agent === name);
            const isRunning = running && nextAgent === name;
            const cls = s ? s.status : isRunning ? "running" : running ? "queued" : "";
            return (
              <li key={name} className={`stepc ${cls}`} title={s?.note || AGENT_JOB[name]}>
                <span className="n">
                  <span className={`dot${!s ? (isRunning ? " pulse" : " off") : s.status === "error" ? " red" : s.status === "skipped" ? " amber" : ""}`} />
                  <span className="i">{i + 1}</span>{name}
                </span>
                <span className="note">{s ? (s.note || AGENT_JOB[name]) : AGENT_JOB[name]}</span>
                <span className="t">{s ? (s.status === "skipped" ? "skipped" : `${fmtNum(s.ms)} ms`) : isRunning ? "working…" : running ? "queued" : "—"}</span>
              </li>
            );
          })}
        </ol>

        {error && (
          <p className="critic flag" style={{ marginTop: 12 }} role="alert">
            <IconAlert width={14} height={14} style={{ verticalAlign: -2 }} /> {error}. The previous run is still shown.
            {useClaude && <button type="button" className="link-btn" onClick={() => setUseClaude(false)}>Switch to rules only</button>}
          </p>
        )}
        {result.warnings.length > 0 && !running && (
          <p className="critic flag" style={{ marginTop: 12 }}><IconAlert width={14} height={14} style={{ verticalAlign: -2 }} /> {result.warnings.join(" ")}</p>
        )}

        {result.boardSummary && (
          <div style={{ marginTop: 16 }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <p className="eyebrow">Tumour-board pre-read · AI draft</p>
              <Link href={report} className="btn sm"><IconPrinter /> Tumour-board report</Link>
            </div>
            <p className="summary-box">{result.boardSummary}</p>
          </div>
        )}
        {hasRun && <div className="row" style={{ marginTop: 14 }}>
          <span className="chip mint"><span className="dot" /> {result.cards.length} cards</span>
          <span className={`chip ${pending ? "" : "mint"}`}>{pending ? `${pending} awaiting decision` : "all decided"}</span>
          <span className={`chip ${flagged ? "amber" : "mint"}`}><IconShield /> Safety-critic: {flagged ? `${flagged} flagged` : "all passed"}</span>
          <button type="button" className="chip ghost as-btn" onClick={() => setDrawer({ title: "All evidence", ids: result.evidence.map((e) => e.id) })}>{result.evidence.length} evidence items</button>
        </div>}
      </section>

      {!hasRun ? (
        <section className="panel" id="cards">
          <div className="empty-state">
            <p><b>Recommendations appear here after the first run.</b></p>
            <p className="sub">Each card will cite its evidence, show its confidence and wait for your approve, modify or reject. Nothing is stored on the server; the run is kept in this browser.</p>
          </div>
        </section>
      ) : (
      <div className="split work" id="cards">
        <section className="stack" aria-label="Recommendation cards">
          <div className="toolbar">
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
            <button type="button" className="btn sm ghost-btn" onClick={() => setExpandAll(!expandAll)} aria-pressed={expandAll}>
              <IconChevronDown style={{ transform: expandAll ? "rotate(180deg)" : undefined }} /> {expandAll ? "Collapse all" : "Expand all"}
            </button>
          </div>
          {cards.map((c) => (
            <Card
              key={c.id}
              card={c}
              forceOpen={expandAll}
              evidence={evidenceById}
              decision={decisions[c.id]}
              onEvidence={(focus) => setDrawer({ title: "Evidence for this card", ids: c.evidenceIds, focus })}
              onDecide={(action) => setDialog({ card: c, action })}
            />
          ))}
        </section>

        <aside className="stack" aria-label="Dose, evidence and audit">
          {result.dose && <DoseView dose={result.dose} />}
          <EvidencePanel evidence={result.evidence} onOpen={(id) => setDrawer({ title: "Evidence", ids: result.evidence.map((e) => e.id), focus: id })} />
          <AuditPanel entries={patientAudit} chainOk={chainOk} />
        </aside>
      </div>
      )}

      {drawer && <EvidenceDrawer title={drawer.title} items={drawer.ids.map((id) => evidenceById.get(id) ?? { id, kind: "patient" as const, label: "Unknown evidence", detail: "This ID is not in the run's evidence registry." })} focus={drawer.focus} onClose={() => setDrawer(null)} />}
      {dialog && <DecisionDialog card={dialog.card} action={dialog.action} patientId={patientId} patientName={patientName} onClose={() => setDialog(null)} />}
    </div>
  );
}

function Card({ card, forceOpen, evidence, decision, onEvidence, onDecide }: { card: RecommendationCard; forceOpen: boolean; evidence: Map<string, EvidenceItem>; decision?: AuditEntry; onEvidence: (id?: string) => void; onDecide: (a: DecisionAction) => void }) {
  const [open, setOpen] = useState(false);
  const show = open || forceOpen;
  const level = card.confidence === "high" ? 3 : card.confidence === "moderate" ? 2 : 1;
  const verb = decision ? (decision.action === "approve" ? "Approved" : decision.action === "modify" ? "Modified" : "Rejected") : null;
  const sources = new Set(card.evidenceIds.map((id) => evidence.get(id)?.kind ?? "patient"));
  return (
    <article className={`rc${card.origin === "claude" ? " claude" : ""}${decision ? ` decided-${decision.action}` : ""}${card.critic.verdict === "flag" ? " flagged" : ""}`}>
      <div className="rc-head">
        <span className={`chip ${card.origin === "claude" ? "solid" : "mint"}`}>{kindIcon(card.kind)}{card.origin === "claude" ? "Claude" : card.agent}</span>
        <span className="chip">{card.kind === "summary" ? "molecular" : card.kind}</span>
        {card.critic.verdict === "flag" ? <span className="chip amber"><IconAlert /> critic flag</span> : <span className="chip ghost"><IconShield /> critic passed</span>}
        {verb && <span className={`chip ${decision!.action === "reject" ? "red" : "mint"}`}>{verb}</span>}
        <span className="conf" title={`Confidence: ${card.confidence}. ${card.confidenceReason}`}>
          <span className="meter" aria-hidden="true">{[1, 2, 3].map((i) => <i key={i} className={i <= level ? "on" : ""} />)}</span>{card.confidence}
        </span>
      </div>
      <p className="rc-proposal">{card.proposal}</p>
      {card.why.length > 0 && <ul className="rc-why">{(show ? card.why : card.why.slice(0, 3)).map((w, i) => <li key={i}>{w}</li>)}</ul>}

      {card.critic.verdict === "flag" && <p className="critic flag"><IconAlert width={14} height={14} style={{ verticalAlign: -2 }} /> Safety-critic: {card.critic.notes.join(" ")}</p>}

      {show && (
        <div className="rc-grid">
          <span className="k">Evidence</span>
          <span className="v ev">
            {card.evidenceIds.map((id) => {
              const e = evidence.get(id);
              return (
                <button key={id} type="button" className={`chip ev-${e?.kind ?? "x"}`} onClick={() => onEvidence(id)} title={e ? `${e.label}: ${e.detail}` : "Unknown evidence"}>
                  {id}
                </button>
              );
            })}
          </span>
          <span className="k">Confidence</span>
          <span className="v">{card.confidence} · {card.confidenceReason}</span>
          <span className="k">Uncertain</span>
          <span className="v">{card.uncertain}</span>
          {card.alternatives.length > 0 && (<><span className="k">Alternatives</span><span className="v">{card.alternatives.join(" · ")}</span></>)}
          {card.changesIf && (<><span className="k">Changes if</span><span className="v">{card.changesIf}</span></>)}
          {card.safety.length > 0 && (<><span className="k">Safety</span><span className="v">{card.safety.join(" · ")}</span></>)}
          <span className="k">Critic</span>
          <span className="v">{card.critic.verdict === "pass" ? "Every cited source exists in the registry; no unsourced drug, trial or dose." : card.critic.notes.join(" ")}</span>
        </div>
      )}

      <div className="rc-foot">
        <button type="button" className="link-btn" onClick={() => onEvidence()} aria-label={`Open ${card.evidenceIds.length} evidence items for this card`}>
          <IconFile width={14} height={14} /> {card.evidenceIds.length} sources · {sources.size} {sources.size === 1 ? "type" : "types"}
        </button>
        {!forceOpen && (
          <button type="button" className="link-btn" onClick={() => setOpen(!open)} aria-expanded={show}>
            <IconChevronDown width={14} height={14} style={{ transform: show ? "rotate(180deg)" : undefined }} /> {show ? "Less" : "Reasoning, uncertainty and alternatives"}
          </button>
        )}
      </div>

      <div className="rc-actions">
        {decision ? (
          <p className="decision">
            <b>{verb}</b> by {decision.actor} · {fmtDateTime(decision.at)}
            {decision.reasonCode ? ` · ${decision.reasonCode}` : ""}{decision.reasonText ? ` · “${decision.reasonText}”` : ""}
            <span className="mono muted"> · #{decision.seq}</span>
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

function EvidencePanel({ evidence, onOpen }: { evidence: EvidenceItem[]; onOpen: (id: string) => void }) {
  const [kind, setKind] = useState<EvidenceItem["kind"] | "all">("all");
  const [all, setAll] = useState(false);
  const list = evidence.filter((e) => kind === "all" || e.kind === kind);
  const shown = all ? list : list.slice(0, 5);
  return (
    <section className="panel">
      <div className="panel-head"><h3 className="panel-title"><IconFile /> Evidence registry</h3><span className="chip ghost">{evidence.length}</span></div>
      <div className="row" style={{ gap: 6, marginBottom: 12 }}>
        <button type="button" className={`chip as-btn${kind === "all" ? " mint" : ""}`} onClick={() => { setKind("all"); setAll(false); }}>All</button>
        {EVIDENCE_KINDS.map((k) => {
          const n = evidence.filter((e) => e.kind === k.kind).length;
          if (!n) return null;
          return <button key={k.kind} type="button" className={`chip as-btn${kind === k.kind ? " mint" : ""}`} onClick={() => { setKind(k.kind); setAll(false); }}>{k.label} {n}</button>;
        })}
      </div>
      <div className="evidence-list">
        {shown.map((e) => (
          <button key={e.id} type="button" className="evi as-btn" onClick={() => onOpen(e.id)}>
            <span className="id">{e.id}</span>
            <b>{e.label}</b>
            <span className="clamp">{e.detail}</span>
          </button>
        ))}
      </div>
      {list.length > 5 && <button type="button" className="link-btn" style={{ marginTop: 10 }} onClick={() => setAll(!all)}>{all ? "Show fewer" : `Show all ${list.length}`}</button>}
    </section>
  );
}

function AuditPanel({ entries, chainOk }: { entries: AuditEntry[]; chainOk: boolean | null }) {
  const [all, setAll] = useState(false);
  const rev = [...entries].reverse();
  const shown = all ? rev : rev.slice(0, 4);
  return (
    <section className="panel" id="audit">
      <div className="panel-head">
        <h3 className="panel-title"><IconShield /> Audit log</h3>
        <span className={`chip ${chainOk === false ? "red" : "mint"}`}>{chainOk === null ? "checking" : chainOk ? "hash chain intact" : "chain broken"}</span>
      </div>
      {entries.length === 0 ? (
        <p className="empty" style={{ padding: 12 }}>No entries yet. Run the agents or decide a card to write the first one.</p>
      ) : (
        <ol className="audit-list">
          {shown.map((a) => (
            <li key={a.seq} className={`aud ${a.action}`}>
              <span className="aud-dot" aria-hidden="true" />
              <div>
                <b>#{a.seq} · {a.action === "agent-run" ? "agent run" : a.action}{a.reasonCode ? ` · ${a.reasonCode}` : ""}</b>
                <span>{a.actor} · {fmtDateTime(a.at)}{a.reasonText ? ` · “${a.reasonText}”` : ""}</span>
                <span className="id">sha256 {a.hash.slice(0, 12)}… ← {a.prevHash.slice(0, 8)}…</span>
              </div>
            </li>
          ))}
        </ol>
      )}
      {entries.length > 4 && <button type="button" className="link-btn" style={{ marginTop: 8 }} onClick={() => setAll(!all)}>{all ? "Show fewer" : `Show all ${entries.length}`}</button>}
      <p className="footer-note" style={{ marginTop: 10 }}>Demo log lives in this browser. Production writes the same hash-chained rows to an append-only table.</p>
    </section>
  );
}

function EvidenceDrawer({ title, items, focus, onClose }: { title: string; items: EvidenceItem[]; focus?: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.classList.add("modal-open");
    ref.current?.focus();
    if (focus) setTimeout(() => document.getElementById(`dr-${focus}`)?.scrollIntoView({ block: "center" }), 60);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("modal-open");
    };
  }, [focus, onClose]);
  const groups = EVIDENCE_KINDS.map((k) => ({ ...k, items: items.filter((e) => e.kind === k.kind) })).filter((g) => g.items.length);
  return (
    <div className="overlay drawer-overlay" role="presentation" onClick={onClose}>
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="dr-title" tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <p className="eyebrow">{items.length} items</p>
            <h3 id="dr-title">{title}</h3>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close evidence"><IconX /></button>
        </div>
        <div className="drawer-body">
          {groups.map((g) => (
            <div key={g.kind} className="stack" style={{ gap: 8 }}>
              <p className="eyebrow">{g.label} · {g.items.length}</p>
              {g.items.map((e) => (
                <div key={e.id} id={`dr-${e.id}`} className={`evi${focus === e.id ? " hl" : ""}`}>
                  <span className="id">{e.id}</span>
                  <b>{e.label}</b>
                  <span>{e.detail}</span>
                  {e.url && <a href={e.url} target="_blank" rel="noreferrer" className="src"><IconExternal width={12} height={12} /> Open source</a>}
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="footer-note drawer-foot">Every claim on a card must cite one of these IDs; the safety-critic rejects any other.</p>
      </div>
    </div>
  );
}

function DoseView({ dose }: { dose: NonNullable<PipelineResult["dose"]> }) {
  const blocked = dose.blocks.length > 0;
  return (
    <section className={`panel ${blocked ? "" : "glow"}`} id="dose">
      <div className="panel-head">
        <h3 className="panel-title"><IconCalc /> Dose card</h3>
        {blocked ? <span className="chip red">blocked</span> : <span className="chip mint">calculated · verify</span>}
      </div>
      <p className="sub">{dose.regimenName}</p>
      <div className="grid g2" style={{ marginTop: 12 }}>
        <div className="stat"><span className="label">Body surface area</span><span className="big" style={{ fontSize: 34 }}>{dose.bsa.toFixed(2)}<small>m²</small></span><span className="foot">Mosteller</span></div>
        <div className="stat"><span className="label">Creatinine clearance</span><span className="big" style={{ fontSize: 34 }}>{dose.crcl.toFixed(0)}<small>mL/min</small></span><span className="foot">Cockcroft–Gault</span></div>
      </div>
      <div className="dose-lines">
        {dose.lines.map((l) => (
          <div key={l.drug} className="dl">
            <div className="dl-top"><b>{l.drug}</b><span className={`dl-dose${blocked ? " withheld" : ""}`}>{blocked ? "withheld" : l.text}</span></div>
            <p className="dl-f">{l.formula}{l.raw !== undefined ? ` = ${l.raw.toFixed(1)} mg` : ""}</p>
            <p className="dl-s">{l.schedule} · <a href={l.url} target="_blank" rel="noreferrer">{l.source}</a></p>
          </div>
        ))}
      </div>
      {dose.blocks.map((b) => <p key={b} className="critic flag" style={{ marginTop: 8 }}>{b}</p>)}
      {dose.warnings.map((w) => <p key={w} className="critic flag" style={{ marginTop: 8 }}>{w}</p>)}
      {dose.premedication.length > 0 && (
        <>
          <p className="eyebrow" style={{ marginTop: 14 }}>Premedication</p>
          <ul className="rc-why" style={{ marginTop: 6 }}>{dose.premedication.map((m) => <li key={m}>{m}</li>)}</ul>
        </>
      )}
      <p className="footer-note" style={{ marginTop: 10 }}>{dose.asOf}. Deterministic formulas with unit tests; the language model never writes a dose. A pharmacist verifies before prescribing.</p>
    </section>
  );
}
