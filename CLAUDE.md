# OncoAgent — Agentic AI-based Precision Oncology Platform

Before any work here, load the project skill `precision-oncology-platform` (`.claude/skills/precision-oncology-platform/SKILL.md`). It holds the safety rules, architecture map and the expert-agent roster.

- **Users: doctors and clinical staff only.** No patient app, no patient-facing messages.
- **First cancer: non-small-cell lung cancer (NSCLC)**; then breast, then colorectal. Keep modules cancer-agnostic.
- **Therapy engine:** L1 select approved drug/trial → L2 personalise regimen & dose → L3 research-zone Analog Lab for modified/new molecules (never direct to patients). Skill: `therapy-personalization-engine`.
- Architecture: `docs/ARCHITECTURE.md` · Research (with sources): `docs/RESEARCH.md` · Bangla brief: `docs/brief/index.html`
- Agents: `.claude/agents/` (25 roles). Skills: `.claude/skills/` (13 project skills) + user-level `ui-ux-pro-max`, `impeccable`, `frontend-design`, `dataviz`, `web3d-integration-patterns`, `data:*`, `engineering:*`, `healthcare:*`.
- Hard rules: AI proposes, clinician decides · every claim sourced · research never enters the chart · biosafety boundary in `structural-biology-module` · synthetic/public data only until ethics approval.
- The user reads Bangla best for briefs and explanations; technical docs may be English.
