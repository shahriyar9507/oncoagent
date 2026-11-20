import { createHash } from "node:crypto";
import type { Db } from "./db";
import type { AuditEntry, DecisionAction } from "../types";
import type { CaseInput } from "../caseInput";
import type { PipelineResult } from "../agents/pipeline";

// Server-side storage, scoped by owner (the signed-in username). Cases and the latest agent run per patient are
// mutable; the audit log is append-only (a database trigger refuses UPDATE and DELETE) and SHA-256 hash-chained.
export const SCHEMA_VERSION = 1;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS oa_meta (key text PRIMARY KEY, value text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS oa_cases (
     id text PRIMARY KEY,
     owner text NOT NULL,
     input jsonb NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS oa_cases_owner_idx ON oa_cases (owner, updated_at DESC)`,
  `CREATE TABLE IF NOT EXISTS oa_runs (
     owner text NOT NULL,
     patient_id text NOT NULL,
     result jsonb NOT NULL,
     ran_at timestamptz NOT NULL,
     PRIMARY KEY (owner, patient_id))`,
  `CREATE TABLE IF NOT EXISTS oa_audit (
     owner text NOT NULL,
     seq integer NOT NULL,
     at text NOT NULL,
     actor text NOT NULL,
     action text NOT NULL,
     patient_id text NOT NULL,
     card_id text,
     reason_code text,
     reason_text text,
     prev_hash text NOT NULL,
     hash text NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (owner, seq))`,
  `CREATE OR REPLACE FUNCTION oa_audit_append_only() RETURNS trigger AS $$
   BEGIN RAISE EXCEPTION 'oa_audit is append-only'; END; $$ LANGUAGE plpgsql`,
  `DROP TRIGGER IF EXISTS oa_audit_no_change ON oa_audit`,
  `CREATE TRIGGER oa_audit_no_change BEFORE UPDATE OR DELETE ON oa_audit FOR EACH ROW EXECUTE FUNCTION oa_audit_append_only()`,
];

const ready = new WeakMap<Db, Promise<void>>();

/** Create or upgrade the tables once per process. Safe under concurrent cold starts (one migrator at a time). */
export function ensureSchema(db: Db): Promise<void> {
  let p = ready.get(db);
  if (!p) {
    p = (async () => {
      if (await schemaCurrent(db)) return;
      await db.tx(async (t) => {
        if (db.driver === "postgres") await t.query(`SELECT pg_advisory_xact_lock(hashtext('oa_schema'))`);
        if (await schemaCurrent(t)) return;
        for (const stmt of SCHEMA) await t.query(stmt);
        await t.query(`INSERT INTO oa_meta (key, value) VALUES ('schema_version', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [String(SCHEMA_VERSION)]);
      });
    })();
    p.catch(() => ready.delete(db));
    ready.set(db, p);
  }
  return p;
}

async function schemaCurrent(db: Pick<Db, "query">): Promise<boolean> {
  const [t] = await db.query<{ t: string | null }>(`SELECT to_regclass('oa_meta')::text AS t`);
  if (!t?.t) return false;
  const [v] = await db.query<{ value: string }>(`SELECT value FROM oa_meta WHERE key = 'schema_version'`);
  return Number(v?.value) >= SCHEMA_VERSION;
}

// ---------- cases ----------

export interface StoredCaseRow {
  id: string;
  createdAt: string;
  updatedAt: string;
  input: CaseInput;
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString());
const json = <T,>(v: unknown): T => (typeof v === "string" ? (JSON.parse(v) as T) : (v as T));

export async function listCases(db: Db, owner: string): Promise<StoredCaseRow[]> {
  await ensureSchema(db);
  const rows = await db.query<{ id: string; input: unknown; created_at: unknown; updated_at: unknown }>(
    `SELECT id, input, created_at, updated_at FROM oa_cases WHERE owner = $1 ORDER BY updated_at DESC LIMIT 500`,
    [owner],
  );
  return rows.map((r) => ({ id: r.id, input: json<CaseInput>(r.input), createdAt: iso(r.created_at), updatedAt: iso(r.updated_at) }));
}

export async function getCaseRow(db: Db, owner: string, id: string): Promise<StoredCaseRow | null> {
  await ensureSchema(db);
  const [r] = await db.query<{ id: string; input: unknown; created_at: unknown; updated_at: unknown }>(
    `SELECT id, input, created_at, updated_at FROM oa_cases WHERE owner = $1 AND id = $2`,
    [owner, id],
  );
  return r ? { id: r.id, input: json<CaseInput>(r.input), createdAt: iso(r.created_at), updatedAt: iso(r.updated_at) } : null;
}

export async function upsertCase(db: Db, owner: string, id: string, input: CaseInput): Promise<StoredCaseRow> {
  await ensureSchema(db);
  // A case ID belongs to one owner; another owner's ID is refused rather than overwritten.
  const [r] = await db.query<{ id: string; owner: string; input: unknown; created_at: unknown; updated_at: unknown }>(
    `INSERT INTO oa_cases (id, owner, input) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (id) DO UPDATE SET input = EXCLUDED.input, updated_at = now() WHERE oa_cases.owner = EXCLUDED.owner
     RETURNING id, owner, input, created_at, updated_at`,
    [id, owner, JSON.stringify(input)],
  );
  if (!r) throw new Error("Case ID already in use");
  return { id: r.id, input: json<CaseInput>(r.input), createdAt: iso(r.created_at), updatedAt: iso(r.updated_at) };
}

export async function deleteCaseRow(db: Db, owner: string, id: string): Promise<boolean> {
  await ensureSchema(db);
  return db.tx(async (t) => {
    await t.query(`DELETE FROM oa_runs WHERE owner = $1 AND patient_id = $2`, [owner, id]);
    const rows = await t.query<{ id: string }>(`DELETE FROM oa_cases WHERE owner = $1 AND id = $2 RETURNING id`, [owner, id]);
    return rows.length > 0;
  });
}

// ---------- runs ----------

export async function saveRunRow(db: Db, owner: string, run: PipelineResult): Promise<void> {
  await ensureSchema(db);
  await db.query(
    `INSERT INTO oa_runs (owner, patient_id, result, ran_at) VALUES ($1, $2, $3::jsonb, $4)
     ON CONFLICT (owner, patient_id) DO UPDATE SET result = EXCLUDED.result, ran_at = EXCLUDED.ran_at`,
    [owner, run.patientId, JSON.stringify(run), run.ranAt],
  );
}

export async function getRuns(db: Db, owner: string, ids: string[]): Promise<Record<string, PipelineResult>> {
  await ensureSchema(db);
  if (!ids.length) return {};
  const rows = await db.query<{ patient_id: string; result: unknown }>(`SELECT patient_id, result FROM oa_runs WHERE owner = $1 AND patient_id = ANY($2::text[])`, [owner, ids]);
  return Object.fromEntries(rows.map((r) => [r.patient_id, json<PipelineResult>(r.result)]));
}

export async function deleteRunRow(db: Db, owner: string, id: string): Promise<void> {
  await ensureSchema(db);
  await db.query(`DELETE FROM oa_runs WHERE owner = $1 AND patient_id = $2`, [owner, id]);
}

// ---------- audit ----------

export interface AuditInput {
  actor: string;
  action: DecisionAction | "agent-run";
  patientId: string;
  cardId?: string;
  reasonCode?: string;
  reasonText?: string;
}

/** Same canonical form as the browser log, so both verify with the same rule. */
export function hashEntry(entry: Omit<AuditEntry, "hash">): string {
  const canonical = { seq: entry.seq, at: entry.at, prevHash: entry.prevHash, actor: entry.actor, action: entry.action, patientId: entry.patientId, cardId: entry.cardId, reasonCode: entry.reasonCode, reasonText: entry.reasonText };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

type AuditRow = { seq: number; at: string; actor: string; action: string; patient_id: string; card_id: string | null; reason_code: string | null; reason_text: string | null; prev_hash: string; hash: string };

const toEntry = (r: AuditRow): AuditEntry => ({
  seq: Number(r.seq),
  at: r.at,
  prevHash: r.prev_hash,
  actor: r.actor,
  action: r.action as AuditEntry["action"],
  patientId: r.patient_id,
  ...(r.card_id ? { cardId: r.card_id } : {}),
  ...(r.reason_code ? { reasonCode: r.reason_code } : {}),
  ...(r.reason_text ? { reasonText: r.reason_text } : {}),
  hash: r.hash,
});

export async function appendAuditRow(db: Db, owner: string, e: AuditInput): Promise<AuditEntry> {
  await ensureSchema(db);
  return db.tx(async (t) => {
    // Serialise appends per owner so the chain cannot fork under concurrent requests.
    if (db.driver === "postgres") await t.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`oa_audit:${owner}`]);
    const [last] = await t.query<{ seq: number; hash: string }>(`SELECT seq, hash FROM oa_audit WHERE owner = $1 ORDER BY seq DESC LIMIT 1`, [owner]);
    const base: Omit<AuditEntry, "hash"> = {
      seq: last ? Number(last.seq) + 1 : 1,
      at: new Date().toISOString(),
      prevHash: last?.hash ?? "0".repeat(64),
      actor: e.actor,
      action: e.action,
      patientId: e.patientId,
      ...(e.cardId ? { cardId: e.cardId } : {}),
      ...(e.reasonCode ? { reasonCode: e.reasonCode } : {}),
      ...(e.reasonText ? { reasonText: e.reasonText } : {}),
    };
    const hash = hashEntry(base);
    await t.query(
      `INSERT INTO oa_audit (owner, seq, at, actor, action, patient_id, card_id, reason_code, reason_text, prev_hash, hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [owner, base.seq, base.at, base.actor, base.action, base.patientId, base.cardId ?? null, base.reasonCode ?? null, base.reasonText ?? null, base.prevHash, hash],
    );
    return { ...base, hash };
  });
}

export async function listAudit(db: Db, owner: string): Promise<AuditEntry[]> {
  await ensureSchema(db);
  const rows = await db.query<AuditRow>(
    `SELECT seq, at, actor, action, patient_id, card_id, reason_code, reason_text, prev_hash, hash FROM oa_audit WHERE owner = $1 ORDER BY seq ASC`,
    [owner],
  );
  return rows.map(toEntry);
}

export function verifyChain(entries: AuditEntry[]): boolean {
  let prev = "0".repeat(64);
  for (const e of entries) {
    const { hash, ...rest } = e;
    if (rest.prevHash !== prev || hashEntry(rest) !== hash) return false;
    prev = hash;
  }
  return true;
}
