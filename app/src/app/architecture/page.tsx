import { IconLayers, IconShield, IconSpark } from "@/components/icons";

export const metadata = { title: "How it works · OncoAgent" };

const LAYERS = [
  ["Apps", "Clinician workspace · tumour-board pre-read · decision queue · evaluation", false],
  ["Doctor control", "Recommendation cards · approve / modify / reject with reason · hash-chained audit log", true],
  ["Agents", "Orchestrator → Sentinel · Genomic-interpreter · Test-advisor · Guideline · Pharmacology-safety · Trial-matcher · Dose-optimizer · Synthesis (Claude) · Safety-critic", true],
  ["MCP tools", "oncoagent-mcp: 7 tools over stdio and Streamable HTTP", false],
  ["Engines", "CIViC evidence · ClinicalTrials.gov v2 · curated knowledge pack · RECIST 1.1 and dose calculators · Mol* structures", false],
  ["Data", "Synthetic FHIR-style records · evidence registry · snapshots for offline runs", false],
  ["Sources", "Referral letters · imaging · pathology · NGS · liquid biopsy · medication list", false],
] as const;

const AGENTS = [
  ["Sentinel", "RECIST 1.1 and ctDNA trend; red flags", "Suggest", "Treating oncologist"],
  ["Genomic-interpreter", "Driver and resistance calls from CIViC", "Draft", "Molecular pathologist"],
  ["Test-advisor", "Missing biomarkers and tests to order", "Suggest", "Treating oncologist"],
  ["Guideline", "Ranked options from the knowledge pack", "Suggest", "Tumour board"],
  ["Pharmacology-safety", "Interactions with current medications", "Suggest (can block)", "Pharmacist"],
  ["Trial-matcher", "Recruiting trials by biomarker", "Suggest", "Investigator"],
  ["Dose-optimizer", "BSA, Cockcroft–Gault, Calvert dose card", "Draft", "Pharmacist + oncologist"],
  ["Synthesis (Claude)", "Tumour-board pre-read and up to 3 cards from cited evidence", "Draft", "Treating oncologist"],
  ["Safety-critic", "Checks every card; flags unsafe or unsourced claims", "Can flag", "—"],
];

export default function ArchitecturePage() {
  return (
    <>
      <section className="panel hero glow">
        <p className="eyebrow">Architecture</p>
        <h1 style={{ marginTop: 8 }}>Seven layers, <b>one rule</b></h1>
        <p>The model proposes, deterministic code checks, a clinician decides. Research outputs never enter a patient&apos;s chart, and no agent can sign, prescribe or contact a patient.</p>
      </section>

      <section className="panel">
        <div className="panel-head"><h2 className="panel-title"><IconLayers /> Layers</h2></div>
        <div className="layers">
          {LAYERS.map(([n, d, hl]) => (
            <div key={n} className={`layer${hl ? " hl" : ""}`}>
              <span className="ln">{n}</span>
              <span className="sub" style={{ color: "#e9f2ed" }}>{d}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2 className="panel-title"><IconSpark /> Agents and who signs</h2></div>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Agent</th><th>Job</th><th>Autonomy</th><th>Signs off</th></tr></thead>
            <tbody>{AGENTS.map((a) => <tr key={a[0]}><td className="strong">{a[0]}</td><td>{a[1]}</td><td>{a[2]}</td><td>{a[3]}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <div className="grid g3">
        <section className="panel">
          <p className="eyebrow">Level 1 · clinical</p>
          <h3 style={{ marginTop: 8, fontSize: 18 }}>Select</h3>
          <p className="sub" style={{ marginTop: 6 }}>Approved drug, regimen or recruiting trial that matches the responsible protein. Built today.</p>
        </section>
        <section className="panel">
          <p className="eyebrow">Level 2 · clinical</p>
          <h3 style={{ marginTop: 8, fontSize: 18 }}>Personalise</h3>
          <p className="sub" style={{ marginTop: 6 }}>Dose for kidney function, body size and interactions with label formulas. Built today; model-informed dosing is research.</p>
        </section>
        <section className="panel">
          <p className="eyebrow">Level 3 · research</p>
          <h3 style={{ marginTop: 8, fontSize: 18 }}>New molecule</h3>
          <p className="sub" style={{ marginTop: 6 }}>De-identified resistance patterns become target dossiers for licensed discovery partners. Vision; years of trials before any patient.</p>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head"><h2 className="panel-title"><IconShield /> Rules that hold everywhere</h2></div>
        <ul className="rc-why">
          <li>No drug, dose, trial number or citation may come from model memory; the critic rejects any that are not in the evidence registry.</li>
          <li>Doses come only from unit-tested calculators; a stale creatinine or low clearance blocks the dose card.</li>
          <li>The model sees a pseudonymous ID and an age band, never a name or address.</li>
          <li>Documents and tool outputs are data, never instructions.</li>
          <li>Every approval, modification and rejection is written with a reason to a hash-chained log.</li>
        </ul>
      </section>
    </>
  );
}
