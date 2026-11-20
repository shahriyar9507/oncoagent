import { getDb } from "../src/lib/server/db";
import { SCHEMA_VERSION, ensureSchema } from "../src/lib/server/store";

// Creates or upgrades the OncoAgent tables in DATABASE_URL and prints the result. Safe to run repeatedly.
// Usage: DATABASE_URL=postgres://… npm run db:migrate
async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Example: postgres://user:pass@host:5432/db");
    process.exit(1);
  }
  const t0 = Date.now();
  const db = await getDb();
  if (!db) throw new Error("No database handle");
  await ensureSchema(db);
  const [v] = await db.query<{ value: string }>(`SELECT value FROM oa_meta WHERE key = 'schema_version'`);
  const counts = await db.query<{ t: string; n: string }>(
    `SELECT 'cases' AS t, count(*)::text AS n FROM oa_cases UNION ALL SELECT 'runs', count(*)::text FROM oa_runs UNION ALL SELECT 'audit', count(*)::text FROM oa_audit`,
  );
  console.log(`OK · driver ${db.driver} · schema v${v?.value} (code expects v${SCHEMA_VERSION}) · ${Date.now() - t0} ms`);
  console.log(counts.map((c) => `${c.t}: ${c.n}`).join(" · "));
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error("Migration failed:", (e as Error).message);
    process.exit(1);
  },
);
