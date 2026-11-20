// Runs the full agent pipeline for every synthetic case and stores the result as a snapshot the UI shows first.
// Run: npx tsx scripts/precompute.ts [P-001 ...]
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { patients } from "../src/lib/data/patients";
import { runPipeline } from "../src/lib/agents/pipeline";

for (const f of ["../.env.local", ".env.local"]) {
  if (existsSync(f)) process.loadEnvFile(f);
}

async function main() {
  const ids = process.argv.slice(2);
  mkdirSync("src/lib/data/snapshots", { recursive: true });
  for (const p of patients.filter((x) => !ids.length || ids.includes(x.id))) {
    const t0 = Date.now();
    const result = await runPipeline(p, {
      useClaude: true,
      onStep: (s) => console.log(`[${p.id}] ${s.agent.padEnd(20)} ${s.status.padEnd(7)} ${String(s.ms).padStart(6)} ms  ${s.note.slice(0, 110)}`),
    });
    writeFileSync(`src/lib/data/snapshots/${p.id}.json`, JSON.stringify(result, null, 1));
    console.log(`[${p.id}] ${result.mode} · ${result.cards.length} cards · ${result.cards.filter((c) => c.critic.verdict === "flag").length} flagged · ${((Date.now() - t0) / 1000).toFixed(1)} s · usage ${JSON.stringify(result.usage)}`);
    for (const c of result.cards.filter((c) => c.origin === "claude")) {
      console.log(`   [claude:${c.kind}] ${c.proposal}\n      evidence: ${c.evidenceIds.join(", ")}\n      critic: ${c.critic.verdict} ${c.critic.notes.join(" | ")}`);
    }
    if (result.warnings.length) console.log("   warnings:", result.warnings);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
