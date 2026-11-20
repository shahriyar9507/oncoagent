// Refreshes the offline snapshots used when CIViC or ClinicalTrials.gov cannot be reached.
// Run: npx tsx scripts/snapshot.ts
import { writeFileSync } from "node:fs";
import { patients } from "../src/lib/data/patients";
import { fetchCivicRaw, profileName } from "../src/lib/tools/civic";
import { fetchTrialsRaw } from "../src/lib/tools/trials";

async function main() {
  const civic: Record<string, unknown> = {};
  const trials: Record<string, unknown> = {};
  for (const p of patients) {
    for (const v of p.variants) {
      const name = profileName(v.gene, v.alteration);
      if (civic[name]) continue;
      try {
        civic[name] = await fetchCivicRaw(name, 20000);
        console.log("CIViC", name, "ok");
      } catch (e) {
        console.log("CIViC", name, "failed", (e as Error).message);
      }
    }
    const key = `${p.trialQuery.condition}|${p.trialQuery.term}`;
    try {
      trials[key] = await fetchTrialsRaw(p.trialQuery.condition, p.trialQuery.term, 10, 20000);
      console.log("Trials", key, "ok");
    } catch (e) {
      console.log("Trials", key, "failed", (e as Error).message);
    }
  }
  writeFileSync("src/lib/tools/cache/civic.json", JSON.stringify(civic));
  writeFileSync("src/lib/tools/cache/trials.json", JSON.stringify(trials));
}

main();
