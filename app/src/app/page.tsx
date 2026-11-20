import Link from "next/link";
import { patients } from "@/lib/data/patients";
import { snapshots } from "@/lib/snapshots";
import { assessRecist } from "@/lib/clinical/recist";
import evalResults from "@/lib/data/eval-results.json";
import { IconActivity, IconPlug, IconShield, IconSpark, IconUsers } from "@/components/icons";

export default function Overview() {
  const totalCards = Object.values(snapshots).reduce((a, s) => a + s.cards.length, 0);
  const s = evalResults.summary;
  return (
    <>
      <section className="panel hero glow" aria-labelledby="hero-t">
        <p className="eyebrow">Agentic precision oncology · lung cancer first</p>
        <h1 id="hero-t" style={{ marginTop: 10 }}>AI proposes. <b>The doctor decides.</b></h1>
        <p>OncoAgent is an assistant team for oncologists. Specialist agents read every report, find the responsible gene, check guidelines, interactions, trials and doses, and a safety-critic verifies every claim. Each proposal waits for a clinician to approve, modify or reject it.</p>
        <div className="row">
          <Link href="/patients/P-001" className="btn primary arrow">Open a case</Link>
          <Link href="/architecture" className="btn">How it works</Link>
          <Link href="/mcp" className="btn">Connect over MCP</Link>
        </div>
      </section>

      <div className="grid g4">
        <section className="panel stat accent">
          <span className="label"><IconUsers width={14} height={14} style={{ verticalAlign: -2 }} /> Fictional NSCLC cases</span>
          <span className="big">{patients.length}</span>
          <span className="foot">EGFR, KRAS G12C and ALK drivers</span>
        </section>
        <section className="panel stat">
          <span className="label"><IconSpark width={14} height={14} style={{ verticalAlign: -2 }} /> Recommendation cards drafted</span>
          <span className="big">{totalCards}</span>
          <span className="foot">every one waits for a clinician</span>
        </section>
        <section className="panel stat">
          <span className="label"><IconShield width={14} height={14} style={{ verticalAlign: -2 }} /> Unsafe drafts caught</span>
          <span className="big">{s.adversarialCaught}<small>of {s.adversarialTotal}</small></span>
          <span className="foot">safety-critic adversarial checks</span>
        </section>
        <section className="panel stat">
          <span className="label"><IconActivity width={14} height={14} style={{ verticalAlign: -2 }} /> Full agent run</span>
          <span className="big">{s.meanLatencyS}<small>s</small></span>
          <span className="foot">≈ ${s.meanCostUsd.toFixed(3)} per case with Claude</span>
        </section>
      </div>

      <div className="split">
        <section className="panel" aria-labelledby="pl-t">
          <div className="panel-head"><h2 id="pl-t" className="panel-title"><IconUsers /> Patients</h2><span className="chip amber">fictional data</span></div>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Patient</th><th>Driver</th><th>RECIST</th><th>Now</th><th>Cards</th></tr></thead>
              <tbody>
                {patients.map((p) => {
                  const r = assessRecist(p.recist);
                  const last = r[r.length - 1];
                  const snap = snapshots[p.id];
                  const flags = snap.cards.filter((c) => c.critic.verdict === "flag").length;
                  return (
                    <tr key={p.id}>
                      <td className="strong"><Link href={`/patients/${p.id}`} style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>{p.displayName}</Link><br /><span className="muted mono">{p.id}</span></td>
                      <td>{p.variants.filter((v) => v.gene !== "TP53").map((v) => `${v.gene} ${v.alteration}`).join(", ")}</td>
                      <td><span className={`chip ${last.category === "PD" ? "red" : "mint"}`}>{last.category}</span></td>
                      <td>{p.status}</td>
                      <td className="num">{snap.cards.length}{flags ? <><br /><span className="chip amber" style={{ marginTop: 4 }}>{flags} critic flag</span></> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel" aria-labelledby="fl-t">
          <div className="panel-head"><h2 id="fl-t" className="panel-title"><IconSpark /> From report to signed decision</h2></div>
          <div className="stack" style={{ gap: 8 }}>
            {[
              ["Arrives", "Lab, scan, pathology or gene report lands on the timeline."],
              ["Interpreted", "Driver and resistance alterations graded with CIViC evidence."],
              ["Proposed", "Guideline options, tests, interactions, trials and a calculated dose card."],
              ["Synthesised", "Claude writes the tumour-board pre-read from cited evidence only."],
              ["Checked", "The safety-critic rejects invented trials, doses outside the calculator and unsafe drugs."],
              ["Decided", "The oncologist approves, modifies or rejects; the hash-chained log records it."],
            ].map(([t, d], i) => (
              <div key={t} className="layer" style={{ gridTemplateColumns: "34px minmax(0,1fr)" }}>
                <span style={{ fontSize: 20, fontWeight: 300, color: i === 5 ? "#17ff88" : "#7a8c82" }}>{i + 1}</span>
                <span><b style={{ color: "#e9f2ed" }}>{t}</b> <span className="sub">{d}</span></span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid g3">
        <section className="panel">
          <p className="eyebrow">Live data</p>
          <h3 style={{ marginTop: 8, fontSize: 17 }}>CIViC and ClinicalTrials.gov</h3>
          <p className="sub" style={{ marginTop: 6 }}>Variant evidence (CC0) and recruiting trials are fetched live, with stored snapshots if a source is down.</p>
        </section>
        <section className="panel">
          <p className="eyebrow">Model</p>
          <h3 style={{ marginTop: 8, fontSize: 17 }}>Claude Opus 5.5, structured output</h3>
          <p className="sub" style={{ marginTop: 6 }}>De-identified context only. It may cite only evidence IDs it was given and never writes a dose.</p>
        </section>
        <section className="panel">
          <p className="eyebrow"><IconPlug width={12} height={12} style={{ verticalAlign: -1 }} /> Open tools</p>
          <h3 style={{ marginTop: 8, fontSize: 17 }}>7 tools over MCP</h3>
          <p className="sub" style={{ marginTop: 6 }}>The same tools serve any MCP client over stdio and Streamable HTTP. <Link href="/mcp" style={{ color: "#6dffb6", textDecoration: "underline" }}>Connect</Link></p>
        </section>
      </div>

      <p className="footer-note">All patients are fictional. OncoAgent is a research prototype by team DatourX for the Idea to Unicorn competition, not a medical device, and not medical advice.</p>
    </>
  );
}
