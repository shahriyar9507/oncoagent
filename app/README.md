# OncoAgent app

The Next.js 16 clinician workspace, the agent pipeline and the `oncoagent-mcp` server. Project overview, results and safety rules are in the [root README](../README.md); full documentation is in [`docs/`](../docs/README.md).

## Run

```bash
npm install          # .npmrc sets legacy-peer-deps
npm run dev          # http://localhost:3000
```

Optional `.env.local`:

```bash
ANTHROPIC_API_KEY=sk-ant-...   # enables Claude synthesis; without it the agents run rules-only
CLINICIAN_TOKEN=...            # lets record_decision sign over MCP
MCP_BEARER_TOKEN=...           # requires a bearer token on /api/mcp
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` · `npm run build` · `npm start` | Develop, build, serve |
| `npm run typecheck` · `npm run lint` | TypeScript and ESLint |
| `npm test` | 167 unit tests: dosing, RECIST 1.1, setting selection, report reader |
| `npm run eval` | Score stored runs against gold answers and the adversarial set; writes `src/lib/data/eval-results.json` |
| `npm run precompute` | Re-run every case with Claude and store the runs in `src/lib/data/snapshots/` |
| `npm run snapshot` | Refresh offline CIViC and ClinicalTrials.gov snapshots in `src/lib/tools/cache/` |
| `npm run mcp:stdio` | Serve the MCP tools over stdio |
| `npm run mcp:smoke` | List and call the MCP tools (stdio, or HTTP with a URL argument) |

## Layout

| Path | What lives there |
|---|---|
| `src/app/` | Routes: `/`, `/patients`, `/patients/[id]`, `/patients/[id]/report`, `/cases/new`, `/cases/[id]`, `/cases/[id]/report`, `/queue`, `/mcp`, `/evaluation`, `/architecture`; API: `/api/agents/run` (NDJSON stream; demo patient or validated case), `/api/health`, `/api/mcp` |
| `src/components/` | `Shell`, `PatientRecord`, `CaseForm`, `CaseView`, `CaseList`, `AgentWorkspace` (run, cards, drawer, dose, audit), `DecisionDialog`, `QueueView`, `ReportView`, `Charts`, `MoleculeViewer`, `McpPlayground`, `PatientList`, `AgentOrbit` |
| `src/lib/agents/` | `pipeline.ts` (orchestrator), `rules.ts` (seven rule agents and the evidence registry), `claude.ts` (synthesis), `critic.ts` (safety-critic) |
| `src/lib/clinical/` | `dose.ts` (Calvert, BSA, fixed, weight-band, per-kg), `recist.ts`, `select.ts` (knowledge-pack setting), `extract.ts` (report reader), tests |
| `src/lib/tools/` | `civic.ts`, `trials.ts`, `cache/` snapshots |
| `src/lib/mcp/tools.ts` | The nine MCP tools, shared by stdio and HTTP |
| `src/lib/data/` | Fictional patients, knowledge pack (20 entries), regimens (34), medication catalogue, PDB structures, stored runs, evaluation results |
| `src/lib/` | `types.ts`, `caseInput.ts` (case schema and record builder), `cases.ts` (browser-kept cases), `audit.ts` (hash chain), `runs.ts` and `hooks.ts` (browser-kept runs), `ratelimit.ts`, `format.ts` |
| `mcp/stdio.ts` | stdio entry point |
| `scripts/` | `eval.ts`, `precompute.ts`, `snapshot.ts`, `mcp-smoke.ts` |

## Conventions

- Clinical logic changes need a unit test and must keep `npm run eval` at 6/6 adversarial catches. See [CONTRIBUTING.md](../CONTRIBUTING.md).
- Dates shown to users go through `src/lib/format.ts` (fixed locale and Asia/Dhaka time) so server and browser render the same text.
- Design tokens and responsive rules live in `src/app/globals.css`; see [docs/DESIGN.md](../docs/DESIGN.md).
