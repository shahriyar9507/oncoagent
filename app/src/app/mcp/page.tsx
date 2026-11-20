import { headers } from "next/headers";
import { IconPlug, IconShield } from "@/components/icons";
import { regimens } from "@/lib/data/regimens";
import { CodeBlock, McpPlayground } from "@/components/McpPlayground";

export const metadata = { title: "MCP server · OncoAgent" };

const TOOLS = [
  { name: "list_patients", input: "—", out: "Fictional patients with their current question", side: "read" },
  { name: "get_case_timeline", input: "patient_id", out: "De-identified timeline, RECIST 1.1 assessments, ctDNA, medications", side: "read" },
  { name: "interpret_variant", input: "gene, alteration", out: "CIViC lung evidence: level, significance, therapies, PubMed IDs", side: "read · live API" },
  { name: "search_trials", input: "condition, biomarker, max_results", out: "Recruiting ClinicalTrials.gov studies: NCT ID, phase, sponsor, countries", side: "read · live API" },
  { name: "calculate_dose", input: `regimen (${Object.keys(regimens).length} regimens), height, weight, age, sex, creatinine, date`, out: "BSA, CrCl, Calvert and BSA doses with formulas, blocks and premedication", side: "read · deterministic" },
  { name: "draft_recommendations", input: "patient_id, use_claude", out: "Specialist-agent cards, evidence list, safety-critic verdicts, dose card", side: "read · drafts only" },
  { name: "extract_report", input: "text", out: "Alterations with the matched text, PD-L1 TPS, negative genes, sample type, warnings", side: "read · deterministic" },
  { name: "analyze_case", input: "case (de-identified NSCLC case), use_claude", out: "Knowledge-pack setting, agent cards, evidence, critic verdicts, dose card", side: "read · drafts only" },
  { name: "record_decision", input: "patient_id, card_id, action, reason, clinician_token", out: "Hash-chained decision entry", side: "write · clinician token required" },
];

export default async function McpPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const url = `${proto}://${host}/api/mcp`;
  return (
    <>
      <section className="panel hero glow">
        <p className="eyebrow">oncoagent-mcp · version 0.2.0</p>
        <h1 style={{ marginTop: 8 }}>Nine tools, <b>one open layer</b></h1>
        <p>Every capability the agents use is also an MCP tool, so Claude, IDE agents and hospital systems can read a report, analyse a de-identified case, look up evidence, search trials and calculate a dose. One definition serves both transports.</p>
        <div className="row">
          <span className="chip mint"><span className="dot" /> Streamable HTTP</span>
          <span className="chip mint"><span className="dot" /> stdio</span>
          <span className="chip">MCP SDK v2 · mcp-handler</span>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2 className="panel-title"><IconPlug /> Endpoint</h2></div>
        <CodeBlock code={url} />
        <div className="grid g3" style={{ marginTop: 16 }}>
          <div>
            <p className="eyebrow" style={{ marginBottom: 8 }}>Claude Code</p>
            <CodeBlock code={`claude mcp add --transport http \\\n  oncoagent ${url}`} />
          </div>
          <div>
            <p className="eyebrow" style={{ marginBottom: 8 }}>Claude Desktop (via mcp-remote)</p>
            <CodeBlock code={`{
  "mcpServers": {
    "oncoagent": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "${url}"]
    }
  }
}`} />
          </div>
          <div>
            <p className="eyebrow" style={{ marginBottom: 8 }}>Local stdio (from the repository)</p>
            <CodeBlock code={`cd app
npm install
npx tsx mcp/stdio.ts`} />
          </div>
        </div>
      </section>

      <McpPlayground endpoint="/api/mcp" />

      <section className="panel">
        <div className="panel-head"><h2 className="panel-title">Tools</h2><span className="chip ghost">{TOOLS.length}</span></div>
        <div className="table-wrap">
          <table className="data stackable">
            <thead><tr><th>Tool</th><th>Input</th><th>Returns</th><th>Effect</th></tr></thead>
            <tbody>
              {TOOLS.map((t) => (
                <tr key={t.name}>
                  <td className="strong mono" data-label="Tool">{t.name}</td>
                  <td data-label="Input">{t.input}</td>
                  <td data-label="Returns">{t.out}</td>
                  <td data-label="Effect"><span className={`chip ${t.side.startsWith("write") ? "amber" : "mint"}`}>{t.side}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid g2">
        <section className="panel">
          <div className="panel-head"><h2 className="panel-title">Try it with curl</h2></div>
          <CodeBlock code={`curl -s ${url} \\
  -H "content-type: application/json" \\
  -H "accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"calculate_dose","arguments":{
       "regimen":"carboplatin-pemetrexed","height_cm":152,
       "weight_kg":54,"age":55,"sex":"F",
       "serum_creatinine_mg_dl":0.8,"creatinine_date":"2026-11-17"}}}'`} />
        </section>
        <section className="panel">
          <div className="panel-head"><h2 className="panel-title"><IconShield /> Safety on the tool layer</h2></div>
          <ul className="rc-why">
            <li>Read tools return data with sources; nothing changes a patient record.</li>
            <li><span className="mono">record_decision</span> refuses unless a clinician session token is supplied. An AI client cannot sign.</li>
            <li>Set <span className="mono">MCP_BEARER_TOKEN</span> to require a bearer token on the HTTP endpoint.</li>
            <li>All patients are fictional; identifiable data never passes through the demo endpoint.</li>
            <li>Claude synthesis through <span className="mono">draft_recommendations</span> is rate-limited on the public endpoint; rules-only runs are free.</li>
            <li>For on-premise hospital pilots, an outbound-only tunnel keeps patient data inside the hospital network.</li>
          </ul>
        </section>
      </div>
    </>
  );
}
