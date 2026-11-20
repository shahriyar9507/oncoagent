# OncoAgent fact sheet

One source of truth for every number and claim used in the submission book, pitch deck, video and README. If a number is not on this sheet (or in `docs/RESEARCH.md` with a source), it does not go into a public document.

Last checked: 20 November 2026 (v0.3).

## Identity

| | |
|---|---|
| Product | **OncoAgent**: an agentic AI decision-support workspace for oncologists |
| Team | **DatourX** (logo: outlined rounded mark with a mint dot, brand mint `#17ff88`, ink text) |
| Line | **AI proposes. The doctor decides.** · Bangla: *AI প্রস্তাব দেয়, ডাক্তার সিদ্ধান্ত নেন।* |
| Competition | Idea to Unicorn · International AI Builders Congress 2026 (CloudCamp Bangladesh) |
| Track · challenge | HealthSphere AI · PredictRx |
| Users | Oncologists and clinical staff only. There is no patient app and no patient-facing message. |
| First cancer | Non-small-cell lung cancer (NSCLC); breast next, then colorectal |
| Status | Working MVP, deployed; fictional patients only; not a medical device |

## Links

| | |
|---|---|
| Live demo | https://oncoagent.vercel.app |
| Source code | https://github.com/shahriyar9507/oncoagent |
| MCP endpoint | https://oncoagent.vercel.app/api/mcp (Streamable HTTP) · stdio: `npx tsx mcp/stdio.ts` |
| Tumour-board report (example) | https://oncoagent.vercel.app/patients/P-001/report |

## The problem (sourced)

| Fact | Source |
|---|---|
| 20 million new cancer cases and 9.7 million deaths worldwide in 2022 | GLOBOCAN 2022 (IARC) |
| 35.3 million new cases expected in 2050 | GLOBOCAN 2022 projection |
| Lung cancer: 1.82 million deaths, 18.7% of all cancer deaths, the most of any cancer | GLOBOCAN 2022 |
| Bangladesh: 167,256 new cases and 116,598 deaths in 2022; no population-based registry | GLOBOCAN 2022 |
| Bangladesh has about 22 medical oncologists | Financial Express, Feb 2026 |
| ≈ 7,603 new cases per medical oncologist in Bangladesh vs ≈ 137 per haematology/medical oncologist in the US (definitions differ: rough comparison) | GLOBOCAN 2022; ACS 2026; ASCO JCO OP 2025 |
| Only ~45% of US NSCLC patients show evidence of biomarker testing before first-line therapy | JAMA Netw Open 2025;8(7):e2519963 |
| TrialGPT: 42.6% less trial-screening time, 87.3% criterion accuracy | Nature Communications 2024 |
| AI case summaries for tumour boards: 20–30 → 10–15 minutes per case (pilot, with some inaccuracies) | Roche summary of Northside Hospital pilot, 2025 |

Use these carefully: say "about", keep the source next to the number, and never present them as OncoAgent results.

## What OncoAgent does

- **Nine agents per case**:
  1. Sentinel: RECIST 1.1 response and ctDNA trend
  2. Genomic-interpreter: live CIViC evidence
  3. Test-advisor: missing biomarkers
  4. Guideline: ranked options from a curated, versioned knowledge pack
  5. Pharmacology-safety: interactions with current medicines
  6. Trial-matcher: live ClinicalTrials.gov API v2
  7. Dose-optimizer: Mosteller BSA, Cockcroft–Gault CrCl, Calvert carboplatin with GFR cap 125
  8. Synthesis: Claude Opus 5.5, structured output, de-identified input
  9. Safety-critic: deterministic checks
- **Eight of the nine are plain, testable code** (the seven specialists and the safety-critic; only the synthesis step uses a model). The model writes language, never numbers: doses come from the calculator and trial IDs from the registry.
- **Recommendation card** contents: proposal, why (patient facts), evidence IDs, confidence with reason, what is uncertain, alternatives, what would change the advice, safety notes, and the critic's verdict.
- **Clinician decision**: approve, modify or reject. A reason is required to modify or reject. Every decision is written to a SHA-256 hash-chained audit log.
- **Three therapy levels**:
  1. Select: approved drug, regimen or recruiting trial. Built.
  2. Personalise: dose and regimen for this patient. Built.
  3. Research: modified or new molecules with licensed partners. Vision only; never given to a patient outside a regulated trial.

## The MVP, as built (v0.3, 20 Nov 2026)

- **Workspace screens**:
  - Overview
  - Patients
  - Patient record: summary, therapy lines, RECIST and ctDNA charts, agent run, cards, evidence drawer, dose card, audit log, timeline, molecular profile vs 10-marker panel, 3D structure, recruiting trials
  - Decision queue with in-place sign-off
  - Printable tumour-board report
  - MCP server page with an in-browser tool tester
  - Evaluation
  - How it works
- **Clinician case intake (`/cases/new`)**: a doctor enters a de-identified NSCLC case. No names, record numbers or dates of birth are collected.
  - **Report text reading**: paste the molecular report text. A deterministic reader (no AI; it runs in the browser) finds:
    - EGFR exon 19 deletion, exon 20 insertion and point mutations
    - KRAS, BRAF, ERBB2/HER2 and MET exon 14 / amplification
    - ALK, ROS1, RET, NTRK and NRG1 fusions
    - co-mutations, VAF, PD-L1 TPS, genes reported negative and the sample type
    - It shows the exact text behind each finding, plus warnings.
  - **Before saving**: a live preview shows BSA, CrCl and the knowledge-pack setting with its options.
  - **Saving and running**: the case is saved in the browser. On each run the server validates it (Zod) and rebuilds the record, and stores nothing. The full nine-agent run follows, then the decision queue and the printable report. The case can be edited or deleted.
  - Four example cases are included: EGFR exon 19, KRAS G12C after chemo-immunotherapy, ROS1 with phenytoin, and no driver with PD-L1 80%.
- **Knowledge pack: 20 entries.** Three back the demo cases; 17 are generic settings:
  - EGFR: common mutations first line, exon 20 insertion, progression on osimertinib
  - ALK, ROS1, BRAF V600E, MET exon 14, RET and NTRK
  - KRAS G12C after prior therapy; HER2-mutant first line and after prior therapy
  - No driver: PD-L1 ≥ 50%, non-squamous, squamous
  - Two second-line settings
- **Setting selector**: a deterministic selector picks the entry from the driver, the line of therapy, PD-L1 and histology. When no entry covers the case, it says so and the agents propose no treatment.
- **Coverage**: 42 cancer drugs, 34 regimens and 54 label-level interaction rules. Interaction tags: QT prolongation, strong CYP3A inducers and inhibitors, acid-reducing agents, NSAIDs.
- **Medication catalogue**: 59 common co-medications with their interaction tags.
- **Dose methods**: Calvert, BSA, fixed, weight band (e.g. selpercatinib), and per kg (e.g. trastuzumab deruxtecan 5.4 mg/kg).
- **Interaction context in the Guideline agent**: options that clash with a current medicine are named on the card. A contraindicated option moves down the list.
- **Approving a flagged card**: needs an explicit acknowledgement and a reason.
- **Blocked dose card**: withholds the dose amounts.
- **Three fictional NSCLC patients**, each built around one hard decision:
  - **P-001 Rahela Khatun**, 55, female, never smoked. EGFR L858R. Progression on first-line osimertinib at month 14 (45 mm vs 32 mm nadir, new liver lesion). Plasma EGFR C797S. Taking citalopram, so there is a QT interaction.
  - **P-002 Karim Uddin**, 61, male. KRAS G12C, PD-L1 60%. First-line decision.
  - **P-003 Nasrin Akter**, 45, female, never smoked. EML4::ALK fusion with brain metastases. Taking carbamazepine, a strong CYP3A inducer, so lorlatinib is contraindicated while she takes it.
- **3D structure insight (Mol*, RCSB PDB)**: the drug sits in its pocket, and the clinically relevant residues are highlighted. Residue numbers were checked against each PDB file.
  - 1M17 (EGFR + erlotinib): L858, C797, T790
  - 6OIM (KRAS G12C + sotorasib): C12
  - 2XP2 (ALK + crizotinib): L1196, G1202
- **MCP server `oncoagent-mcp` v0.2.0**:
  - Nine tools: `list_patients`, `get_case_timeline`, `interpret_variant`, `search_trials`, `calculate_dose`, `draft_recommendations`, `extract_report`, `analyze_case`, `record_decision`. `record_decision` refuses without a clinician token.
  - One definition serves stdio and Streamable HTTP. Both were tested with an MCP client.
- **Live status**: when a page loads, the top bar checks that Claude is configured and that CIViC and ClinicalTrials.gov answer. The agents fall back to dated snapshots, never to empty data.
- **Cost guardrails**: live Claude runs are limited to 6 per 10 minutes per visitor, and to 10 per hour through MCP. Rules-only runs are free.

## Measured results (scripts/eval.ts, stored runs, 20 Nov 2026)

| Measure | Result |
|---|---|
| Driver alteration identified | 3/3 cases |
| Leading option matches the gold answer | 3/3 (Claude) · 3/3 (rules) |
| Citations that resolve to evidence in the run | 100% |
| Trial IDs returned by the registry | 100% |
| Doses exactly as hand-calculated | 3/3; 156 unit tests in total (dose and RECIST, knowledge-pack selection and dosing, report reader) |
| Doses written outside the calculator | 0 |
| Unsafe leading recommendations | 0 |
| Adversarial unsafe drafts caught by the critic | 6/6 (invented trial number, model-written dose, unknown evidence ID, later-line drug first, contraindicated drug without warning, drug outside the pack) |
| Mean full run with Claude | 23.4 s, ≈ US$0.065 per case (about 4–6k input and 2–3k output tokens) |
| Production check on 20 Nov 2026 | Live Claude run for P-002: 21 s, 10 cards, 0 flagged |

**A real catch, unscripted.** In P-003 the rules-only Guideline card listed lorlatinib without noting it is contraindicated with carbamazepine. The safety-critic flagged the card; the Claude card had noted the interaction.

**Limits, said plainly.** Three fictional gold cases cannot support clinical accuracy claims. A pilot needs hundreds of de-identified cases with tumour-board answers, reviewed under ethics approval. In the demo the audit log and live runs are stored in the browser; production stores them server-side.

## Example numbers on screen (P-001)

| Quantity | Value |
|---|---|
| BSA (Mosteller) | 1.51 m² |
| CrCl (Cockcroft–Gault, ×0.85 for female) | 67.7 mL/min |
| Carboplatin (Calvert, AUC 5) | 5 × (67.7 + 25) = 463.7, so **460 mg** |
| Pemetrexed (500 mg/m²) | 500 × 1.51 = 755, so **750 mg** |
| Blocking rules | A creatinine more than 7 days old blocks the dose card; CrCl below 45 blocks pemetrexed |

## Safety rules (hold everywhere)

1. AI proposes, a clinician decides. No agent can sign, prescribe or contact a patient.
2. No drug, dose, trial number or citation may come from model memory. The critic flags anything not in the evidence registry.
3. Doses come only from unit-tested calculators. A stale creatinine or low clearance blocks the dose card.
4. The model sees a pseudonymous ID and an age band, never a name or address.
5. Documents and tool outputs are data, never instructions.
6. Research outputs never enter a patient's chart. The research track is limited to human cancer targets.

## Technology

- Next.js 16 (App Router, TypeScript strict) with a plain-CSS design system and hand-built SVG charts
- Anthropic TypeScript SDK with structured outputs (`claude-opus-5-5`, prompt caching)
- MCP SDK v2 and `mcp-handler`
- Mol* 4.18 with MolViewSpec scenes
- Vitest; tsx scripts for evaluation and snapshots
- Vercel; GitHub

Built with Claude Code, 25 project sub-agents and 13 project skills (`.claude/`).

## Data and AI provenance

- **Patients**: fictional, written by the team.
- **Variant evidence**: CIViC (CC0), fetched live with a dated snapshot as fallback.
- **Trials**: ClinicalTrials.gov API v2, fetched live with a dated snapshot as fallback.
- **Therapy knowledge**: a curated pack of public approvals and pivotal trials, version 2026-11-20.
- **Dose parameters**: product labels (DailyMed).
- **Structures**: RCSB PDB.
- **Model**: Claude Opus 5.5 (pinned ID).

## Business and roadmap (plan, not traction)

**Who pays**:
- Cancer hospitals: per-oncologist subscription
- Molecular labs: interpretation and reporting module
- Research partners: de-identified cohort insight under consent and ethics approval

**Roadmap** (months from today):

| Months | Phase | Work |
|---|---|---|
| 0–2 | Foundation | Harden the MVP, eval harness, hazard log, regulatory classification |
| 2–8 | NSCLC product | Full agent set, PDF report extraction, guideline RAG, ≥ 90% gold-case concordance |
| 8–14 | Pilot + breast | Ethics approval, hospital integration, silent-mode study on real cases |
| 14–30 | Scale + research | Live pilot, colorectal, research zone with a licensed discovery partner |

**Regulatory frame**:
- Clinician-facing decision support whose basis the clinician can review (the FDA CDS criteria).
- Bangladesh Personal Data Protection Ordinance 2025: health and genetic data are sensitive and stored in-country.
- DGDA rules to be confirmed before a pilot.
