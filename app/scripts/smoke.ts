// Post-deploy smoke test: health, sign-in gate, login, session, a rules-only agent run and sign-out.
// Usage: OA_USER=<username> OA_PASS=<password> npm run smoke -- https://your-deployment.example
// Without OA_USER/OA_PASS only the public checks run. Nothing is written except one agent run (and its audit entry
// when server storage is on), recorded under the signing-in account.
const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const user = process.env.OA_USER;
const pass = process.env.OA_PASS;
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

async function main() {
  const h = await fetch(`${base}/api/health`);
  const hj = (await h.json().catch(() => ({}))) as { status?: string; version?: string; auth?: { required: boolean; ready: boolean }; storage?: { mode: string; ok: boolean } };
  check("health answers", h.ok, `${h.status} · v${hj.version} · storage ${hj.storage?.mode}`);
  check("sign-in is configured", hj.auth?.ready === true, JSON.stringify(hj.auth));
  const page = await fetch(`${base}/patients`, { redirect: "manual" });
  check("pages are gated", !hj.auth?.required || (page.status >= 300 && page.status < 400 && (page.headers.get("location") ?? "").includes("/login")), String(page.status));
  const api = await fetch(`${base}/api/cases`);
  check("API is gated", !hj.auth?.required || api.status === 401, String(api.status));
  if (!user || !pass) {
    console.log("OA_USER / OA_PASS not set: skipping sign-in checks.");
    return;
  }
  const bad = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: user, password: `${pass}-wrong` }) });
  check("wrong password refused", bad.status === 401, String(bad.status));
  const res = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: user, password: pass }) });
  const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
  check("sign-in works", res.ok && cookie.startsWith("oa_session="), String(res.status));
  if (!res.ok) return;
  const headers = { cookie, "content-type": "application/json" };
  const me = (await (await fetch(`${base}/api/auth/session`, { headers })).json()) as { user?: { username: string } };
  check("session resolves", me.user?.username === user.toLowerCase(), me.user?.username);
  const home = await fetch(`${base}/patients`, { headers, redirect: "manual" });
  check("signed-in page loads", home.status === 200, String(home.status));
  const run = await fetch(`${base}/api/agents/run`, { method: "POST", headers, body: JSON.stringify({ patientId: "P-001", useClaude: false }) });
  const lines = (await run.text()).trim().split("\n").map((l) => JSON.parse(l) as { type: string; result?: { cards: unknown[] }; persisted?: boolean });
  const result = lines.find((l) => l.type === "result");
  check("rules-only agent run completes", !!result && (result.result?.cards.length ?? 0) > 0, `${result?.result?.cards.length ?? 0} cards · persisted=${result?.persisted}`);
  const out = await fetch(`${base}/api/auth/logout`, { method: "POST", headers });
  check("sign-out clears the cookie", out.ok && /Max-Age=0/i.test(out.headers.get("set-cookie") ?? ""), String(out.status));
}

main()
  .catch((e) => {
    failed++;
    console.error("Smoke test crashed:", (e as Error).message);
  })
  .finally(() => {
    console.log(failed ? `\n${failed} check(s) failed` : "\nAll smoke checks passed");
    process.exit(failed ? 1 : 0);
  });
