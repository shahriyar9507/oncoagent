# Changelog

All notable changes to OncoAgent. Dates are in Asia/Dhaka time.

## [0.3.0] · 2026-11-20 · Real cases

### Added
- **Clinician case intake** (`/cases/new`, `/cases/[id]`, `/cases/[id]/report`):
  - Form for a de-identified NSCLC case. No names, record numbers or dates of birth are collected.
  - Four example cases.
  - Live preview of BSA, CrCl and the knowledge-pack setting.
  - Edit and delete.
  - Cases are kept in the browser. The run API validates each case with Zod, rebuilds the record on the server and stores nothing.
- **Deterministic molecular-report reader** (`lib/clinical/extract.ts`):
  - Finds EGFR (exon 19, exon 20, point mutations), KRAS/NRAS, BRAF, ERBB2, MET (exon 14, amplification), ALK/ROS1/RET/NTRK/NRG1 fusions and co-mutations.
  - Also reads VAF, PD-L1 TPS, genes reported negative and the sample type.
  - Shows the matched text and warnings for each finding.
  - 81 tests.
- **Knowledge pack**:
  - Grown from 3 to 20 entries, covering EGFR, ALK, ROS1, BRAF V600E, MET exon 14, RET, NTRK, KRAS G12C, HER2, no driver by PD-L1 and histology, and second line.
  - Covers 42 drugs, 34 regimens and 54 interaction rules.
  - New 59-medicine catalogue with interaction tags.
  - New deterministic setting selector (`lib/clinical/select.ts`).
  - 65 tests.
- **Dose methods**: `weight-band` (e.g. selpercatinib) and `per-kg` (e.g. trastuzumab deruxtecan).
- **MCP**: `extract_report` and `analyze_case` tools (9 tools, server v0.2.0).

### Changed
- **Guideline agent**: names interactions on each option; contraindicated options move down the list.
- **Uncovered settings**: when no pack entry fits, the agents say so and propose no treatment, and the safety-critic flags drug names on treatment cards.
- **Other agents**:
  - Sentinel handles cases with no measurements.
  - Test-advisor adds checks driven by the medication list.
  - Pharmacology-safety writes general advice (inducers, inhibitors, acid-reducing agents, QT, NSAIDs).
  - Common co-mutations (TP53, STK11, KEAP1, …) are recorded as prognostic.
- **Approval and dosing**: approving a card the critic flagged needs an acknowledgement and a reason; a blocked dose card withholds the dose amounts.
- **Rate limit**: counts only real Claude runs.
- **Evaluation**: the script reads the unit-test count from Vitest (now 156).

### Fixed
- The safety-critic no longer treats a drug as later-line when it is also a current option.
- The documentation now states correctly that 8 of the 9 agents are deterministic code (seven specialists plus the safety-critic).

## [0.2.0] · 2026-11-20 · Clinician workspace upgrade

### Added
- Decision queue with approve, modify and reject in place, filters by patient and card kind, and flagged cards first.
- Printable A4 tumour-board report per patient (`/patients/<id>/report`): record, AI pre-read, every card with its decision, dose card, numbered sources, signature lines and the audit-chain head.
- Evidence drawer grouped by source; evidence registry panel with source filters.
- Collapsible recommendation cards (reasoning, uncertainty and alternatives one click away).
- Live runs persist in the browser, so decisions on live cards survive a reload; "Stored run" restores the precomputed run.
- Agent run progress bar, elapsed timer and per-agent notes.
- Patient record: sticky section menu, therapy lines, medication risk pills, 10-marker biomarker panel, trial cards, timeline legend.
- 3D structure scenes with MolViewSpec: drug in its pocket, driver, resistance and gatekeeper residues highlighted (numbers checked against each PDB file); spin and reset controls.
- Live status (`/api/health`): Claude configuration, CIViC and ClinicalTrials.gov reachability.
- In-browser MCP tester and copy buttons on the MCP page.
- Overview hero illustration, pending-decision count and recent activity.
- Rate limits on live Claude runs (6 per 10 minutes per visitor; 10 per hour through MCP).
- Open Graph image, brand icon, `/patients` index.

### Changed
- No visible scrollbars anywhere; compact sidebar that fits short laptop screens; tables stack on phones.
- Fictional records are frozen at their as-of date (20 Nov 2026), so dose freshness checks give the same result on any day.

### Fixed
- Hydration mismatch when the browser used a different time zone or locale (dates now use a fixed locale and Asia/Dhaka time).

## [0.1.0] · 2026-11-20 · MVP

- Nine-agent pipeline (Sentinel, Genomic-interpreter, Test-advisor, Guideline, Pharmacology-safety, Trial-matcher, Dose-optimizer, Claude synthesis, Safety-critic) with NDJSON streaming.
- Live CIViC and ClinicalTrials.gov with dated snapshot fallback.
- Deterministic dose calculators (Mosteller, Cockcroft–Gault, Calvert) and RECIST 1.1, with unit tests.
- `oncoagent-mcp` with seven tools over stdio and Streamable HTTP.
- Hash-chained audit log; evaluation script with gold cases and an adversarial set.
- Three fictional NSCLC cases; deployment on Vercel.
