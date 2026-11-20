"use client";

import { useState } from "react";
import { IconCopy, IconCheck, IconPlay, IconTerminal } from "./icons";

const PRESETS: Record<string, Record<string, unknown>> = {
  list_patients: {},
  get_case_timeline: { patient_id: "P-001" },
  interpret_variant: { gene: "EGFR", alteration: "C797S" },
  search_trials: { biomarker: "KRAS G12C", max_results: 3 },
  calculate_dose: { regimen: "carboplatin-pemetrexed", height_cm: 152, weight_kg: 54, age: 55, sex: "F", serum_creatinine_mg_dl: 0.8, creatinine_date: "2026-11-17", today: "2026-11-20" },
  draft_recommendations: { patient_id: "P-003", use_claude: false },
  record_decision: { patient_id: "P-001", card_id: "demo-card", action: "approve", reason: "Agree with the plan", clinician_token: "not-a-clinician" },
};

const HINT: Record<string, string> = {
  list_patients: "Lists the three fictional patients.",
  get_case_timeline: "De-identified timeline with RECIST 1.1 categories.",
  interpret_variant: "Live CIViC query for lung evidence.",
  search_trials: "Live ClinicalTrials.gov query for recruiting studies.",
  calculate_dose: "Deterministic dose card with formulas.",
  draft_recommendations: "Runs the rules-only agents and the critic (about 2 s).",
  record_decision: "Shows the refusal: an AI client has no clinician token.",
};

const MAX_LINES = 36;

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="copy-btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          /* clipboard blocked */
        }
      }}
      aria-label={done ? "Copied" : label}
    >
      {done ? <IconCheck /> : <IconCopy />} {done ? "Copied" : label}
    </button>
  );
}

export function CodeBlock({ code }: { code: string }) {
  return (
    <div className="code-wrap">
      <pre className="code">{code}</pre>
      <CopyButton text={code} />
    </div>
  );
}

async function rpc(endpoint: string, method: string, params: unknown) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${raw.slice(0, 200)}`);
  const dataLines = raw.split("\n").filter((l) => l.startsWith("data: "));
  const msg = JSON.parse(dataLines.length ? dataLines[dataLines.length - 1].slice(6) : raw) as { result?: unknown; error?: { message: string } };
  if (msg.error) throw new Error(msg.error.message);
  return msg.result;
}

export function McpPlayground({ endpoint }: { endpoint: string }) {
  const [tool, setTool] = useState("interpret_variant");
  const [args, setArgs] = useState(JSON.stringify(PRESETS.interpret_variant, null, 2));
  const [out, setOut] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ ms: number; isError: boolean; kind: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState(false);

  function pick(t: string) {
    setTool(t);
    setArgs(JSON.stringify(PRESETS[t], null, 2));
    setOut(null);
    setErr(null);
    setMeta(null);
  }

  async function call(kind: "call" | "list") {
    setBusy(true);
    setErr(null);
    setFull(false);
    const t0 = performance.now();
    try {
      if (kind === "list") {
        const r = (await rpc(endpoint, "tools/list", {})) as { tools: { name: string; description?: string }[] };
        setOut(JSON.stringify(r.tools.map((t) => ({ name: t.name, description: t.description })), null, 2));
        setMeta({ ms: performance.now() - t0, isError: false, kind: "tools/list" });
      } else {
        let parsed: unknown;
        try {
          parsed = JSON.parse(args || "{}");
        } catch {
          throw new Error("Arguments are not valid JSON");
        }
        const r = (await rpc(endpoint, "tools/call", { name: tool, arguments: parsed })) as { content?: { type: string; text: string }[]; isError?: boolean };
        const text = r.content?.map((c) => c.text).join("\n") ?? JSON.stringify(r, null, 2);
        let pretty = text;
        try {
          pretty = JSON.stringify(JSON.parse(text), null, 2);
        } catch {
          /* plain text */
        }
        setOut(pretty);
        setMeta({ ms: performance.now() - t0, isError: !!r.isError, kind: `tools/call · ${tool}` });
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const lines = out?.split("\n") ?? [];
  const shown = full ? out : lines.slice(0, MAX_LINES).join("\n");

  return (
    <section className="panel glow" aria-labelledby="pg-t">
      <div className="panel-head">
        <h2 id="pg-t" className="panel-title"><IconTerminal /> Try the tools live</h2>
        <span className="chip mint"><span className="dot" /> Streamable HTTP · JSON-RPC 2.0</span>
      </div>
      <p className="sub">Calls the deployed endpoint from your browser, exactly as an MCP client would.</p>
      <div className="pg-tools" role="tablist" aria-label="Tool">
        {Object.keys(PRESETS).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tool === t} className={`chip as-btn mono${tool === t ? " mint" : ""}`} onClick={() => pick(t)}>{t}</button>
        ))}
      </div>
      <div className="pg-grid">
        <div>
          <label className="field" htmlFor="pg-args">Arguments · <span className="muted">{HINT[tool]}</span>
            <textarea id="pg-args" className="mono" spellCheck={false} value={args} onChange={(e) => setArgs(e.target.value)} rows={Math.min(12, Math.max(4, args.split("\n").length + 1))} />
          </label>
          <div className="row" style={{ marginTop: 10 }}>
            <button type="button" className="btn primary" onClick={() => call("call")} disabled={busy}><IconPlay /> {busy ? "Calling…" : "Call tool"}</button>
            <button type="button" className="btn" onClick={() => call("list")} disabled={busy}>List tools</button>
          </div>
        </div>
        <div className="pg-out">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <span className="eyebrow">Result</span>
            {meta && <span className={`chip ${meta.isError ? "amber" : "mint"}`}>{meta.kind} · {Math.round(meta.ms)} ms{meta.isError ? " · tool refused" : ""}</span>}
          </div>
          {err ? (
            <p className="critic flag" role="alert">{err}</p>
          ) : out ? (
            <>
              <div className="code-wrap"><pre className="code">{shown}</pre><CopyButton text={out} /></div>
              {lines.length > MAX_LINES && <button type="button" className="link-btn" style={{ marginTop: 8 }} onClick={() => setFull(!full)}>{full ? "Show less" : `Show all ${lines.length} lines`}</button>}
            </>
          ) : (
            <p className="empty" style={{ border: "1px dashed var(--line-2)", borderRadius: 12 }}>Pick a tool and press Call tool.</p>
          )}
        </div>
      </div>
    </section>
  );
}
