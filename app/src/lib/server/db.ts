// Database access for server-side storage of cases, agent runs and the audit log.
//
// DATABASE_URL selects the driver:
//   postgres://… or postgresql://…  → any PostgreSQL 13+ (Neon, Supabase, RDS, self-hosted) via `postgres`
//   pglite:memory or pglite:<dir>   → embedded PGlite (local development and tests; not for serverless production)
//   unset                           → no server storage; the app keeps data in the clinician's browser
export interface Db {
  driver: "postgres" | "pglite";
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** Run statements in one transaction. */
  tx<T>(fn: (db: Pick<Db, "query">) => Promise<T>): Promise<T>;
}

let current: Promise<Db | null> | null = null;
let override: Db | null = null;

export function storageConfigured(): boolean {
  return !!override || !!process.env.DATABASE_URL;
}

/** The shared database handle, or null when no DATABASE_URL is configured. */
export function getDb(): Promise<Db | null> {
  if (override) return Promise.resolve(override);
  if (!current) current = connect(process.env.DATABASE_URL);
  return current;
}

/** Tests inject an in-memory database here. */
export function setDbForTests(db: Db | null) {
  override = db;
  current = null;
}

async function connect(url: string | undefined): Promise<Db | null> {
  if (!url) return null;
  if (url.startsWith("pglite:")) return pglite(url.slice("pglite:".length));
  const { default: postgres } = await import("postgres");
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const sql = postgres(url, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // safe behind PgBouncer / Supabase / Neon poolers
    ssl: local || process.env.DATABASE_SSL === "disable" ? false : "require",
    onnotice: () => {},
  });
  type Unsafe = { unsafe: (text: string, params?: never[]) => PromiseLike<unknown> };
  const run = async <T,>(conn: Unsafe, text: string, params: unknown[] = []) => (await conn.unsafe(text, params as never[])) as unknown as T[];
  return {
    driver: "postgres",
    query: (text, params) => run(sql as unknown as Unsafe, text, params),
    tx: async (fn) => (await sql.begin((t) => fn({ query: (text, params) => run(t as unknown as Unsafe, text, params) }))) as never,
  };
}

/** Embedded PostgreSQL (WASM). Loaded lazily so production bundles never include it. */
export async function pglite(dataDir = "memory"): Promise<Db> {
  const modName = "@electric-sql/pglite";
  const { PGlite } = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ modName)) as typeof import("@electric-sql/pglite");
  const pg = dataDir === "memory" || dataDir === "" ? new PGlite() : new PGlite(dataDir);
  await pg.waitReady;
  const run = async <T,>(conn: { query: typeof pg.query }, text: string, params: unknown[] = []) => (await conn.query<T>(text, params)).rows as T[];
  return {
    driver: "pglite",
    query: (text, params) => run(pg, text, params),
    tx: (fn) => pg.transaction((t) => fn({ query: (text, params) => run(t as unknown as { query: typeof pg.query }, text, params) })),
  };
}
