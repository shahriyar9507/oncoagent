# Deployment and operations

How to run OncoAgent locally, configure it, test it, deploy it to Vercel, refresh its data, rotate its keys, and what must change before production.

## 1. Requirements

| | |
|---|---|
| Node.js | 20.12 or later. `package.json` declares `>=20.9` for the app; the scripts use `process.loadEnvFile`, which needs 20.12. Developed on Node 24 |
| npm | Comes with Node. [app/.npmrc](../app/.npmrc) sets `legacy-peer-deps=true` |
| Anthropic API key | Optional. Without it every run is rules-only |
| Network | Outbound HTTPS to `civicdb.org` and `clinicaltrials.gov` (falls back to committed snapshots), `api.anthropic.com` (only with a key), and from the browser to `cdn.jsdelivr.net` and `files.rcsb.org` for the 3D view |

Main dependencies ([package.json](../app/package.json)): Next.js 16.4, React 19.3, `@anthropic-ai/sdk`, `@modelcontextprotocol/server` and `/client` v2, `mcp-handler`, Zod 4, Vitest, tsx.

## 2. Local development

```bash
git clone https://github.com/shahriyar9507/oncoagent.git
cd oncoagent/app
npm install
npm run dev            # http://localhost:3000
```

To enable Claude synthesis, create `app/.env.local` (git-ignored) with your own key:

```bash
ANTHROPIC_API_KEY=<your Anthropic API key>
```

Restart `npm run dev` after changing environment variables. The top-bar chip shows "Agents online" when Claude is configured and both evidence sources answer, "Rules-only mode" without a key, and "Snapshot mode" when CIViC or ClinicalTrials.gov cannot be reached.

## 3. Environment variables

All are optional and server-side only. None has a `NEXT_PUBLIC_` prefix, so none reaches the browser.

| Variable | Used by | Effect when set | Effect when unset |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | [claude.ts](../app/src/lib/agents/claude.ts), [health route](../app/src/app/api/health/route.ts) | Synthesis step calls `claude-opus-5-5` | Synthesis step is `skipped` ("No API key configured"); everything else works |
| `CLINICIAN_TOKEN` | `record_decision` in [tools.ts](../app/src/lib/mcp/tools.ts) | MCP clients that present this token can sign decisions | `record_decision` always refuses |
| `MCP_BEARER_TOKEN` | [api/mcp/route.ts](../app/src/app/api/mcp/route.ts) | `/api/mcp` requires `Authorization: Bearer <token>` | `/api/mcp` is open |

Where they are read from:

| Context | Source |
|---|---|
| `npm run dev`, `npm run build`, `npm start` | `app/.env.local` (Next.js) |
| `npm run precompute` | `../.env.local` then `.env.local`, relative to `app/` |
| `npm run mcp:stdio` | `.env.local` then `../.env.local`, relative to the working directory |
| Vercel | Project environment variables (encrypted at rest by Vercel) |

`.env*` files are listed in both [.gitignore](../app/.gitignore) and [.vercelignore](../app/.vercelignore). Never commit a key and never paste one into an issue or a log.

## 4. Scripts

Run from `app/`.

| Command | What it does | Network | Writes |
|---|---|---|---|
| `npm run dev` | Development server on port 3000 | Yes | — |
| `npm run build` / `npm start` | Production build and server | Yes at runtime | `.next/` |
| `npm run lint` | ESLint (Next.js core web vitals and TypeScript rules) | No | — |
| `npm run typecheck` | TypeScript check without emitting (`tsc --noEmit`, strict mode) | No | — |
| `npm test` | Vitest: 167 tests in four files: case input and critic (11), calculators and RECIST 1.1 ([clinical.test.ts](../app/src/lib/clinical/clinical.test.ts), 10), report reader ([extract.test.ts](../app/src/lib/clinical/extract.test.ts), 81), knowledge pack, selector and dosing methods ([knowledge.test.ts](../app/src/lib/clinical/knowledge.test.ts), 65) | No | — |
| `npm run eval` | Runs Vitest to count the unit tests, scores the stored runs against gold answers and runs the adversarial set ([eval.ts](../app/scripts/eval.ts)) | No | `src/lib/data/eval-results.json` |
| `npm run precompute [P-001 …]` | Runs the full pipeline with Claude for all or the named cases ([precompute.ts](../app/scripts/precompute.ts)) | Yes, calls Claude (about US$0.065 per case) | `src/lib/data/snapshots/*.json` |
| `npm run snapshot` | Re-fetches CIViC and ClinicalTrials.gov data for the three cases ([snapshot.ts](../app/scripts/snapshot.ts)) | Yes | `src/lib/tools/cache/civic.json`, `trials.json` |
| `npm run mcp:stdio` | Starts `oncoagent-mcp` over stdio ([mcp/stdio.ts](../app/mcp/stdio.ts)) | As tools need | — |
| `npm run mcp:smoke` | Connects over stdio, lists tools, calls four of them ([mcp-smoke.ts](../app/scripts/mcp-smoke.ts)); pass a URL to test HTTP | Yes | — |

Before a pull request: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` (see [CONTRIBUTING.md](../CONTRIBUTING.md)). After any change to prompts, the model, rules, the knowledge pack or tools, also run `npm run precompute` and `npm run eval` and review the diffs ([EVALUATION.md](EVALUATION.md#4-how-to-run)).

## 5. Deploy to Vercel

The public demo runs on Vercel at `https://oncoagent.vercel.app`. The Vercel project's root directory is `app/`.

### With the Vercel CLI

```bash
npm i -g vercel
cd app
vercel link                                   # once: choose or create the project
vercel env add ANTHROPIC_API_KEY production   # paste the key when prompted
vercel env add MCP_BEARER_TOKEN production    # optional
vercel env add CLINICIAN_TOKEN production     # optional
vercel deploy --prod
```

`vercel link` creates `app/.vercel/` (git-ignored). `.vercelignore` keeps `.env*`, `.next`, `node_modules` and logs out of the upload.

### With Git integration

1. Import the GitHub repository in Vercel.
2. Set **Root Directory** to `app`. The framework preset is detected as Next.js; keep the default build command (`next build`).
3. Add the environment variables for Production (and Preview if you want Claude in previews).
4. Deploy. Every push to the production branch redeploys.

### Function settings

- `/api/agents/run` and `/api/mcp` declare `maxDuration = 300`. Check that your Vercel plan allows 300-second functions; a Claude run needs about 25 s.
- `/api/health` is dynamic and uncached.
- Patient pages are pre-rendered at build time; `/mcp` renders per request.

After a deploy, check:

```bash
curl -s https://<your-host>/api/health
curl -N -s https://<your-host>/api/agents/run -H "content-type: application/json" -d '{"patientId":"P-002","useClaude":false}' | tail -1 | head -c 300
npx tsx scripts/mcp-smoke.ts https://<your-host>/api/mcp
```

## 6. Refresh snapshots and stored runs

The evidence snapshots and the stored runs are committed, so the demo and the evaluation are reproducible. Refresh them deliberately:

```bash
cd app
npm run snapshot       # 1. new CIViC and ClinicalTrials.gov snapshots
npm test               # 2. calculators still pass
npm run precompute     # 3. new stored runs with Claude (needs ANTHROPIC_API_KEY)
npm run eval           # 4. new eval-results.json
git diff --stat        # 5. review: trial IDs, evidence counts, critic flags, metrics
```

Commit the cache files, the stored runs and `eval-results.json` together, with the fetch date in the commit message: the cache files do not record their own fetch date yet. If a metric drops, do not commit; investigate first.

When the knowledge pack, regimens, interaction rules or medication catalogue change, update `KNOWLEDGE_VERSION` in [knowledge.ts](../app/src/lib/data/knowledge.ts) and follow the same steps ([DATA.md](DATA.md#44-versioning-rules)). The snapshots cover the demo patients only; entered cases always query CIViC and ClinicalTrials.gov live.

Case intake adds no environment variables and no server storage: entered cases live in each visitor's browser, and the run API validates and rebuilds them per request.

## 7. Rate limits and key rotation

### Rate limits

Defined in [ratelimit.ts](../app/src/lib/ratelimit.ts):

| Constant | Value | Applies to |
|---|---|---|
| `CLAUDE_RUNS_PER_IP` per `CLAUDE_WINDOW_MS` | 6 per 10 minutes, per client IP | `POST /api/agents/run` when `useClaude` is not `false` and a key is configured (demo patients and entered cases alike) |
| `MCP_CLAUDE_RUNS_PER_HOUR` | 10 per hour, shared by all MCP callers | `draft_recommendations` and `analyze_case` with `use_claude: true`; over the limit they run rules-only |

The counters live in memory per function instance and reset on cold start, so treat them as a cost brake, not a security control. Set a monthly spend limit and alerts for the API key in the Anthropic Console as the hard cap.

### Rotating the Anthropic API key

1. Create a new key in the Anthropic Console.
2. Replace `ANTHROPIC_API_KEY` in Vercel (`vercel env rm ANTHROPIC_API_KEY production`, then `vercel env add …`) and in your local `.env.local`.
3. Redeploy (`vercel deploy --prod`); environment changes apply only to new deployments.
4. Check `/api/health` shows `"configured": true` and run one live case.
5. Revoke the old key in the Console.

### Rotating `CLINICIAN_TOKEN` and `MCP_BEARER_TOKEN`

1. Generate a new random value, for example `openssl rand -hex 32`.
2. Update the Vercel variable and redeploy.
3. Update every MCP client configuration (for Claude Code: `claude mcp remove oncoagent`, then add it again with the new `--header`).
4. Rotate immediately if a token appears in a log, a screenshot or a chat.

These two tokens are shared secrets for the demo. Production replaces them with per-user SSO and OAuth ([ROADMAP.md](ROADMAP.md#3-engineering-backlog)).

## 8. Production hardening checklist

None of these is needed for the fictional demo; all are needed before real patient data.

Identity and access

- [ ] Hospital SSO (OIDC) with MFA; remove the "Dr. Demo" identity
- [ ] Roles and permissions: oncologist, pharmacist, molecular pathologist, tumour-board chair, read-only
- [ ] MCP behind OAuth or SSO; at minimum set `MCP_BEARER_TOKEN`; compare tokens in constant time
- [ ] `record_decision` bound to the signed-in clinician, checking that the card exists and belongs to the patient

Clinical safety

- [ ] Approving a flagged card requires a second clinician (today: acknowledgement and reason by the same clinician)
- [ ] Blocked dose cards withhold amounts everywhere (today: dose panel only; report, formula line and card reasons still show them)
- [ ] Identifier detection in all free-text case fields and in `extract_report` input
- [ ] Separate pharmacist and oncologist sign-off on dose cards
- [ ] Freshness rules for every dose-relevant lab, not only creatinine
- [ ] Licensed drug-interaction database in place of the demonstration table
- [ ] Evaluation gate in CI: `npm test` and `npm run eval` must pass before deploy

Data

- [ ] Server-side append-only audit store and run store, with backups and a tested restore
- [ ] De-identification gateway in front of the model (date shifting, free-text scrubbing)
- [ ] In-country hosting for health and genetic data (Bangladesh PDPO 2025)
- [ ] Snapshot files carry their fetch date; scheduled refresh
- [ ] Fictional records and example cases removed from production builds
- [ ] Cases stored in the hospital's own database instead of the browser

Platform

- [ ] Content Security Policy (allowing only the origins Mol* and RCSB need) and `Strict-Transport-Security`
- [ ] Self-hosted or integrity-checked Mol* assets instead of a public CDN
- [ ] Shared rate-limit store with per-clinician quotas; spend alerts on the model account
- [ ] OpenTelemetry traces and error alerting, with no patient data in logs
- [ ] Each run records model ID, prompt version, knowledge-pack version and cache-read tokens
- [ ] Dependency, licence and secret scanning in CI; dependencies upgraded on a schedule (the lockfile pins exact versions)
- [ ] Incident response procedure and a disaster-recovery test

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Top bar says "Rules-only mode" | `ANTHROPIC_API_KEY` not set for this deployment | Set it and redeploy (Vercel) or restart `npm run dev` |
| Top bar says "Snapshot mode" | CIViC or ClinicalTrials.gov unreachable from the server | Nothing to do; agents use snapshots. Check outbound network if it persists |
| "Live Claude runs are limited to 6 per 10 minutes" | Rate limit on `/api/agents/run` | Wait for the time in `retry-after`, or untick "Claude synthesis" for a rules-only run |
| MCP `draft_recommendations` or `analyze_case` returns a `note` and `mode: "rules-only"` | MCP Claude limit reached, or no key on the server | Wait, or call with `use_claude: false` |
| MCP client gets HTTP 401 | `MCP_BEARER_TOKEN` is set and the client sends no or a wrong header | Add `Authorization: Bearer <token>` to the client |
| `record_decision` always refuses | `CLINICIAN_TOKEN` not set on the server, or a different token | Set it and pass the same value as `clinician_token` |
| 3D view says "viewer unavailable" | jsDelivr or RCSB blocked by the network | Use the "PDB on RCSB" link; allow the two hosts |
| Decisions disappear after reload | Browser storage blocked or cleared (private window) | Use a normal window; production stores decisions server-side |
| "chain broken" on the audit log | Browser storage was edited by hand | Clear site data to start a new chain (demo only) |
| Run ends with an `error` line | Pipeline failure outside an agent step | Check the function log |
| "Case C-… is not in this browser" | Entered cases are stored per browser | Open the case in the browser where it was entered, or enter it again |
| A saved case no longer appears | Stored cases that fail `CaseInputSchema` are skipped when read (for example after a schema change) | Enter the case again; schema changes should stay backward compatible |
| "This browser blocked local storage, so the case cannot be saved" | Storage disabled or private window | Use a normal window |
