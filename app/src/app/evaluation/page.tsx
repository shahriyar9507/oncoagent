import results from "@/lib/data/eval-results.json";
import { patients } from "@/lib/data/patients";
import { IconGauge, IconShield } from "@/components/icons";

export const metadata = { title: "Evaluation · OncoAgent" };

function pct(v: number) {
  return `${Math.round(v * 100)}%`;
}

export default function EvaluationPage() {
  const s = results.summary;
  const metrics = [
    { k: "Driver alteration identified", v: pct(s.driverAccuracy), d: `${s.cases} gold cases` },
    { k: "Leading option matches gold answer", v: pct(s.leadingOptionConcordanceClaude), d: "Claude synthesis" },
    { k: "Citations that resolve to evidence", v: pct(s.citationValidity), d: "every evidence ID on every card" },
    { k: "Trial IDs from the registry", v: pct(s.trialIdValidity), d: "no invented NCT numbers" },
    { k: "Doses exactly as hand-calculated", v: pct(s.doseExact), d: `${s.unitTests} unit tests on the calculators` },
    { k: "Doses written outside the calculator", v: String(s.doseLeaks), d: "must be zero" },
    { k: "Unsafe leading recommendations", v: String(s.unsafeLeads), d: "contraindicated or wrong-line drugs" },
    { k: "Adversarial drafts caught", v: `${s.adversarialCaught}/${s.adversarialTotal}`, d: "safety-critic red-team set" },
  ];
  const maxMs = Math.max(...results.cases.map((c) => c.latencyMs));
  return (
    <>
      <section className="panel hero glow">
        <p className="eyebrow">Evaluation · generated {results.generatedAt.slice(0, 16).replace("T", " ")} UTC</p>
        <h1 style={{ marginTop: 8 }}>Measured before it is <b>trusted</b></h1>
        <p>Every stored agent run is scored against gold answers written for each fictional case, and the safety-critic is attacked with deliberately unsafe drafts. The same script runs after any prompt, model or tool change.</p>
      </section>

      <div className="grid g4">
        {metrics.map((m, i) => (
          <section key={m.k} className={`panel stat${i < 1 ? " accent" : ""}`}>
            <span className="label">{m.k}</span>
            <span className="big" style={{ fontSize: 38 }}>{m.v}</span>
            <span className="foot">{m.d}</span>
          </section>
        ))}
      </div>

      <div className="split split-wide">
        <section className="panel">
          <div className="panel-head"><h2 className="panel-title"><IconGauge /> Per case</h2><span className="chip ghost">{results.model}</span></div>
          <div className="table-wrap">
            <table className="data stackable">
              <thead><tr><th>Case</th><th>Driver</th><th>Lead option</th><th>Key points</th><th>Dose</th><th>Critic flags</th><th>Cost</th></tr></thead>
              <tbody>
                {results.cases.map((c) => {
                  const p = patients.find((x) => x.id === c.id)!;
                  const found = c.mentions.filter((m) => m.found).length;
                  return (
                    <tr key={c.id}>
                      <td className="strong" data-label="Case">{p.displayName}<br /><span className="muted mono">{c.id}</span></td>
                      <td data-label="Driver">{c.driverFound ? <span className="chip mint">found</span> : <span className="chip red">missed</span>}</td>
                      <td data-label="Lead option">{c.leadingOptionClaude ? <span className="chip mint">match</span> : <span className="chip red">differs</span>}</td>
                      <td className="num" data-label="Key points">{found}/{c.mentions.length}</td>
                      <td data-label="Dose">{c.doseExact ? <span className="chip mint">exact</span> : <span className="chip red">off</span>}</td>
                      <td data-label="Critic flags">{c.criticFlags.length ? <span className="chip amber" title={c.criticFlags.map((f) => f.notes.join(" ")).join(" | ")}>{c.criticFlags.length} · {c.criticFlags[0].agent}</span> : <span className="chip ghost">0</span>}</td>
                      <td className="num" data-label="Cost">${c.costUsd.toFixed(3)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="footer-note" style={{ marginTop: 10 }}>The P-003 flag is the critic doing its job: the rules-only guideline card listed lorlatinib without noting it is contraindicated with carbamazepine. The Claude card did note it.</p>
        </section>

        <section className="panel">
          <div className="panel-head"><h2 className="panel-title">Run time per case</h2><span className="chip ghost">seconds</span></div>
          <div className="stack" style={{ gap: 14 }}>
            {results.cases.map((c) => {
              const syn = c.synthesisMs;
              const rest = c.latencyMs - syn;
              return (
                <div key={c.id}>
                  <div className="row" style={{ justifyContent: "space-between", fontSize: 13 }}>
                    <span>{c.id}</span>
                    <span className="mono">{(c.latencyMs / 1000).toFixed(1)} s</span>
                  </div>
                  <div style={{ display: "flex", gap: 2, height: 12, marginTop: 6 }} role="img" aria-label={`${c.id}: tools ${(rest / 1000).toFixed(1)} s, Claude ${(syn / 1000).toFixed(1)} s`}>
                    <span style={{ width: `${(rest / maxMs) * 100}%`, background: "#3fd7c4", borderRadius: "3px 0 0 3px" }} />
                    <span style={{ width: `${(syn / maxMs) * 100}%`, background: "#17ff88", borderRadius: "0 3px 3px 0", boxShadow: "0 0 10px rgba(23,255,136,0.5)" }} />
                  </div>
                </div>
              );
            })}
            <div className="chart-legend">
              <span><span style={{ width: 10, height: 10, background: "#3fd7c4", borderRadius: 2, display: "inline-block" }} /> Tools and rules (CIViC, trials, calculators)</span>
              <span><span style={{ width: 10, height: 10, background: "#17ff88", borderRadius: 2, display: "inline-block" }} /> Claude synthesis</span>
            </div>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head"><h2 className="panel-title"><IconShield /> Red-team set for the safety-critic</h2><span className="chip mint">{s.adversarialCaught}/{s.adversarialTotal} caught</span></div>
        <div className="table-wrap">
          <table className="data stackable">
            <thead><tr><th>Unsafe draft</th><th>Result</th><th>Critic note</th></tr></thead>
            <tbody>
              {results.adversarial.map((a) => (
                <tr key={a.name}>
                  <td className="strong" data-label="Unsafe draft">{a.name}</td>
                  <td data-label="Result">{a.caught ? <span className="chip mint">caught</span> : <span className="chip red">missed</span>}</td>
                  <td data-label="Critic note">{a.notes.join(" ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="footer-note">Limits: three fictional gold cases written by the team are far too few to claim clinical accuracy. A pilot needs hundreds of de-identified cases with tumour-board answers, reviewed under ethics approval.</p>
    </>
  );
}
