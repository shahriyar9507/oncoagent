import Link from "next/link";
import type { EvidenceItem, Patient } from "@/lib/types";
import type { PipelineResult } from "@/lib/agents/pipeline";
import type { StructureInfo } from "@/lib/data/structures";
import type { CaseInput } from "@/lib/caseInput";
import { NSCLC_PANEL, testedGenes } from "@/lib/data/patients";
import { assessRecist, bestResponse } from "@/lib/clinical/recist";
import { fmtDate, monthsBetween } from "@/lib/format";
import { RecistChart, CtdnaChart } from "./Charts";
import { AgentWorkspace } from "./AgentWorkspace";
import { MoleculeViewer } from "./MoleculeViewer";
import { SubNav } from "./SubNav";
import { IconActivity, IconAtom, IconClock, IconDna, IconFlask, IconPill, IconPrinter, IconExternal, IconAlert } from "./icons";

const KIND_LABEL: Record<string, string> = { referral: "Referral", imaging: "Imaging", pathology: "Pathology", molecular: "Molecular", treatment: "Treatment", "tumor-board": "Tumour board", lab: "Lab", symptom: "Symptom", decision: "Decision" };

/**
 * The patient record screen, shared by the demo patients (server-rendered) and clinician-entered cases (rendered in
 * the browser). It holds no state of its own; the interactive parts are client components.
 */
export function PatientRecord({ p, snapshot, structure, trials, mode, caseInput, actions }: {
  p: Patient;
  snapshot: PipelineResult | null;
  structure?: StructureInfo;
  trials: EvidenceItem[];
  mode: "demo" | "case";
  caseInput?: CaseInput;
  actions?: React.ReactNode;
}) {
  const recist = assessRecist(p.recist);
  const last = recist[recist.length - 1];
  const best = recist.length ? bestResponse(recist) : undefined;
  const tested = testedGenes(p);
  const untested = NSCLC_PANEL.filter((g) => !tested.includes(g));
  const kinds = Array.from(new Set(p.events.map((e) => e.kind)));
  const insight = structure ? structure.insight.filter((s) => !structure.highlights.some((h) => s.startsWith(h.label))) : [];
  const reportHref = mode === "demo" ? `/patients/${p.id}/report` : `/cases/${p.id}/report`;
  const sections = [
    { id: "summary", label: "Summary" },
    { id: "response", label: "Response" },
    { id: "agents", label: "Agents" },
    { id: "cards", label: "Recommendations" },
    { id: "timeline", label: "Timeline" },
    ...(structure ? [{ id: "structure", label: "Structure" }] : []),
    { id: "trials", label: "Trials" },
  ];

  return (
    <>
      <section className="panel" id="summary" aria-labelledby="p-name">
        <div className="p-head">
          <div>
            <div className="row">
              {mode === "demo" ? <span className="chip amber">Fictional patient</span> : <span className="chip amber">Clinician-entered case · de-identified</span>}
              <span className="chip">{p.id}</span>
              <span className="chip mint"><span className="dot" />{p.status}</span>
              {p.asOf && <span className="chip ghost" title="Freshness rules such as creatinine age are checked against this date.">Record as of {fmtDate(p.asOf)}</span>}
            </div>
            <h1 id="p-name" className="p-name" style={{ marginTop: 10 }}>{p.displayName}</h1>
            <p className="p-meta">
              <span><b>{p.age}</b> years · {p.sex === "F" ? "female" : "male"}</span>
              <span>{p.smoking}</span>
              <span>{p.histology}</span>
              <span>Stage <b>{p.stage}</b></span>
              <span>ECOG <b>{p.ecog}</b></span>
            </p>
          </div>
          <div className="p-side">
            <div className="stat" style={{ textAlign: "right" }}>
              <span className="label">Latest RECIST 1.1</span>
              {last ? (
                <>
                  <span className="big" style={{ color: last.category === "PD" ? "#ff6f61" : "#17ff88" }}>{last.category}</span>
                  <span className="foot">{last.sumMm} mm on {fmtDate(last.date)}{recist.length > 1 && best ? ` · best ${best}` : ""}</span>
                </>
              ) : (
                <>
                  <span className="big muted" style={{ fontSize: 30 }}>—</span>
                  <span className="foot">no measurements entered</span>
                </>
              )}
            </div>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              {actions}
              <Link href={reportHref} className="btn sm"><IconPrinter /> Tumour-board report</Link>
            </div>
          </div>
        </div>
        <div className="facts">
          <div className="fact"><div className="k">Driver</div><div className="v">{p.variants.filter((v) => !["TP53", "STK11", "KEAP1"].includes(v.gene)).map((v) => `${v.gene} ${v.alteration}`).join(" · ") || "None reported"}</div></div>
          <div className="fact"><div className="k">PD-L1 TPS</div><div className="v">{p.pdl1Tps !== undefined ? `${p.pdl1Tps}%` : "Not tested"}</div></div>
          <div className="fact"><div className="k">Medications</div><div className="v">{p.medications.map((m) => m.name.split(" ")[0]).join(", ") || "None entered"}</div></div>
          <div className="fact"><div className="k">Kidney · body</div><div className="v">Creatinine {p.serumCreatinineMgDl} mg/dL ({fmtDate(p.creatinineDate)}) · {p.weightKg} kg · {p.heightCm} cm</div></div>
        </div>
        <div className="lines" aria-label="Therapy lines">
          <span className="eyebrow">Therapy</span>
          {p.therapyLines.length === 0 ? (
            <span className="line-pill none">Treatment-naive · first-line decision pending</span>
          ) : (
            p.therapyLines.map((l) => (
              <span key={l.line} className="line-pill">
                <b>Line {l.line}</b> {l.regimen} · {fmtDate(l.start)} → {l.end ? fmtDate(l.end) : "ongoing"}
                {l.end ? ` · ${monthsBetween(l.start, l.end)} months` : ""}{l.bestResponse ? ` · best ${l.bestResponse.toLowerCase()}` : ""}{l.stopReason ? ` · stopped: ${l.stopReason.toLowerCase()}` : ""}
              </span>
            ))
          )}
          {p.medications.filter((m) => m.tags.length).map((m) => (
            <span key={m.name} className="line-pill warn" title={m.indication}>{m.name.split(" ")[0]}: {m.tags.join(", ").replace(/-/g, " ")}</span>
          ))}
        </div>
        {mode === "case" && !p.biomarkerKey && p.knowledgeReason && (
          <p className="critic flag" style={{ marginTop: 12 }}><IconAlert width={14} height={14} style={{ verticalAlign: -2 }} /> Knowledge pack: {p.knowledgeReason} The agents will not propose a treatment automatically.</p>
        )}
        <p className="question"><span>Question for the agents</span>{p.question}</p>
      </section>

      <SubNav items={sections} />

      <div className="grid g2" id="response">
        <section className="panel" aria-labelledby="recist-t">
          <div className="panel-head"><h2 id="recist-t" className="panel-title"><IconActivity /> Tumour size · RECIST 1.1</h2><span className="chip ghost">calculated</span></div>
          <RecistChart points={recist} />
        </section>
        <section className="panel" aria-labelledby="ct-t">
          <div className="panel-head"><h2 id="ct-t" className="panel-title"><IconDna /> Circulating tumour DNA</h2><span className="chip ghost">liquid biopsy</span></div>
          <CtdnaChart points={p.ctdna} />
        </section>
      </div>

      <AgentWorkspace patientId={p.id} patientName={p.displayName} snapshot={snapshot} caseInput={caseInput} reportHref={reportHref} />

      <div className="split" id="timeline">
        <section className="panel" aria-labelledby="tl-t">
          <div className="panel-head">
            <h2 id="tl-t" className="panel-title"><IconClock /> Patient timeline</h2>
            <span className="chip ghost">{p.events.length} events</span>
          </div>
          <div className="tl-legend">
            {kinds.map((k) => <span key={k}><i className={`node ${k}`} />{KIND_LABEL[k] ?? k}</span>)}
          </div>
          <ol className="timeline">
            {[...p.events].reverse().map((e) => (
              <li key={e.id}>
                <span className="when">{fmtDate(e.date)}</span>
                <span className={`node ${e.kind}`} aria-hidden="true" />
                <span className="what"><b>{e.title}</b><span>{e.detail}</span><em>{e.source} · pt:{e.id}</em></span>
              </li>
            ))}
          </ol>
        </section>
        <div className="stack">
          {structure ? (
            <section className="panel" id="structure" aria-labelledby="mol-t">
              <div className="panel-head"><h2 id="mol-t" className="panel-title"><IconAtom /> Structure insight · {structure.protein}</h2><span className="chip mint">PDB {structure.pdbId}</span></div>
              <MoleculeViewer structure={structure} />
              <p className="sub" style={{ marginTop: 12 }}>{structure.title}</p>
              <ul className="rc-why" style={{ marginTop: 6 }}>{insight.map((s) => <li key={s}>{s}</li>)}</ul>
            </section>
          ) : (
            <section className="panel" aria-labelledby="mol-t">
              <div className="panel-head"><h2 id="mol-t" className="panel-title"><IconAtom /> Structure insight</h2></div>
              <p className="empty" style={{ padding: 16 }}>No verified 3D scene for this driver yet. Scenes exist for EGFR, KRAS G12C and ALK.</p>
            </section>
          )}
          <section className="panel" aria-labelledby="mol2-t">
            <div className="panel-head"><h2 id="mol2-t" className="panel-title"><IconFlask /> Molecular profile</h2><span className={`chip ${untested.length ? "amber" : "ghost"}`}>{tested.length}/{NSCLC_PANEL.length} panel markers</span></div>
            {p.variants.length ? (
              <div className="mtable">
                {p.variants.map((v) => (
                  <div key={`${v.gene}${v.alteration}`} className="mrow">
                    <div><b>{v.gene} {v.alteration}</b>{v.hgvsP ? <span className="muted mono"> {v.hgvsP}</span> : null}<span className="muted"> · {v.kind}, {v.origin}</span></div>
                    <div className="mmeta"><span>{v.sample}</span><span className="mono">{v.vafPercent !== undefined ? `VAF ${v.vafPercent}%` : "—"}</span><span>{fmtDate(v.reportedOn)}</span></div>
                    {v.vafPercent !== undefined && <span className="vafbar" aria-hidden="true"><i style={{ width: `${Math.min(100, v.vafPercent * 2)}%` }} /></span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty" style={{ padding: 12 }}>No reportable alteration entered.</p>
            )}
            <div className="panel-genes" aria-label="Guideline biomarker panel">
              {NSCLC_PANEL.map((g) => <span key={g} className={`gene${tested.includes(g) ? " on" : ""}`}>{g}</span>)}
            </div>
            {untested.length > 0 && <p className="footer-note" style={{ marginTop: 8 }}>Not yet reported: {untested.join(", ")}. The Test-advisor proposes these.</p>}
          </section>
        </div>
      </div>

      <section className="panel" id="trials" aria-labelledby="tr-t">
        <div className="panel-head">
          <h2 id="tr-t" className="panel-title"><IconPill /> Recruiting trials · {p.trialQuery.term}</h2>
          <a className="btn sm" href={`https://clinicaltrials.gov/search?cond=${encodeURIComponent(p.trialQuery.condition)}&term=${encodeURIComponent(p.trialQuery.term)}&aggFilters=status:rec`} target="_blank" rel="noreferrer"><IconExternal /> ClinicalTrials.gov</a>
        </div>
        {trials.length ? (
          <div className="trial-grid">
            {trials.map((t) => (
              <a key={t.id} href={t.url} target="_blank" rel="noreferrer" className="trial">
                <span className="row" style={{ justifyContent: "space-between" }}>
                  <span className="mono nct">{t.id.replace("trial:", "")}</span>
                  <span className="chip mint">{t.label.split(" · ").slice(1).join(" · ").toLowerCase()}</span>
                </span>
                <span className="tdet">{t.detail}</span>
              </a>
            ))}
          </div>
        ) : (
          <p className="empty">{mode === "case" ? "Run the agents: the Trial-matcher searches ClinicalTrials.gov live and lists matches in its card." : "No recruiting trial matched in the stored run."}</p>
        )}
        <p className="footer-note" style={{ marginTop: 12 }}>Matched by biomarker from the ClinicalTrials.gov API v2. Eligibility and site access are confirmed by the investigator.</p>
      </section>
    </>
  );
}
