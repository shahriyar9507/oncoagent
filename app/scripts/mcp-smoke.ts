// Connects to oncoagent-mcp, lists its tools and calls four of them.
// stdio:  npx tsx scripts/mcp-smoke.ts
// HTTP:   npx tsx scripts/mcp-smoke.ts https://<host>/api/mcp
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

async function main() {
  const url = process.argv[2];
  const client = new Client({ name: "oncoagent-smoke", version: "1.0.0" });
  const transport = url
    ? new StreamableHTTPClientTransport(new URL(url))
    : new StdioClientTransport({ command: process.execPath, args: ["--import", "tsx", "mcp/stdio.ts"] });
  await client.connect(transport);
  console.log(`connected via ${url ? "Streamable HTTP" : "stdio"}`);

  const { tools } = await client.listTools();
  console.log(`tools (${tools.length}): ${tools.map((t) => t.name).join(", ")}`);

  const show = (r: unknown) => {
    const c = (r as { content?: { type: string; text?: string }[]; isError?: boolean }).content?.[0]?.text ?? "";
    return c.length > 260 ? c.slice(0, 260).replace(/\s+/g, " ") + " …" : c.replace(/\s+/g, " ");
  };

  console.log("interpret_variant →", show(await client.callTool({ name: "interpret_variant", arguments: { gene: "EGFR", alteration: "C797S" } })));
  console.log("search_trials →", show(await client.callTool({ name: "search_trials", arguments: { condition: "non-small cell lung cancer", biomarker: "EGFR C797S", max_results: 3 } })));
  console.log("calculate_dose →", show(await client.callTool({ name: "calculate_dose", arguments: { regimen: "carboplatin-pemetrexed", height_cm: 152, weight_kg: 54, age: 55, sex: "F", serum_creatinine_mg_dl: 0.8, creatinine_date: "2026-11-17", today: "2026-11-20" } })));
  console.log("record_decision (no token) →", show(await client.callTool({ name: "record_decision", arguments: { patient_id: "P-001", card_id: "x", action: "approve", reason: "agree with plan", clinician_token: "wrong" } })));
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
