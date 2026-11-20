# OncoAgent documentation

OncoAgent (team DatourX) is an agentic AI decision-support workspace for oncologists. Nine agents read a patient's record, propose the next test or treatment with its evidence, check interactions, trials and doses, and a safety-critic checks every proposal. A clinician approves, modifies or rejects each one. Clinicians can run the agents on three fictional demo patients or enter their own de-identified case, with the molecular report read by a deterministic reader. The first cancer is non-small-cell lung cancer (NSCLC).

> The demo patients are fictional; entered cases must be de-identified or fictional. OncoAgent is a research prototype for clinicians, not a medical device and not medical advice. There is no patient app.

Live demo: <https://oncoagent.vercel.app> · Project overview: [README](../README.md)

## Documents

| Document | What it covers |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System context, the run sequence, case intake flow, module map, evidence registry and ID prefixes, where state lives, deployment topology, key decisions; then the target production architecture |
| [AGENTS.md](AGENTS.md) | Each of the nine agents (inputs, outputs, evidence, autonomy, sign-off, failure modes), the recommendation-card schema, the Claude prompt contract and the exact safety-critic checks |
| [MCP.md](MCP.md) | The `oncoagent-mcp` server (v0.2.0): transports, the nine tools with input schemas and example calls (including `extract_report` and `analyze_case`), client setup, rate limit and the clinician-token rule |
| [API.md](API.md) | HTTP routes: the NDJSON agent-run stream for demo patients and entered cases, the health check, the MCP endpoint, error codes and curl examples |
| [EVALUATION.md](EVALUATION.md) | Gold answers, metric definitions, the adversarial set, how to run it, current results, the unscripted P-003 catch, limits and the pilot evaluation plan |
| [SAFETY.md](SAFETY.md) | Intended use and non-use, human-in-the-loop rules, the hazard log, privacy, the research-track boundary and the regulatory position, marked implemented or planned |
| [DATA.md](DATA.md) | Data model, the three fictional cases, clinician-entered cases (schema, report reader, setting selector), the knowledge pack and medication catalogue, live sources and snapshots, provenance and licences, de-identification and retention |
| [DESIGN.md](DESIGN.md) | Design principles, colour tokens with contrast ratios, typography, spacing, components (including the case form), accessibility and responsive rules, screenshots |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Local setup, environment variables, scripts, Vercel deployment, refreshing data, rate limits, key rotation, production hardening checklist, troubleshooting |
| [ROADMAP.md](ROADMAP.md) | Phases over 30 months with exit criteria, current status, and the engineering backlog derived from the code |
| [RESEARCH.md](RESEARCH.md) | Sourced research behind the design: feasibility, regulation, Bangladesh context, data standards, cancer choice, therapy levels |

Reference material outside this folder: the competition fact sheet with every public number and its source ([submission/fact-sheet.md](submission/fact-sheet.md)), and a Bangla brief ([brief/index.html](brief/index.html)).

Repository policies: [CONTRIBUTING.md](../CONTRIBUTING.md) (clinical rules for changes), [SECURITY.md](../SECURITY.md) (private vulnerability reports, data policy), [CHANGELOG.md](../CHANGELOG.md), [LICENSE](../LICENSE) (MIT).

## Reading order

### Judges (about 20 minutes)

1. [Project README](../README.md): the problem, what OncoAgent does, the results.
2. [ARCHITECTURE.md, section 2](ARCHITECTURE.md#2-as-built-mvp): what is built and how a run flows.
3. [EVALUATION.md](EVALUATION.md): what was measured, the six adversarial drafts, the P-003 catch and the limits.
4. [SAFETY.md](SAFETY.md): intended use, the hazard log and the regulatory position.
5. [AGENTS.md](AGENTS.md): how the model is constrained and what the critic checks.
6. [ROADMAP.md](ROADMAP.md): what comes next and what is still missing.

### Engineers

1. [DEPLOYMENT.md](DEPLOYMENT.md): run it locally, with or without an API key.
2. [ARCHITECTURE.md](ARCHITECTURE.md): module map, data flow, state and decisions.
3. [AGENTS.md](AGENTS.md): the pipeline contract, card schema and critic.
4. [API.md](API.md) and [MCP.md](MCP.md): the interfaces.
5. [DATA.md](DATA.md): types, the case schema, the report reader and setting selector, the knowledge pack and its versioning rules.
6. [EVALUATION.md](EVALUATION.md): run `npm test` and `npm run eval` before and after every change.
7. [ROADMAP.md, backlog](ROADMAP.md#3-engineering-backlog): where to contribute.

### Clinicians

1. [SAFETY.md, intended use and human in the loop](SAFETY.md#1-intended-use): what the tool is for and what it must not be used for.
2. [AGENTS.md](AGENTS.md): what each agent does, its evidence and who signs off.
3. [DATA.md, the three cases](DATA.md#2-the-three-fictional-cases): the fictional patients and the decision each one tests. Then [clinician-entered cases](DATA.md#3-clinician-entered-cases): what the intake form asks for, what the report reader finds, and what it ignores.
4. [EVALUATION.md, limitations and pilot plan](EVALUATION.md#7-limitations): why three cases prove little, and how a silent-mode pilot would test it.
5. [DESIGN.md, screens](DESIGN.md#8-screens): what the workspace looks like.

## Conventions

- **As built** means the code in [`app/`](../app) does it today, with a link to the file. **Planned** means it does not, yet.
- Numbers come from [eval-results.json](../app/src/lib/data/eval-results.json) or the fact sheet, dated 20 November 2026.
- Relative links point into the repository so every claim can be checked against the code.
- Clinical terms use standard forms: HGVS for variants, international non-proprietary names for drugs, RECIST 1.1 for response.
