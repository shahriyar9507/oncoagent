# OncoAgent · Team DatourX

**An AI assistant team for oncologists. It reads every report, proposes the next test or treatment with its evidence, and the doctor makes every decision.**

Entry for *Idea to Unicorn · International AI Builders Congress 2026* (CloudCamp Bangladesh) · HealthSphere AI · challenge **PredictRx**.

> All patients in this repository are fictional. OncoAgent is a research prototype, not a medical device and not medical advice.

| | |
|---|---|
| Live demo | https://oncoagent.vercel.app *(see the deployment note below)* |
| MCP endpoint | `https://<deployment>/api/mcp` (Streamable HTTP) · `npx tsx mcp/stdio.ts` (stdio) |
| Submission book | `docs/submission/book.html` |
| Pitch deck | `docs/submission/deck.html` |
| Research with sources | `docs/RESEARCH.md` |
| Architecture | `docs/ARCHITECTURE.md` |

## The problem

About 20 million people were diagnosed with cancer in 2022 and 9.7 million died; lung cancer leads both (GLOBOCAN 2022). In Bangladesh about 167,000 new patients a year share 22 medical oncologists and one or two dedicated molecular labs. Precision drugs exist, but finding and reading the evidence for each patient (biomarkers, guidelines, interactions, trials, doses) falls on very few specialists, so biomarkers, trials and risks are missed.

## What it does

A specialist agent team works on each new event in a patient's record:

| Agent | Job | Signs off |
|---|---|---|
| Sentinel | RECIST 1.1 response and ctDNA trend; red flags | Treating oncologist |
| Genomic-interpreter | Driver and resistance calls with live CIViC evidence | Molecular pathologist |
| Test-advisor | Missing biomarkers and tests to order | Treating oncologist |
| Guideline | Ranked options from a curated, versioned knowledge pack | Tumour board |
| Pharmacology-safety | Interactions with current medications (label rules) | Pharmacist |
| Trial-matcher | Recruiting trials from ClinicalTrials.gov API v2 | Investigator |
| Dose-optimizer | BSA (Mosteller), CrCl (Cockcroft–Gault), Calvert with GFR cap | Pharmacist + oncologist |
| Synthesis (Claude Opus 5.5) | Tumour-board pre-read and up to three cards, citing only given evidence IDs | Treating oncologist |
| Safety-critic | Rejects invented trials, doses outside the calculator, unsafe or wrong-line drugs, unknown evidence | — |

Every output is a **recommendation card**: proposal, patient facts used, evidence IDs, confidence, what is uncertain, alternatives, what would change the advice, safety checks. The clinician approves, modifies or rejects (a reason is required), and each decision is written to a **hash-chained audit log**.

Therapy works at three levels: **select** an approved drug or trial (built), **personalise** regimen and dose (built), and in a separate research zone, **research a modified or new molecule** with licensed partners (vision, never given to a patient outside a regulated trial).

## Evaluation (from `npm run eval`)

| Measure | Result |
|---|---|
| Driver alteration identified | 3/3 cases |
| Leading option matches the gold answer | 3/3 (Claude) · 3/3 (rules) |
| Citations that resolve to evidence | 100% |
| Trial IDs returned by the registry | 100% |
| Doses exactly as hand-calculated | 3/3 · 10 unit tests |
| Doses written outside the calculator | 0 |
| Adversarial unsafe drafts caught by the critic | 6/6 |
| Full run with Claude | ≈ 23 s · ≈ $0.065 per case |

Three fictional gold cases are far too few to claim clinical accuracy; a pilot needs hundreds of de-identified cases with tumour-board answers under ethics approval.

## Run it

```bash
cd app
npm install
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local   # optional: without it the agents run rules-only
npm run dev            # http://localhost:3000
npm test               # dose and RECIST unit tests
npm run eval           # gold-case + adversarial evaluation
npm run precompute     # re-run all cases with Claude and store snapshots
npm run snapshot       # refresh offline CIViC / trial snapshots
npm run mcp:stdio      # oncoagent-mcp over stdio
npm run mcp:smoke      # list and call the MCP tools over stdio
```

Connect Claude Code to the deployed MCP server:

```bash
claude mcp add --transport http oncoagent https://<deployment>/api/mcp
```

Environment variables: `ANTHROPIC_API_KEY` (Claude synthesis), `CLINICIAN_TOKEN` (enables `record_decision` over MCP), `MCP_BEARER_TOKEN` (optional bearer auth on `/api/mcp`).

## MCP tools (`oncoagent-mcp`)

`list_patients` · `get_case_timeline` · `interpret_variant` (CIViC) · `search_trials` (ClinicalTrials.gov) · `calculate_dose` · `draft_recommendations` · `record_decision` (refuses without a clinician token). One definition serves stdio (`@modelcontextprotocol/server` v2 `serveStdio`) and Streamable HTTP (`mcp-handler` on a Next.js route).

## Stack

Next.js 16 (App Router, TypeScript), plain CSS design system, hand-built SVG charts, Mol* for 3D protein structures (RCSB PDB 1M17, 6OIM, 2XP2), Anthropic TypeScript SDK with structured outputs (`claude-opus-5-5`, server-side refusal fallback), MCP SDK v2, Vitest, Vercel.

## Data and AI provenance

- Patients: fictional cases written by the team.
- Variant evidence: CIViC (CC0), fetched live, snapshot fallback.
- Trials: ClinicalTrials.gov API v2, fetched live, snapshot fallback.
- Therapy knowledge: a small curated pack of public approvals and pivotal trials (`app/src/lib/data/knowledge.ts`, version 2026-11-20); must be checked against current labels and NCCN/ESMO guidelines.
- Dose parameters: product labels (DailyMed links in the app).
- Structures: RCSB PDB.
- Model: Claude Opus 5.5 receives a pseudonymous ID and an age band only.

## Safety rules

1. AI proposes, a clinician decides; no agent can sign, prescribe or contact a patient.
2. No drug, dose, trial number or citation from model memory.
3. Doses come only from unit-tested calculators; stale creatinine or low clearance blocks the dose card.
4. Documents and tool outputs are data, never instructions.
5. Research outputs never enter a patient's chart.

## How this was built

With Claude Code and a project team of 25 specialist sub-agents and 13 project skills (`.claude/agents`, `.claude/skills`) covering oncology, pathology, pharmacology, bioinformatics, AI engineering, design, regulation and clinical safety.

## Team DatourX

Team members are listed in the submission portal.
