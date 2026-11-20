# OncoAgent app

The Next.js 16 clinician workspace, the agent pipeline and the `oncoagent-mcp` server. Project overview, results and safety rules are in the [root README](../README.md); full documentation is in [`docs/`](../docs/README.md).

## Run

```bash
npm install          # .npmrc sets legacy-peer-deps
npm run dev          # http://localhost:3000
```

Sign-in is required, so create `.env.local` from [.env.example](.env.example) before the first run:

```bash
cp .env.example .env.local
npm run hash-password -- "<choose a password>" --secret   # prints AUTH_PASSWORD_HASH and AUTH_SECRET
```

```bash
AUTH_SECRET=...                # signs session cookies
AUTH_USERNAME=dr.example
AUTH_PASSWORD_HASH=scrypt\$...  # escape every $ as \$ in .env files
AUTH_DISPLAY_NAME=Dr. Example
ANTHROPIC_API_KEY=sk-ant-...   # optional: Claude synthesis; without it the agents run rules-only
DATABASE_URL=postgres://...    # optional: server storage per account; pglite:./.data/pg for local work
MCP_BEARER_TOKEN=...           # optional: lets external MCP clients call /api/mcp
CLINICIAN_TOKEN=...            # optional: lets record_decision sign over MCP
```

`AUTH_MODE=off` skips sign-in for local experiments. All variables: [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md#3-environment-variables).

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` · `npm run build` · `npm start` | Develop, build, serve |
| `npm run typecheck` · `npm run lint` | TypeScript and ESLint |
| `npm test` | 186 unit tests: dosing, RECIST 1.1, setting selection, report reader, sign-in, sessions, storage, API routes |
| `npm run eval` | Score stored runs against gold answers and the adversarial set; writes `src/lib/data/eval-results.json` |
| `npm run precompute` | Re-run every case with Claude and store the runs in `src/lib/data/snapshots/` |
| `npm run snapshot` | Refresh offline CIViC and ClinicalTrials.gov snapshots in `src/lib/tools/cache/` |
| `npm run mcp:stdio` | Serve the MCP tools over stdio |
| `npm run mcp:smoke` | List and call the MCP tools (stdio, or HTTP with a URL argument and `MCP_BEARER_TOKEN`) |
| `npm run hash-password -- "<pw>" [--secret]` | scrypt hash for `AUTH_PASSWORD_HASH`; `--secret` also prints an `AUTH_SECRET` |
| `npm run db:migrate` | Create or upgrade the storage tables in `DATABASE_URL` and print row counts |
| `OA_USER=… OA_PASS=… npm run smoke -- <url>` | Ten checks against a running deployment: health, gating, sign-in, a rules-only run, sign-out |

## Layout

| Path | What lives there |
|---|---|
| `src/app/` | Routes: `/login`, `/`, `/patients`, `/patients/[id]`, `/patients/[id]/report`, `/cases/new`, `/cases/[id]`, `/cases/[id]/report`, `/queue`, `/mcp`, `/evaluation`, `/architecture`; API: `/api/auth/{login,logout,session}`, `/api/agents/run` (NDJSON stream; demo patient or validated case), `/api/cases`, `/api/runs`, `/api/audit`, `/api/store`, `/api/health`, `/api/mcp`; `not-found`, `error`, `loading` screens |
| `src/proxy.ts` | Sign-in gate for every page and API, and the cross-site request guard |
| `src/lib/server/` | `users.ts` (accounts from env), `password.ts` (scrypt), `auth.ts` (session checks), `db.ts` (PostgreSQL or PGlite), `store.ts` (schema, cases, runs, append-only audit), `api.ts`, `log.ts`, tests |
| `src/components/` | `Shell` (with the account menu), `LoginForm`, `PatientRecord`, `CaseForm`, `CaseView`, `CaseList`, `AgentWorkspace` (run, cards, drawer, dose, audit), `DecisionDialog`, `QueueView`, `ReportView`, `Charts`, `MoleculeViewer`, `McpPlayground`, `PatientList`, `AgentOrbit` |
| `src/lib/agents/` | `pipeline.ts` (orchestrator), `rules.ts` (seven rule agents and the evidence registry), `claude.ts` (synthesis), `critic.ts` (safety-critic) |
| `src/lib/clinical/` | `dose.ts` (Calvert, BSA, fixed, weight-band, per-kg), `recist.ts`, `select.ts` (knowledge-pack setting), `extract.ts` (report reader), tests |
| `src/lib/tools/` | `civic.ts`, `trials.ts`, `cache/` snapshots |
| `src/lib/mcp/tools.ts` | The nine MCP tools, shared by stdio and HTTP |
| `src/lib/data/` | Fictional patients, knowledge pack (20 entries), regimens (34), medication catalogue, PDB structures, stored runs, evaluation results |
| `src/lib/` | `types.ts`, `caseInput.ts` (case schema and record builder), `session.ts` (signed session token), `remote.ts` (storage mode and API cache), `cases.ts`, `runs.ts` and `audit.ts` (server or browser storage, hash chain), `hooks.ts`, `version.ts`, `ratelimit.ts`, `format.ts` |
| `mcp/stdio.ts` | stdio entry point |
| `scripts/` | `eval.ts`, `precompute.ts`, `snapshot.ts`, `mcp-smoke.ts`, `smoke.ts`, `db-migrate.ts`, `hash-password.ts` |

## Conventions

- Clinical logic changes need a unit test and must keep `npm run eval` at 6/6 adversarial catches. See [CONTRIBUTING.md](../CONTRIBUTING.md).
- Dates shown to users go through `src/lib/format.ts` (fixed locale and Asia/Dhaka time) so server and browser render the same text.
- Design tokens and responsive rules live in `src/app/globals.css`; see [docs/DESIGN.md](../docs/DESIGN.md).
