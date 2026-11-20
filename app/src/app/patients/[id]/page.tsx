import { notFound } from "next/navigation";
import Link from "next/link";
import { getPatient, patients, testedGenes, NSCLC_PANEL } from "@/lib/data/patients";
import { assessRecist, bestResponse } from "@/lib/clinical/recist";
import { snapshots } from "@/lib/snapshots";
import { structures } from "@/lib/data/structures";
import { fmtDate, monthsBetween } from "@/lib/format";
import { RecistChart, CtdnaChart } from "@/components/Charts";
import { AgentWorkspace } from "@/components/AgentWorkspace";
import { MoleculeViewer } from "@/components/MoleculeViewer";
import { SubNav } from "@/components/SubNav";
import { IconActivity, IconAtom, IconClock, IconDna, IconFlask, IconPill, IconPrinter, IconExternal } from "@/components/icons";

export function generateStaticParams() {
  return patients.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = getPatient(id);
  return { title: p ? `${p.displayName} · OncoAgent` : "Patient · OncoAgent" };
}

const SECTIONS = [
  { id: "summary", label: "Summary" },
  { id: "response", label: "Response" },
  { id: "agents", label: "Agents" },
  { id: "cards", label: "Recommendations" },
  { id: "timeline", label: "Timeline" },
  { id: "structure", label: "Structure" },
  { id: "trials", label: "Trials" },
];

const KIND_LABEL: Record<string, string> = { referral: "Referral", imaging: "Imaging", pathology: "Pathology", molecular: "Molecular", treatment: "Treatment", "tumor-board": "Tumour board", lab: "Lab", symptom: "Symptom", decision: "Decision" };

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = getPatient(id);
  if (!p) notFound();
  const recist = assessRecist(p.recist);
  const last = recist[recist.length - 1];
  const best = bestResponse(recist);
  const snap = snapshots[p.id];
  const tested = testedGenes(p);
  const untested = NSCLC_PANEL.filter((g) => !tested.includes(g));
  const structure = structures[p.id];
  const trials = snap.evidence.filter((e) => e.kind === "trial");
  const kinds = Array.from(new Set(p.events.map((e) => e.kind)));
  const insight = structure.insight.filter((s) => !structure.highlights.some((h) => s.startsWith(h.label)));

  return (
    <>
      <div className="row" aria-label="Switch patient">
        {patients.map((x) => (
          <Link key={x.id} href={`/patients/${x.id}`} className={`btn sm${x.id === p.id ? " primary" : ""}`} aria-current={x.id === p.id ? "page" : undefined}>
            {x.displayName} <span style={{ opacity: 0.7 }}>{x.id}</span>
          </Link>
        ))}
      </div>

      <section className="panel" id="summary" aria-labelledby="p-name">
        <div className="p-head">
          <div>
            <div className="row">
              <span className="chip amber">Fictional patient</span>
              <span className="chip">{p.id}</span>
              <span className="chip mint"><span className="dot" />{p.status}</span>
              {p.asOf && <span className="chip ghost" title="The fictional record is frozen at this date; freshness rules such as creatinine age are checked against it.">Record as of {fmtDate(p.asOf)}</span>}
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
              <span className="big" style={{ color: last.category === "PD" ? "#ff6f61" : "#17ff88" }}>{last.category}</span>
              <span className="foot">{last.sumMm} mm on {fmtDate(last.date)}{recist.length > 1 ? ` · best ${best}` : ""}</span>
            </div>
            <Link href={`/patients/${p.id}/report`} className="btn sm"><IconPrinter /> Tumour-board report</Link>
          </div>
        </div>
        <div className="facts">
          <div className="fact"><div className="k">Driver</div><div className="v">{p.variants.filter((v) => v.gene !== "TP53").map((v) => `${v.gene} ${v.alteration}`).join(" · ")}</div></div>
          <div className="fact"><div className="k">PD-L1 TPS</div><div className="v">{p.pdl1Tps !== undefined ? `${p.pdl1Tps}%` : "Not tested"}</div></div>
          <div className="fact"><div className="k">Medications</div><div className="v">{p.medications.map((m) => m.name.split(" ")[0]).join(", ")}</div></div>
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
        <p className="question"><span>Question for the agents</span>{p.question}</p>
      </section>

      <SubNav items={SECTIONS} />

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

      <AgentWorkspace patientId={p.id} patientName={p.displayName} snapshot={snap} />

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
          <section className="panel" id="structure" aria-labelledby="mol-t">
            <div className="panel-head"><h2 id="mol-t" className="panel-title"><IconAtom /> Structure insight · {structure.protein}</h2><span className="chip mint">PDB {structure.pdbId}</span></div>
            <MoleculeViewer structure={structure} />
            <p className="sub" style={{ marginTop: 12 }}>{structure.title}</p>
            <ul className="rc-why" style={{ marginTop: 6 }}>{insight.map((s) => <li key={s}>{s}</li>)}</ul>
          </section>
          <section className="panel" aria-labelledby="mol2-t">
            <div className="panel-head"><h2 id="mol2-t" className="panel-title"><IconFlask /> Molecular profile</h2><span className={`chip ${untested.length ? "amber" : "ghost"}`}>{tested.length}/{NSCLC_PANEL.length} panel markers</span></div>
            <div className="mtable">
              {p.variants.map((v) => (
                <div key={`${v.gene}${v.alteration}`} className="mrow">
                  <div><b>{v.gene} {v.alteration}</b>{v.hgvsP ? <span className="muted mono"> {v.hgvsP}</span> : null}<span className="muted"> · {v.kind}, {v.origin}</span></div>
                  <div className="mmeta"><span>{v.sample}</span><span className="mono">{v.vafPercent !== undefined ? `VAF ${v.vafPercent}%` : "—"}</span><span>{fmtDate(v.reportedOn)}</span></div>
                  {v.vafPercent !== undefined && <span className="vafbar" aria-hidden="true"><i style={{ width: `${Math.min(100, v.vafPercent * 2)}%` }} /></span>}
                </div>
              ))}
            </div>
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
          <p className="empty">No recruiting trial matched in the stored run.</p>
        )}
        <p className="footer-note" style={{ marginTop: 12 }}>Matched by biomarker from the ClinicalTrials.gov API v2 (stored run). Eligibility and site access are confirmed by the investigator.</p>
      </section>
    </>
  );
}
