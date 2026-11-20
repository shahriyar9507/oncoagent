import { notFound } from "next/navigation";
import Link from "next/link";
import { getPatient, patients, testedGenes } from "@/lib/data/patients";
import { assessRecist } from "@/lib/clinical/recist";
import { snapshots } from "@/lib/snapshots";
import { structures } from "@/lib/data/structures";
import { RecistChart, CtdnaChart } from "@/components/Charts";
import { AgentWorkspace } from "@/components/AgentWorkspace";
import { MoleculeViewer } from "@/components/MoleculeViewer";
import { IconActivity, IconAtom, IconClock, IconDna, IconFlask, IconPill } from "@/components/icons";

export function generateStaticParams() {
  return patients.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = getPatient(id);
  return { title: p ? `${p.displayName} · OncoAgent` : "Patient · OncoAgent" };
}

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = getPatient(id);
  if (!p) notFound();
  const recist = assessRecist(p.recist);
  const last = recist[recist.length - 1];
  const snap = snapshots[p.id];
  const tested = testedGenes(p);
  const structure = structures[p.id];
  const trials = snap.evidence.filter((e) => e.kind === "trial");

  return (
    <>
      <div className="row" aria-label="Switch patient">
        {patients.map((x) => (
          <Link key={x.id} href={`/patients/${x.id}`} className={`btn sm${x.id === p.id ? " primary" : ""}`} aria-current={x.id === p.id ? "page" : undefined}>
            {x.displayName} <span style={{ opacity: 0.7 }}>{x.id}</span>
          </Link>
        ))}
      </div>

      <section className="panel" aria-labelledby="p-name">
        <div className="p-head">
          <div>
            <div className="row">
              <span className="chip amber">Fictional patient</span>
              <span className="chip">{p.id}</span>
              <span className="chip mint"><span className="dot" />{p.status}</span>
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
          <div className="stat" style={{ textAlign: "right" }}>
            <span className="label">Latest RECIST</span>
            <span className="big" style={{ color: last.category === "PD" ? "#ff6f61" : "#17ff88" }}>{last.category}</span>
            <span className="foot">{last.sumMm} mm on {last.date}</span>
          </div>
        </div>
        <div className="facts">
          <div className="fact"><div className="k">Driver</div><div className="v">{p.variants.filter((v) => v.gene !== "TP53").map((v) => `${v.gene} ${v.alteration}`).join(" · ")}</div></div>
          <div className="fact"><div className="k">PD-L1 TPS</div><div className="v">{p.pdl1Tps !== undefined ? `${p.pdl1Tps}%` : "Not tested"}</div></div>
          <div className="fact"><div className="k">Medications</div><div className="v">{p.medications.map((m) => m.name.split(" ")[0]).join(", ")}</div></div>
          <div className="fact"><div className="k">Kidney · body</div><div className="v">Creatinine {p.serumCreatinineMgDl} mg/dL · {p.weightKg} kg · {p.heightCm} cm</div></div>
        </div>
        <p className="question"><span>Question for the agents</span>{p.question}</p>
      </section>

      <div className="grid g2">
        <section className="panel" aria-labelledby="recist-t">
          <div className="panel-head"><h2 id="recist-t" className="panel-title"><IconActivity /> Tumour size · RECIST 1.1</h2><span className="chip ghost">calculated</span></div>
          <RecistChart points={recist} />
        </section>
        <section className="panel" aria-labelledby="ct-t">
          <div className="panel-head"><h2 id="ct-t" className="panel-title"><IconDna /> Circulating tumour DNA</h2><span className="chip ghost">liquid biopsy</span></div>
          <CtdnaChart points={p.ctdna} />
        </section>
      </div>

      <AgentWorkspace patientId={p.id} snapshot={snap} />

      <div className="split">
        <section className="panel" aria-labelledby="tl-t">
          <div className="panel-head"><h2 id="tl-t" className="panel-title"><IconClock /> Patient timeline</h2><span className="chip ghost">{p.events.length} events</span></div>
          <ol className="timeline">
            {[...p.events].reverse().map((e) => (
              <li key={e.id}>
                <span className="when">{e.date}</span>
                <span className={`node ${e.kind}`} aria-hidden="true" />
                <span className="what"><b>{e.title}</b><span>{e.detail}</span><br /><span className="muted" style={{ fontSize: 11.5 }}>{e.source}</span></span>
              </li>
            ))}
          </ol>
        </section>
        <div className="stack">
          <section className="panel" aria-labelledby="mol-t">
            <div className="panel-head"><h2 id="mol-t" className="panel-title"><IconAtom /> Structure insight · {structure.protein}</h2><a className="chip mint" href={`https://www.rcsb.org/structure/${structure.pdbId}`} target="_blank" rel="noreferrer">PDB {structure.pdbId}</a></div>
            <MoleculeViewer pdbId={structure.pdbId} title={structure.title} />
            <p className="sub" style={{ marginTop: 10 }}>{structure.title}</p>
            <ul className="rc-why" style={{ marginTop: 8 }}>{structure.insight.map((s) => <li key={s}>{s}</li>)}</ul>
          </section>
          <section className="panel" aria-labelledby="mol2-t">
            <div className="panel-head"><h2 id="mol2-t" className="panel-title"><IconFlask /> Molecular profile</h2><span className="chip ghost">{tested.length}/10 panel markers</span></div>
            <div className="table-wrap">
              <table className="data" style={{ minWidth: 0 }}>
                <thead><tr><th>Alteration</th><th>Sample</th><th>VAF</th><th>Reported</th></tr></thead>
                <tbody>
                  {p.variants.map((v) => (
                    <tr key={`${v.gene}${v.alteration}`}>
                      <td className="strong">{v.gene} {v.alteration}{v.hgvsP ? <span className="muted mono"> {v.hgvsP}</span> : null}</td>
                      <td>{v.sample}</td>
                      <td className="num">{v.vafPercent !== undefined ? `${v.vafPercent}%` : "—"}</td>
                      <td className="num">{v.reportedOn}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      <section className="panel" aria-labelledby="tr-t">
        <div className="panel-head">
          <h2 id="tr-t" className="panel-title"><IconPill /> Recruiting trials · {p.trialQuery.term}</h2>
          <a className="btn sm arrow" href={`https://clinicaltrials.gov/search?cond=${encodeURIComponent(p.trialQuery.condition)}&term=${encodeURIComponent(p.trialQuery.term)}&aggFilters=status:rec`} target="_blank" rel="noreferrer">Search ClinicalTrials.gov</a>
        </div>
        {trials.length ? (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>NCT ID</th><th>Study</th><th>Phase · status</th></tr></thead>
              <tbody>
                {trials.map((t) => (
                  <tr key={t.id}>
                    <td className="strong mono"><a href={t.url} target="_blank" rel="noreferrer" style={{ color: "#6dffb6" }}>{t.id.replace("trial:", "")}</a></td>
                    <td>{t.detail}</td>
                    <td className="num">{t.label.split(" · ").slice(1).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">No recruiting trial matched in the stored run.</p>
        )}
        <p className="footer-note" style={{ marginTop: 10 }}>Matched by biomarker from the ClinicalTrials.gov API v2. Eligibility is confirmed by the investigator.</p>
      </section>
    </>
  );
}
