# HTTP API

All routes are Next.js route handlers in [`app/src/app/api/`](../app/src/app/api).

| Method | Path | Purpose | Auth |
|---|---|---|---|
| `POST` | `/api/auth/login` | Sign in; sets the session cookie | Public; lockout after repeated failures |
| `POST` | `/api/auth/logout` | Clear the session cookie | Public |
| `GET` | `/api/auth/session` | The signed-in clinician | Session |
| `POST` | `/api/agents/run` | Run the agent pipeline for one patient and stream progress as NDJSON | Session; Claude runs are rate-limited |
| `GET`, `POST` | `/api/cases` | List or create entered cases | Session + server storage |
| `GET`, `PUT`, `DELETE` | `/api/cases/[id]` | Read, create-or-update, or delete one case | Session + server storage |
| `GET` | `/api/runs?ids=P-001,C-…` | Latest stored run for each ID | Session + server storage |
| `DELETE` | `/api/runs/[id]` | Forget the stored run for one ID | Session + server storage |
| `GET`, `POST` | `/api/audit` | Read the account's audit log with a chain check, or append an entry | Session + server storage |
| `GET` | `/api/store` | Which storage this deployment uses | Session |
| `GET` | `/api/health` | Version, sign-in and storage readiness, Claude, CIViC and ClinicalTrials.gov | Public |
| `GET`, `POST`, `DELETE` | `/api/mcp` | MCP Streamable HTTP endpoint | Bearer token or session |

Base URL of the public demo: `https://oncoagent.vercel.app`. Locally: `http://localhost:3000`.

### Authentication

Sign in once; the session is a signed cookie (`oa_session`, `httpOnly`, `SameSite=Lax`, `Secure` in production, 12 hours). Without it, pages redirect to `/login?next=<page>` and API routes answer `401 {"error":"Sign in required"}`. Route handlers check the session again before touching data ([`proxy.ts`](../app/src/proxy.ts), [`auth.ts`](../app/src/lib/server/auth.ts)).

```bash
# sign in and keep the cookie
curl -s -c jar.txt https://oncoagent.vercel.app/api/auth/login \
  -H "content-type: application/json" -d '{"username":"<username>","password":"<password>"}'
# {"ok":true,"user":{"name":"…","role":"clinician","username":"…"},"next":"/"}

curl -s -b jar.txt https://oncoagent.vercel.app/api/auth/session
curl -s -b jar.txt -X POST https://oncoagent.vercel.app/api/auth/logout
```

| Login answer | Meaning |
|---|---|
| 200 | Signed in; `next` is a safe same-site path to open |
| 400 | Username or password missing |
| 401 | Wrong username or password (the same message for an unknown username) |
| 429 | 10 failures from this IP or 20 for this username within 15 minutes; see `retry-after` |
| 503 | Sign-in not configured (`AUTH_SECRET` missing) |

`POST`, `PUT`, `PATCH` and `DELETE` requests to `/api/*` that carry an `Origin` header from another site are refused with `403 {"error":"Cross-site request refused"}`.

The API has no version prefix. Every response carries the security headers set in [next.config.ts](../app/next.config.ts): Content Security Policy, `Strict-Transport-Security` (production), `Cross-Origin-Opener-Policy`, `Permissions-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and `X-Frame-Options: SAMEORIGIN`. API answers also carry `Cache-Control: no-store`.

## 1. `POST /api/agents/run`

Source: [route.ts](../app/src/app/api/agents/run/route.ts). Runs [`runPipeline()`](../app/src/lib/agents/pipeline.ts) on a demo patient or on a clinician-entered case, and streams each finished agent step as one line of JSON.

### Request

Two body shapes are accepted. A demo patient:

```http
POST /api/agents/run
Content-Type: application/json

{"patientId": "P-001", "useClaude": true}
```

A clinician-entered, de-identified case (the workspace sends this for `/cases/[id]`):

```http
POST /api/agents/run
Content-Type: application/json

{"caseId": "C-7K2M9Q", "caseInput": { "age": 66, "sex": "M", "…": "…" }, "useClaude": false}
```

| Field | Type | Required | Default | Meaning |
|---|---|---|---|---|
| `patientId` | string | for demo patients | | `P-001`, `P-002` or `P-003` |
| `caseId` | string | with `caseInput` | | Must match `C-` plus 6 upper-case letters or digits (`CASE_ID_PATTERN`) |
| `caseInput` | `CaseInput` | for entered cases | | Validated with `CaseInputSchema`; fields and limits in [DATA.md](DATA.md#31-caseinput) |
| `useClaude` | boolean | no | `true` | Add the Claude synthesis step. Send `false` for a rules-only run |

When `caseInput` is present it takes precedence over `patientId`. The server validates it, rebuilds the `Patient` record with `buildPatientFromInput()` ([caseInput.ts](../app/src/lib/caseInput.ts)) and keeps nothing after the response. It never accepts a client-built record.

If `useClaude` is true but the server has no `ANTHROPIC_API_KEY`, the run still succeeds and the synthesis step is reported as `skipped`.

### Response: NDJSON stream

`200 OK`, `content-type: application/x-ndjson; charset=utf-8`, `cache-control: no-store`. Each line is one JSON object with a `type`:

| `type` | When | Payload |
|---|---|---|
| `step` | After each agent finishes (nine in total, in order) | `step`: `{ agent, status, note, ms }`; `status` is `done`, `skipped` or `error` |
| `result` | Once, at the end of a successful run | `result`: the full `PipelineResult` (below) |
| `error` | Once, if the pipeline itself fails | `message`: string |

An exception inside one agent does not produce an `error` line. It produces a `step` with `status: "error"`, its message is added to `result.warnings`, and the run continues. An `error` line means the run could not complete (for example, no knowledge-pack entry for the patient's biomarker).

Example stream (rules-only, trimmed):

```text
{"type":"step","step":{"agent":"Sentinel","status":"done","note":"Record the baseline (54 mm) and schedule the first response scan per protocol after treatment starts.","ms":0}}
{"type":"step","step":{"agent":"Genomic-interpreter","status":"done","note":"1 variant(s) checked in CIViC (live)","ms":891}}
{"type":"step","step":{"agent":"Test-advisor","status":"done","note":"Order: Neurology review of the antiseizure drug; Baseline lipids, liver tests and CK.","ms":0}}
{"type":"step","step":{"agent":"Guideline","status":"done","note":"Discuss Alectinib as the leading option; Lorlatinib or Brigatinib as alternatives.","ms":0}}
{"type":"step","step":{"agent":"Pharmacology-safety","status":"done","note":"Before choosing a drug, ask neurology to replace carbamazepine …","ms":0}}
{"type":"step","step":{"agent":"Trial-matcher","status":"done","note":"85 recruiting studies (live)","ms":511}}
{"type":"step","step":{"agent":"Dose-optimizer","status":"done","note":"Dose card ready for Alectinib: …","ms":0}}
{"type":"step","step":{"agent":"Synthesis (Claude)","status":"skipped","note":"Rules-only run requested","ms":0}}
{"type":"step","step":{"agent":"Safety-critic","status":"done","note":"7 cards checked, 1 flagged","ms":0}}
{"type":"result","result":{"patientId":"P-003","ranAt":"2026-11-20T…Z","mode":"rules-only","steps":[…],"evidence":[…],"cards":[…],"boardSummary":"…","warnings":[],"dose":{…}}}
```

### `PipelineResult`

Defined by `AgentRunResult` in [types.ts](../app/src/lib/types.ts) plus `dose` in [pipeline.ts](../app/src/lib/agents/pipeline.ts).

| Field | Type | Meaning |
|---|---|---|
| `patientId` | string | Patient ID |
| `ranAt` | ISO datetime | When the run finished |
| `mode` | `rules-only` \| `claude` | Whether synthesis ran |
| `model` | string, optional | Model that answered the synthesis (from the API response) |
| `steps` | array | `{ agent, status, note, ms }` per agent, in order |
| `evidence` | `EvidenceItem[]` | The run's evidence registry (`pt:`, `kb:`, `civic:`, `trial:`, `label:`, `calc:`) |
| `cards` | `RecommendationCard[]` | Claude cards first, then rules cards; each with a critic verdict |
| `boardSummary` | string | Tumour-board pre-read (Claude, or a rules-based fallback sentence) |
| `warnings` | string[] | Messages from agents that failed |
| `usage` | `{ inputTokens, outputTokens }`, optional | Claude token usage |
| `dose` | `DoseCard`, optional | BSA, CrCl, dose lines with formulas, blocks, warnings, premedication |

Card and evidence fields: [AGENTS.md](AGENTS.md#3-recommendation-card-schema). Dose card fields: [DATA.md](DATA.md#1-data-model).

### Errors

| Status | Body | Cause |
|---|---|---|
| `401` | `{"error":"Sign in required"}` | No valid session cookie |
| `400` | `{"error":"Invalid JSON body"}` | Body is not JSON |
| `400` | `{"error":"Invalid caseId"}` | `caseInput` sent without a valid `caseId` |
| `400` | `{"error":"Invalid case","issues":["age: Too small: expected number to be >=18","creatinineDate: Not a real date"]}` | `caseInput` fails `CaseInputSchema`; up to 8 issues as `path: message` |
| `404` | `{"error":"Unknown patientId"}` | No `caseInput`, and a missing or unknown `patientId` |
| `429` | `{"error":"Live Claude runs are limited to 6 per 10 minutes in this public demo. Try again in N min, or run the rules-only agents now"}` with header `retry-after: <seconds>` | Rate limit (below) |
| `200` + `error` line | `{"type":"error","message":"…"}` | Pipeline failed after the stream started |

### Rate limit

Live Claude runs are limited to **6 per 10 minutes per client IP** (`CLAUDE_RUNS_PER_IP`, `CLAUDE_WINDOW_MS` in [ratelimit.ts](../app/src/lib/ratelimit.ts)). A request counts only when `useClaude` is not `false` **and** the server has an API key, so rules-only runs and runs on a server without a key are never limited. The IP is the first address in `x-forwarded-for` (or `local`). The limiter is a sliding window of timestamps kept in memory per function instance, so the effective limit can be higher when the platform runs several instances, and it resets on a cold start.

### Limits

- `maxDuration = 300` seconds. A Claude run takes about 23 s; a rules-only run about 2 s, mostly the CIViC and ClinicalTrials.gov calls.
- External calls time out after 12 s each and fall back to the committed snapshots.
- A dropped connection cannot be resumed; start a new run.

### curl

Sign in first and pass the cookie jar (`-b jar.txt`, see [Authentication](#authentication)). Rules-only run, print each line as it arrives:

```bash
curl -N -s -b jar.txt https://oncoagent.vercel.app/api/agents/run \
  -H "content-type: application/json" \
  -d '{"patientId":"P-002","useClaude":false}'
```

Keep only the final cards with their critic verdicts (needs `jq`):

```bash
curl -N -s -b jar.txt https://oncoagent.vercel.app/api/agents/run \
  -H "content-type: application/json" \
  -d '{"patientId":"P-003","useClaude":false}' \
  | jq -c 'select(.type=="result") | .result.cards[] | {agent, kind, verdict: .critic.verdict, proposal}'
```

Run with Claude synthesis and show the rate-limit headers if you hit the limit:

```bash
curl -N -s -D - -b jar.txt https://oncoagent.vercel.app/api/agents/run \
  -H "content-type: application/json" \
  -d '{"patientId":"P-001"}'
```

Rules-only run on a de-identified case (the body is a full `CaseInput`; see [MCP.md](MCP.md#38-analyze_case) for a complete example):

```bash
curl -N -s -b jar.txt https://oncoagent.vercel.app/api/agents/run   -H "content-type: application/json"   -d @case.json     # {"caseId":"C-7K2M9Q","caseInput":{…},"useClaude":false}
```

### How the workspace uses it

[AgentWorkspace.tsx](../app/src/components/AgentWorkspace.tsx) sends `{ patientId, useClaude }` for a demo patient or `{ caseId, caseInput, useClaude }` for an entered case, reads the stream with `fetch` and a `TextDecoder`, splits on newlines and updates the step tiles for each `step`. With server storage, the route itself stores the finished run and an `agent-run` audit entry signed by the session user, and the `result` line carries `persisted: true`. In browser mode the workspace saves the run in the browser (`saveRun()`, keyed by patient or case ID) and writes the `agent-run` entry there. If browser storage is blocked, the finished run stays on screen for the visit. An `error` line or a non-200 response is shown above the cards, the previous run stays on screen, and the clinician is offered a rules-only run.

## 2. `GET /api/health`

Source: [route.ts](../app/src/app/api/health/route.ts). Powers the status chip in the top bar. Rendered per request (`dynamic = "force-dynamic"`), `cache-control: no-store`.

```bash
curl -s https://oncoagent.vercel.app/api/health
```

```json
{
  "status": "ok",
  "version": "0.4.0",
  "auth": { "required": true, "ready": true },
  "storage": { "mode": "browser", "ok": true },
  "claude": { "configured": true, "model": "claude-opus-5-5" },
  "civic": { "live": true, "ms": 412, "fallback": "stored snapshot" },
  "trials": { "live": true, "ms": 298, "fallback": "stored snapshot" },
  "checkedAt": "2026-11-20T…Z"
}
```

| Field | Meaning |
|---|---|
| `status` | `ok`, or `degraded` when sign-in is required but not configured, or the database cannot be reached. `degraded` answers HTTP 503 |
| `version` | App version |
| `auth.required`, `auth.ready` | Sign-in is on; `AUTH_SECRET` and at least one account are configured |
| `storage.mode`, `storage.ok` | `server` (PostgreSQL) or `browser`; for `server`, whether a test query succeeded (`storage.driver`, and `storage.error` on failure) |
| `claude.configured` | `ANTHROPIC_API_KEY` is set on the server. The key itself is never returned. This does not call the Claude API |
| `claude.model` | The pinned model ID |
| `civic.live`, `civic.ms` | A `{ __typename }` GraphQL query to CIViC answered with HTTP 2xx within 4 s, and how long it took |
| `trials.live`, `trials.ms` | `GET https://clinicaltrials.gov/api/v2/version` answered with HTTP 2xx within 4 s |
| `*.fallback` | What the agents use when the source is down |
| `checkedAt` | Time of the check |

The top bar shows "Agents online" when all three are true, "Rules-only mode" when Claude is not configured, and "Snapshot mode" when a source is down.

## 3. `/api/mcp`

The MCP Streamable HTTP endpoint for `oncoagent-mcp`. Methods `GET`, `POST` and `DELETE`; `maxDuration = 300` seconds. A request is accepted with `Authorization: Bearer <MCP_BEARER_TOKEN>` (compared in constant time) or with a signed-in session (the in-app tester on `/mcp`). Otherwise it gets `401 {"error":"unauthorized"}` and `www-authenticate: Bearer`. The endpoint is open only when no token is set and sign-in is off. Tools, schemas and examples: [MCP.md](MCP.md).

## 4. Storage API

Available when `DATABASE_URL` is set; otherwise these routes answer `503 {"error":"Server storage is not configured","mode":"browser"}` and the app keeps data in the browser. Every query is limited to the signed-in account. Sources: [`api/cases`](../app/src/app/api/cases), [`api/runs`](../app/src/app/api/runs), [`api/audit`](../app/src/app/api/audit), [`store.ts`](../app/src/lib/server/store.ts).

| Request | Body | Answer |
|---|---|---|
| `GET /api/cases` | — | `{ cases: StoredCase[] }`, newest first |
| `POST /api/cases` | `{ id?, input: CaseInput }` | `201 { case }`; a new `C-XXXXXX` ID when `id` is left out; `409` if the ID belongs to another account |
| `GET /api/cases/C-XXXXXX` | — | `{ case }` or `404` |
| `PUT /api/cases/C-XXXXXX` | `{ input: CaseInput }` | `{ case }` (creates or updates) |
| `DELETE /api/cases/C-XXXXXX` | — | `{ ok: true }`; the case's stored run goes with it |
| `GET /api/runs?ids=P-001,C-XXXXXX` | — | `{ runs: { [id]: PipelineResult } }`; up to 200 IDs |
| `DELETE /api/runs/P-001` | — | `{ ok: true }` |
| `GET /api/audit` | — | `{ entries: AuditEntry[], chainOk: boolean }` |
| `POST /api/audit` | `{ action: "approve" \| "modify" \| "reject" \| "agent-run", patientId, cardId?, reasonCode?, reasonText? }` | `201 { entry }`. `actor` is the session user. A decision needs `cardId`; `modify` and `reject` need a reason of 5 or more characters |
| `GET /api/store` | — | `{ mode: "server" \| "browser", driver }` |

`CaseInput` is validated with the same Zod schema as the run API ([caseInput.ts](../app/src/lib/caseInput.ts)); invalid input answers `400` with up to eight `issues`. Bodies are limited to 256 KB (16 KB for audit entries). Audit entries cannot be changed or deleted: the database refuses `UPDATE` and `DELETE` on `oa_audit`.

## 5. Pages

Not an API, listed for completeness. Every page except `/login` needs a session.

| Path | Content |
|---|---|
| `/login` | Sign-in; `?next=<path>` opens that page afterwards |
| `/` | Overview: pending cards, recent activity, evaluation headline numbers |
| `/patients` | Demo patients and the entered cases (this account's, or this browser's) |
| `/patients/[id]` | Patient record: summary, RECIST and ctDNA charts, agent run, cards, dose card, evidence, audit log, timeline, 3D structure, molecular profile, trials |
| `/patients/[id]/report` | Printable A4 tumour-board pre-read |
| `/cases/new` | Case intake form (`?edit=C-XXXXXX` to edit a saved case) |
| `/cases/[id]` | Record view of an entered case, read from server or browser storage, with edit and delete |
| `/cases/[id]/report` | Printable tumour-board pre-read for an entered case |
| `/queue` | Decision queue across patients |
| `/mcp` | MCP endpoint, client setup and the in-browser tool tester |
| `/evaluation` | Results from `eval-results.json` |
| `/architecture` | "How it works" summary |

## 6. Error code summary

| Code | Route | Meaning |
|---|---|---|
| 200, 201 | all | Success; for `/api/agents/run` check for an `error` line in the stream |
| 400 | `/api/agents/run`, storage, login | Body is not valid JSON, invalid ID, or input fails validation (see `issues`) |
| 401 | all except `/api/health` and `/api/auth/*` | Not signed in; on `/api/mcp`, no session and no or a wrong bearer token; on login, wrong username or password |
| 403 | `/api/*` (unsafe methods) | Cross-site request refused |
| 404 | `/api/agents/run`, `/api/cases/[id]` | Unknown patient or case |
| 409 | `/api/cases` | Case ID already in use by another account |
| 429 | `/api/agents/run`, `/api/auth/login` | Claude run rate limit, or sign-in lockout; see `retry-after` |
| 503 | storage routes, `/api/auth/login`, `/api/health` | Server storage not configured or unreachable; sign-in not configured |
| 5xx | any | Platform or function error (for example a timeout beyond `maxDuration`) |

MCP tool-level errors (unknown patient, refused decision) are not HTTP errors: they return `isError: true` inside a successful JSON-RPC result ([MCP.md](MCP.md)).
