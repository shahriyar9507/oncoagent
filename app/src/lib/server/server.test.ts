import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";
import { authenticate } from "./users";
import { SESSION_COOKIE, readCookie, safeNext, signSession, verifySessionToken } from "../session";
import { pglite, setDbForTests, type Db } from "./db";
import { appendAuditRow, deleteCaseRow, ensureSchema, getCaseRow, getRuns, hashEntry, listAudit, listCases, saveRunRow, upsertCase, verifyChain } from "./store";
import type { CaseInput } from "../caseInput";
import type { PipelineResult } from "../agents/pipeline";
import { POST as login } from "../../app/api/auth/login/route";
import { GET as session } from "../../app/api/auth/session/route";
import { GET as listCasesRoute, POST as createCaseRoute } from "../../app/api/cases/route";
import { GET as getCaseRoute, DELETE as deleteCaseRoute } from "../../app/api/cases/[id]/route";
import { GET as auditRoute, POST as appendAuditRoute } from "../../app/api/audit/route";
import { GET as runsRoute } from "../../app/api/runs/route";
import { POST as mcpRoute } from "../../app/api/mcp/route";

const SECRET = "test-secret-0123456789-abcdefghijklmnopqrstuvwxyz";
const CASE: CaseInput = {
  age: 58, sex: "F", smoking: "never", histology: "adenocarcinoma", stage: "IVB", ecog: 1, pdl1Tps: 5,
  weightKg: 52, heightCm: 155, creatinineMgDl: 0.7, creatinineDate: "2026-11-18", reportDate: "2026-11-15",
  variants: [{ gene: "EGFR", alteration: "Exon 19 Deletion", kind: "indel", sample: "tissue", vafPercent: 28 }],
  testedNegative: ["ALK", "ROS1"], priorLines: [], medications: ["Omeprazole"], recist: [{ date: "2026-11-12", sumMm: 48, newLesions: false }], asOf: "2026-11-20",
};
const RUN = { patientId: "C-ABC234", ranAt: "2026-11-20T08:00:00.000Z", mode: "rules", cards: [], steps: [] } as unknown as PipelineResult;

const env = (vars: Record<string, string | undefined>) => {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
};

describe("password hashing", () => {
  it("verifies the right password and refuses a wrong one", () => {
    const h = hashPassword("correct horse battery", 1024);
    expect(h.startsWith("scrypt$1024$8$1$")).toBe(true);
    expect(verifyPassword("correct horse battery", h)).toBe(true);
    expect(verifyPassword("correct horse batterY", h)).toBe(false);
  });
  it("salts every hash and rejects malformed input", () => {
    expect(hashPassword("same", 1024)).not.toBe(hashPassword("same", 1024));
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "bcrypt$foo")).toBe(false);
    expect(verifyPassword("x", "scrypt$1024$8$1$$")).toBe(false);
  });
});

describe("accounts and sessions", () => {
  beforeAll(() => env({ AUTH_SECRET: SECRET, AUTH_USERNAME: "Doctor", AUTH_PASSWORD_HASH: hashPassword("s3cret-pass", 1024), AUTH_DISPLAY_NAME: "Dr. Test", AUTH_ROLE: undefined, AUTH_USERS: JSON.stringify([{ username: "nurse", passwordHash: hashPassword("nurse-pass", 1024), name: "Nurse A", role: "nurse" }]) }));
  afterAll(() => env({ AUTH_USERNAME: undefined, AUTH_PASSWORD_HASH: undefined, AUTH_DISPLAY_NAME: undefined, AUTH_USERS: undefined }));

  it("authenticates env accounts case-insensitively by username", () => {
    expect(authenticate("doctor", "s3cret-pass")).toEqual({ sub: "doctor", name: "Dr. Test", role: "clinician" });
    expect(authenticate(" DOCTOR ", "s3cret-pass")?.sub).toBe("doctor");
    expect(authenticate("nurse", "nurse-pass")).toEqual({ sub: "nurse", name: "Nurse A", role: "nurse" });
  });
  it("refuses wrong passwords and unknown users", () => {
    expect(authenticate("doctor", "S3cret-pass")).toBeNull();
    expect(authenticate("nobody", "s3cret-pass")).toBeNull();
  });
  it("signs and verifies a session; a tampered or foreign token fails", async () => {
    const t = await signSession({ sub: "doctor", name: "Dr. Test", role: "clinician" });
    expect(await verifySessionToken(t)).toEqual({ sub: "doctor", name: "Dr. Test", role: "clinician" });
    expect(await verifySessionToken(t.slice(0, -2) + (t.endsWith("A") ? "BB" : "AA"))).toBeNull();
    env({ AUTH_SECRET: "another-secret-0123456789-abcdefghijklmnop" });
    expect(await verifySessionToken(t)).toBeNull();
    env({ AUTH_SECRET: SECRET });
    expect(await verifySessionToken(undefined)).toBeNull();
  });
  it("invalidates every session when AUTH_SESSION_VERSION changes", async () => {
    const t = await signSession({ sub: "doctor", name: "Dr. Test", role: "clinician" });
    env({ AUTH_SESSION_VERSION: "2" });
    expect(await verifySessionToken(t)).toBeNull();
    env({ AUTH_SESSION_VERSION: undefined });
    expect(await verifySessionToken(t)).not.toBeNull();
  });
  it("refuses to sign without a long enough secret", async () => {
    env({ AUTH_SECRET: "short" });
    await expect(signSession({ sub: "a", name: "a", role: "clinician" })).rejects.toThrow(/AUTH_SECRET/);
    env({ AUTH_SECRET: SECRET });
  });
  it("only accepts same-site relative redirect targets", () => {
    expect(safeNext("/patients/P-001")).toBe("/patients/P-001");
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil", "/login", undefined, 42]) expect(safeNext(bad)).toBe("/");
  });
  it("reads a cookie from a raw header", () => {
    expect(readCookie("a=1; oa_session=abc%3D; b=2", "oa_session")).toBe("abc=");
    expect(readCookie(null, "oa_session")).toBeUndefined();
  });
});

describe("server store (PGlite)", () => {
  let db: Db;
  beforeAll(async () => {
    db = await pglite("memory");
    await ensureSchema(db);
  }, 60_000);

  it("creates the schema once and is safe to call again", async () => {
    await ensureSchema(db);
    const [v] = await db.query<{ value: string }>(`SELECT value FROM oa_meta WHERE key = 'schema_version'`);
    expect(Number(v.value)).toBeGreaterThanOrEqual(1);
  });

  it("stores cases per owner and refuses another owner's case ID", async () => {
    const saved = await upsertCase(db, "alice", "C-ABC234", CASE);
    expect(saved.input.variants[0].gene).toBe("EGFR");
    const again = await upsertCase(db, "alice", "C-ABC234", { ...CASE, ecog: 2 });
    expect(again.input.ecog).toBe(2);
    expect(again.createdAt).toBe(saved.createdAt);
    await expect(upsertCase(db, "bob", "C-ABC234", CASE)).rejects.toThrow("Case ID already in use");
    expect((await listCases(db, "alice")).map((c) => c.id)).toEqual(["C-ABC234"]);
    expect(await listCases(db, "bob")).toEqual([]);
    expect(await getCaseRow(db, "bob", "C-ABC234")).toBeNull();
  });

  it("keeps the latest run per owner and patient, and deletes it with the case", async () => {
    await saveRunRow(db, "alice", RUN);
    await saveRunRow(db, "alice", { ...RUN, ranAt: "2026-11-20T09:00:00.000Z" });
    const runs = await getRuns(db, "alice", ["C-ABC234", "P-001"]);
    expect(Object.keys(runs)).toEqual(["C-ABC234"]);
    expect(runs["C-ABC234"].ranAt).toBe("2026-11-20T09:00:00.000Z");
    expect(await getRuns(db, "bob", ["C-ABC234"])).toEqual({});
    expect(await deleteCaseRow(db, "alice", "C-ABC234")).toBe(true);
    expect(await getRuns(db, "alice", ["C-ABC234"])).toEqual({});
    expect(await deleteCaseRow(db, "alice", "C-ABC234")).toBe(false);
  });

  it("appends a hash chain per owner that verifies, and detects tampering", async () => {
    const a1 = await appendAuditRow(db, "alice", { actor: "Dr. A", action: "agent-run", patientId: "P-001", reasonText: "Live rules-only run" });
    const a2 = await appendAuditRow(db, "alice", { actor: "Dr. A", action: "approve", patientId: "P-001", cardId: "P-001-c1" });
    const b1 = await appendAuditRow(db, "bob", { actor: "Dr. B", action: "reject", patientId: "P-002", cardId: "P-002-c1", reasonText: "Patient declined" });
    expect([a1.seq, a2.seq, b1.seq]).toEqual([1, 2, 1]);
    expect(a2.prevHash).toBe(a1.hash);
    const log = await listAudit(db, "alice");
    expect(log).toHaveLength(2);
    expect(verifyChain(log)).toBe(true);
    expect(verifyChain([{ ...log[0], actor: "Someone else" }, log[1]])).toBe(false);
    const { hash, ...rest } = log[1];
    expect(hashEntry(rest)).toBe(hash);
  });

  it("refuses UPDATE and DELETE on the audit table", async () => {
    await expect(db.query(`UPDATE oa_audit SET actor = 'x' WHERE owner = 'alice'`)).rejects.toThrow(/append-only/);
    await expect(db.query(`DELETE FROM oa_audit WHERE owner = 'alice'`)).rejects.toThrow(/append-only/);
    expect(await listAudit(db, "alice")).toHaveLength(2);
  });
});

describe("storage API routes", () => {
  let cookie = "";
  const req = (path: string, init: RequestInit = {}) => new Request(`http://localhost${path}`, { ...init, headers: { cookie, "content-type": "application/json", ...(init.headers ?? {}) } });

  beforeAll(async () => {
    env({ AUTH_SECRET: SECRET, AUTH_MODE: undefined, AUTH_USERNAME: "doctor", AUTH_PASSWORD_HASH: hashPassword("s3cret-pass", 1024), AUTH_DISPLAY_NAME: "Dr. Route" });
    setDbForTests(await pglite("memory"));
  }, 60_000);
  afterAll(() => {
    setDbForTests(null);
    env({ AUTH_USERNAME: undefined, AUTH_PASSWORD_HASH: undefined, AUTH_DISPLAY_NAME: undefined });
  });
  beforeEach(() => {
    cookie = "";
  });

  async function signIn() {
    const res = await login(req("/api/auth/login", { method: "POST", body: JSON.stringify({ username: "doctor", password: "s3cret-pass", next: "/cases" }), headers: { "x-forwarded-for": "10.0.0.1" } }));
    expect(res.status).toBe(200);
    expect((await res.json()).next).toBe("/cases");
    const set = res.headers.get("set-cookie") ?? "";
    expect(set).toMatch(/HttpOnly/);
    expect(set).toMatch(/SameSite=Lax/);
    cookie = set.split(";")[0];
    expect(cookie.startsWith(`${SESSION_COOKIE}=`)).toBe(true);
  }

  it("refuses a wrong password with 401 and sets no cookie", async () => {
    const res = await login(req("/api/auth/login", { method: "POST", body: JSON.stringify({ username: "doctor", password: "nope" }), headers: { "x-forwarded-for": "10.0.0.2" } }));
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("locks an address out after repeated failures", async () => {
    let last = 0;
    for (let i = 0; i < 11; i++) last = (await login(req("/api/auth/login", { method: "POST", body: JSON.stringify({ username: "doctor", password: `bad-${i}` }), headers: { "x-forwarded-for": "10.0.0.9" } }))).status;
    expect(last).toBe(429);
  });

  it("requires a session for every storage route, and a token, session or MCP_PUBLIC for MCP", async () => {
    expect((await listCasesRoute(req("/api/cases"))).status).toBe(401);
    expect((await auditRoute(req("/api/audit"))).status).toBe(401);
    expect((await session(req("/api/auth/session"))).status).toBe(401);
    env({ MCP_BEARER_TOKEN: "mcp-test-token-123", MCP_PUBLIC: undefined });
    const call = (headers: Record<string, string> = {}) =>
      mcpRoute(new Request("http://localhost/api/mcp", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) }));
    try {
      const anon = await call();
      expect(anon.status).toBe(401);
      expect(anon.headers.get("www-authenticate")).toBe("Bearer");
      expect((await call({ authorization: "Bearer wrong-token-000000" })).status).toBe(401);
      expect((await call({ authorization: "Bearer mcp-test-token-123" })).status).toBe(200);
      await signIn();
      expect((await call({ cookie })).status).toBe(200);
      env({ MCP_PUBLIC: "true" });
      expect((await call()).status).toBe(200);
    } finally {
      env({ MCP_BEARER_TOKEN: undefined, MCP_PUBLIC: undefined });
    }
  });

  it("round-trips a case, a decision and the audit chain for the signed-in user", async () => {
    await signIn();
    const me = await (await session(req("/api/auth/session"))).json();
    expect(me.user).toMatchObject({ username: "doctor", name: "Dr. Route" });

    const created = await createCaseRoute(req("/api/cases", { method: "POST", body: JSON.stringify({ id: "C-ROUTE1", input: CASE }) }));
    expect(created.status).toBe(201);
    const list = await (await listCasesRoute(req("/api/cases"))).json();
    expect(list.cases.map((c: { id: string }) => c.id)).toContain("C-ROUTE1");
    const one = await getCaseRoute(req("/api/cases/C-ROUTE1"), { params: Promise.resolve({ id: "C-ROUTE1" }) });
    expect(one.status).toBe(200);

    const bad = await appendAuditRoute(req("/api/audit", { method: "POST", body: JSON.stringify({ action: "reject", patientId: "C-ROUTE1", cardId: "C-ROUTE1-c1", reasonText: "no" }) }));
    expect(bad.status).toBe(400);
    const ok = await appendAuditRoute(req("/api/audit", { method: "POST", body: JSON.stringify({ action: "approve", patientId: "C-ROUTE1", cardId: "C-ROUTE1-c1", actor: "Forged Name" }) }));
    expect(ok.status).toBe(201);
    expect((await ok.json()).entry.actor).toBe("Dr. Route");
    const audit = await (await auditRoute(req("/api/audit"))).json();
    expect(audit.chainOk).toBe(true);
    expect(audit.entries).toHaveLength(1);

    expect((await runsRoute(req("/api/runs?ids=C-ROUTE1,P-001"))).status).toBe(200);
    expect((await runsRoute(req("/api/runs?ids=../etc"))).status).toBe(400);
    const del = await deleteCaseRoute(req("/api/cases/C-ROUTE1", { method: "DELETE" }), { params: Promise.resolve({ id: "C-ROUTE1" }) });
    expect(del.status).toBe(200);
  });

  it("rejects invalid case bodies with field-level issues", async () => {
    await signIn();
    const res = await createCaseRoute(req("/api/cases", { method: "POST", body: JSON.stringify({ input: { ...CASE, age: 12 } }) }));
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.issues.join(" ")).toMatch(/age/);
  });
});
