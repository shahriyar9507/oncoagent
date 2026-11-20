# Changelog

All notable changes to OncoAgent. Dates are in Asia/Dhaka time.

## [0.4.0] · 2026-11-20 · Sign-in and server storage

### Added
- **Clinician sign-in** (`/login`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/session`):
  - Signed session in an httpOnly, SameSite=Lax cookie (HS256, 12 hours; `Secure` in production).
  - Passwords are stored only as scrypt hashes in the environment (`AUTH_USERNAME` + `AUTH_PASSWORD_HASH`, or `AUTH_USERS` for several accounts). No credential is in the repository.
  - Repeated wrong passwords are refused for 15 minutes (10 per IP, 20 per username). Unknown usernames take the same time to check as known ones.
  - `AUTH_SESSION_VERSION` signs every clinician out when it changes.
  - Every page and API route is gated by `src/proxy.ts`. Route handlers check the session again before reading or writing data.
  - Account menu in the top bar with the signed-in name, role, storage mode and sign-out.
- **Server storage** (`/api/cases`, `/api/cases/[id]`, `/api/runs`, `/api/runs/[id]`, `/api/audit`, `/api/store`):
  - When `DATABASE_URL` points at PostgreSQL 13+, cases, agent runs and the audit log are kept on the server, separately for each account.
  - The audit table is append-only: a database trigger refuses updates and deletes. Each account's entries form a SHA-256 chain, appended under an advisory lock.
  - The schema is created on first use or with `npm run db:migrate`. The migration is idempotent and safe to run from several instances at once.
  - Without `DATABASE_URL` the app keeps data in the clinician's browser, as before, and says so in the account menu.
- **Scripts**: `npm run hash-password` (scrypt hash and a fresh `AUTH_SECRET`), `npm run db:migrate`, `npm run smoke` (ten checks against any deployment: health, gating, wrong password, sign-in, session, a rules-only run, sign-out).
- **Screens**: 404, error (with retry and a reference code) and loading screens.
- **`.env.example`** documenting every variable.
- **CI**: a smoke-test step builds the app, signs in with a CI-only account and runs `npm run smoke`.

### Changed
- **Signer of decisions**: the audit entry's actor is taken from the session on the server, never from the request body.
- **MCP endpoint**: `/api/mcp` accepts `Authorization: Bearer <MCP_BEARER_TOKEN>` (compared in constant time) or a signed-in session. It is open only with `MCP_PUBLIC=true`, or when no token is set and sign-in is off. `record_decision` compares `CLINICIAN_TOKEN` in constant time.
- **Health endpoint**: now reports `status`, `version`, sign-in readiness and storage. It answers HTTP 503 when sign-in or storage is misconfigured.
- **Security headers**: Content Security Policy (only the Mol* build on jsDelivr and RCSB are allowed as outside origins), `Strict-Transport-Security`, `Cross-Origin-Opener-Policy` and `Permissions-Policy`. API answers are `Cache-Control: no-store`.
- **Cross-site guard**: state-changing API calls with a foreign `Origin` are refused with 403.
- **Wording**: queue, activity and case screens say whether data is kept per account or in this browser.
- **Model**: `ANTHROPIC_MODEL` can override the default `claude-opus-5-5`.
- **Tests**: 186 unit tests (19 new for passwords, sessions, the store, the append-only trigger and the API routes).

### Fixed
- `/cases` now redirects to `/patients` instead of showing a 404.
- Unknown pages no longer cause a hydration error (React #418) in the breadcrumb.

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
- **Evaluation**: the script reads the unit-test count from Vitest (now 167, including case-input and critic tests).

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
