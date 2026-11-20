# Contributing to OncoAgent

Thank you for helping. OncoAgent is clinical decision support, so a few rules come before code style.

## Clinical rules (non-negotiable)

1. **AI proposes, a clinician decides.** No change may let an agent sign, prescribe, order or contact a patient.
2. **Every claim is sourced.** A card may only cite evidence IDs that exist in the run's evidence registry (`pt:`, `kb:`, `civic:`, `trial:`, `label:`, `calc:`). No drug, dose, trial number or citation from model memory.
3. **Doses come from code.** Dose logic lives in [`app/src/lib/clinical/dose.ts`](app/src/lib/clinical/dose.ts) and needs a unit test with a hand calculation for every change.
4. **Fictional data only.** Never add real patient data, even de-identified.
5. **Research stays in research.** The level-3 research track never writes to a patient record. Keep molecular design content high level.

If a change touches clinical logic (agents, knowledge pack, interaction rules, dose or RECIST code, the critic), use the **clinical change** checklist in the pull request template and say which clinician reviewed it.

## Getting started

```bash
git clone https://github.com/shahriyar9507/oncoagent.git
cd oncoagent/app
npm install            # .npmrc sets legacy-peer-deps
npm run dev            # http://localhost:3000
```

Optional: put `ANTHROPIC_API_KEY=...` in `app/.env.local` to enable Claude synthesis. Without it the agents run rules-only. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for every variable.

## Before you open a pull request

```bash
npx tsc --noEmit       # types
npm run lint           # ESLint
npm test               # dose and RECIST unit tests
npm run build          # production build
npm run eval           # gold-case and adversarial evaluation (uses stored runs)
```

CI runs the first four on every push and pull request ([.github/workflows/ci.yml](.github/workflows/ci.yml)).

## Code conventions

- TypeScript strict, App Router, server components by default; `"use client"` only where state or browser APIs are needed.
- Shared types live in [`app/src/lib/types.ts`](app/src/lib/types.ts). New evidence kinds need a registry prefix and a critic rule.
- Styling uses the design tokens in [`app/src/app/globals.css`](app/src/app/globals.css). Mint marks AI and live state; amber and red are reserved for safety. No visible scrollbars, no horizontal scrolling at 390 px. See [docs/DESIGN.md](docs/DESIGN.md).
- Dates shown to clinicians go through [`app/src/lib/format.ts`](app/src/lib/format.ts) so server and browser render the same text.
- Commit messages: imperative mood, one topic per commit (`Add brigatinib interaction rule`, not `fixes`).

## Reporting issues

Use the issue templates: bug report, feature request, or **clinical safety concern** (for anything that could mislead a clinician). Security issues go through private reporting; see [SECURITY.md](SECURITY.md).
