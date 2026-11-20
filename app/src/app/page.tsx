import Link from "next/link";
import { patients } from "@/lib/data/patients";
import { snapshots } from "@/lib/snapshots";
import evalResults from "@/lib/data/eval-results.json";
import { AgentOrbit } from "@/components/AgentOrbit";
import { PatientList } from "@/components/PatientList";
import { PendingStat, RecentActivity } from "@/components/Activity";
import { IconActivity, IconInbox, IconPlug, IconShield, IconSpark, IconUsers, IconDna, IconCalc } from "@/components/icons";

const FLOW = [
  ["Arrives", "Lab, scan, pathology or gene report lands on the timeline."],
  ["Interpreted", "Driver and resistance alterations graded with CIViC evidence."],
  ["Proposed", "Guideline options, tests, interactions, trials and a calculated dose."],
  ["Synthesised", "Claude writes the tumour-board pre-read from cited evidence only."],
  ["Checked", "The safety-critic rejects invented trials, stray doses and unsafe drugs."],
  ["Decided", "The oncologist approves, modifies or rejects; the log signs it."],
];

export default function Overview() {
  const stored = Object.fromEntries(patients.map((p) => [p.id, snapshots[p.id].cards.map((c) => c.id)]));
  const names = Object.fromEntries(patients.map((p) => [p.id, p.displayName]));
  const s = evalResults.summary;
  return (
    <>
      <section className="panel hero glow hero-split" aria-labelledby="hero-t">
        <div>
          <p className="eyebrow">Agentic precision oncology · lung cancer first</p>
          <h1 id="hero-t" style={{ marginTop: 10 }}>AI proposes. <b>The doctor decides.</b></h1>
          <p>OncoAgent is an assistant team for oncologists. Nine agents read every report, find the responsible gene, check guidelines, interactions, trials and doses, and a safety-critic verifies every claim. Each proposal waits for a clinician to approve, modify or reject it.</p>
          <div className="row">
            <Link href="/patients/P-001" className="btn primary arrow">Open a case</Link>
            <Link href="/queue" className="btn"><IconInbox /> Decision queue</Link>
            <Link href="/mcp" className="btn"><IconPlug /> Connect over MCP</Link>
          </div>
          <div className="hero-facts">
            <span><IconDna width={14} height={14} /> CIViC + ClinicalTrials.gov live</span>
            <span><IconCalc width={14} height={14} /> Unit-tested dose calculators</span>
            <span><IconShield width={14} height={14} /> Hash-chained sign-off</span>
          </div>
        </div>
        <AgentOrbit />
      </section>

      <div className="grid g4">
        <section className="panel stat accent">
          <span className="label"><IconUsers width={14} height={14} /> Fictional NSCLC cases</span>
          <span className="big">{patients.length}</span>
          <span className="foot">EGFR, KRAS G12C and ALK drivers</span>
        </section>
        <section className="panel stat">
          <span className="label"><IconSpark width={14} height={14} /> Awaiting decision</span>
          <PendingStat stored={stored} />
        </section>
        <section className="panel stat">
          <span className="label"><IconShield width={14} height={14} /> Unsafe drafts caught</span>
          <span className="big">{s.adversarialCaught}<small>of {s.adversarialTotal}</small></span>
          <span className="foot">safety-critic red-team set · <Link href="/evaluation" className="ul">evaluation</Link></span>
        </section>
        <section className="panel stat">
          <span className="label"><IconActivity width={14} height={14} /> Full agent run</span>
          <span className="big">{s.meanLatencyS}<small>s</small></span>
          <span className="foot">≈ ${s.meanCostUsd.toFixed(3)} per case with Claude</span>
        </section>
      </div>

      <div className="split">
        <section className="panel" aria-labelledby="pl-t">
          <div className="panel-head"><h2 id="pl-t" className="panel-title"><IconUsers /> Patients</h2><span className="chip amber">fictional data</span></div>
          <PatientList />
        </section>
        <RecentActivity names={names} />
      </div>

      <section className="panel" aria-labelledby="fl-t">
        <div className="panel-head"><h2 id="fl-t" className="panel-title"><IconSpark /> From report to signed decision</h2><span className="chip ghost">about 25 s with Claude</span></div>
        <ol className="flow">
          {FLOW.map(([t, d], i) => (
            <li key={t} className={`f${i === 5 ? " hl" : ""}`}>
              <i>{String(i + 1).padStart(2, "0")}</i>
              <b>{t}</b>
              <span>{d}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid g3">
        <section className="panel">
          <p className="eyebrow">Live data</p>
          <h3 className="h3">CIViC and ClinicalTrials.gov</h3>
          <p className="sub" style={{ marginTop: 6 }}>Variant evidence (CC0) and recruiting trials are fetched live, with dated snapshots if a source is down. The top bar shows which mode is active.</p>
        </section>
        <section className="panel">
          <p className="eyebrow">Model</p>
          <h3 className="h3">Claude Opus 5.5, structured output</h3>
          <p className="sub" style={{ marginTop: 6 }}>De-identified context only: a pseudonymous ID and an age band. It may cite only evidence IDs it was given and never writes a dose.</p>
        </section>
        <section className="panel">
          <p className="eyebrow">Open tools</p>
          <h3 className="h3">7 tools over MCP</h3>
          <p className="sub" style={{ marginTop: 6 }}>The same tools serve any MCP client over stdio and Streamable HTTP. <Link href="/mcp" className="ul">Try them in the browser</Link>.</p>
        </section>
      </div>

      <p className="footer-note">All patients are fictional. OncoAgent is a research prototype by team DatourX for the Idea to Unicorn competition, not a medical device, and not medical advice.</p>
    </>
  );
}
