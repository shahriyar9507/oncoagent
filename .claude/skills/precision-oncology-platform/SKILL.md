---
name: precision-oncology-platform
description: Master skill for the Agentic AI-based Precision Oncology Platform (OncoAgent) project in this folder. Load FIRST for any work on this project — planning, research, architecture, code, UI, data, clinical content. Gives the mission, users (doctors only), first cancer focus (NSCLC), non-negotiable safety rules, the 3-level therapy engine, the architecture map, the expert team roster and the definition of done.
---

# Agentic AI-based Precision Oncology Platform — master skill

## Mission (one line)
An AI assistant team **for oncologists** that watches each patient's hospital data, proposes the next test, interprets results down to the responsible gene/protein, proposes therapy at three levels (select → personalise dose → research a modified/new molecule), and records every decision the doctor makes.

## Users — doctors and clinical staff only
Medical oncologist, molecular pathologist, radiologist, radiation/surgical oncologist, tumor board, clinical pharmacist, oncology nurse (clinical role), research scientist. **There is no patient app and no patient-facing messaging.** Symptom data comes from clinician/nurse entries and hospital systems.

## First cancer: non-small-cell lung cancer (NSCLC)
Chosen for data availability and actionability (see docs/RESEARCH.md §7): largest cancer type in AACR GENIE (38,000+ NSCLC samples), TCGA + CPTAC proteogenomics, NLST CT data (26,254 subjects), 40–60 % of adenocarcinomas carry an oncogenic/actionable driver, ~30 new NSCLC drugs approved since 2011, #1 cancer for incidence and death worldwide. Order: NSCLC (Phase 1) → breast (Phase 2) → colorectal (Phase 3). Build every module cancer-agnostic so new cancers are configuration + clinical rules, not a rewrite.

## The 3-level therapy engine (see skill `therapy-personalization-engine`)
1. **Select** an approved drug / guideline regimen / registered trial matched to the target protein. Clinical track.
2. **Personalise** regimen and dose (organ function, pharmacogenomics, toxicity, drug levels, model-informed dosing). Clinical track, clinician signs.
3. **Research a modified or new molecule** when resistance leaves no option (Analog Lab, de-identified research zone). Output = research hypotheses for medicinal chemists/partners → lab → preclinical → trials. **Never given to a patient outside an approved trial or regulator-sanctioned programme.**

## Non-negotiable rules
1. **Human-in-the-loop.** AI proposes, a licensed clinician disposes. See `hitl-clinical-governance`.
2. **Every proposal ships with its reason** — recommendation-card format in `clinical-evidence-standards`.
3. **No invented facts.** Drugs, doses, trial IDs, variants, guideline versions, citations come from tools/databases/cited documents; otherwise "unverified".
4. **Research never leaks into the chart.** Level-3 outputs stay in the research zone.
5. **Biosafety boundary.** Only human cancer targets for therapeutic research; never toxins, pathogen components, immune evasion or harm enhancement; no synthesis/wet-lab protocols in code or docs. See `structural-biology-module`.
6. **Privacy by design.** HIPAA (US); Bangladesh PDPO 2025 (health/genetic = sensitive; confidential/restricted data in-country). De-identify before external model calls; log every access.
7. **Synthetic/public data only** until an ethics-approved pilot (Synthea, TCGA/GDC open, cBioPortal, GENIE under its terms, TCIA collections).
8. **Language.** Clinician UI in English with a Bangla toggle for labels and summaries; clinical terms stay standard (HGVS, drug INN names).

## Architecture map (details: docs/ARCHITECTURE.md)
```
L1 Sources   EHR/HIS · LIS · PACS(DICOM) · NGS labs (VCF or PDF) · pathology WSI · clinician/nurse notes & symptom entries
L2 Data      FHIR (mCODE) · PostgreSQL+pgvector · object store · knowledge graph (gene–variant–drug–trial) · OMOP research mart (de-identified)
L3 Engines   NGS pipelines · variant KB · imaging AI · pathology AI · clinical NLP · PK/dosing models · structure service · analog scoring (research)
L4 Agents    Orchestrator → Sentinel · Test-advisor · Genomic-interpreter · Imaging · Pathology · Guideline · Trial-matcher ·
             Pharmacology-safety · Dose-optimizer · Structure-insight · Report-writer · Safety-critic ║ Discovery-liaison · Analog-lab (research)
L5 HITL      recommendation cards · approval queues · e-sign · override reasons · escalation · immutable audit log
L6 Apps      clinician workspace · molecular tumor board · research workbench · admin/compliance   (no patient app)
```

## The expert team — who to call (`.claude/agents/`)
| Need | Agent |
|---|---|
| Plan, split work, track phases | `project-orchestrator` |
| Treatment logic, tumor board chair, gold cases | `chief-medical-oncologist` |
| Biomarkers, molecular report sign-out | `molecular-pathologist` |
| Imaging, RECIST | `oncologic-radiologist` |
| Radiotherapy | `radiation-oncologist` |
| Surgery, resectability | `surgical-oncologist` |
| Hereditary cancer, germline | `cancer-geneticist` |
| Interactions, dosing, PGx, model-informed dosing | `clinical-pharmacologist` |
| Toxicity follow-up, symptom triage (clinical) | `oncology-nurse-specialist` |
| Trial matching, biostatistics | `clinical-trials-biostatistician` |
| Tumour biology, target dossiers | `cancer-research-scientist` |
| Literature / landscape research | `research-lead` |
| NGS pipelines, variants | `bioinformatician` |
| Protein structure, resistance in 3D | `structural-biologist` |
| Level-3 analog hypotheses, ADMET, med-chem review | `computational-medicinal-chemist` |
| Agents, LLMs, RAG, evals | `ai-llm-engineer` |
| Predictive models, validation | `ml-data-scientist` |
| KPIs, cohort analytics | `healthcare-data-analyst` |
| Charts, genome browser, 3D | `bio-visualization-specialist` |
| UX, design system | `ui-ux-designer` (+ user skill `ui-ux-pro-max`) |
| Web app | `frontend-developer` |
| APIs, FHIR, workflows | `backend-developer` |
| Cloud, security, CI/CD | `devops-security-engineer` |
| Regulation, ethics, privacy | `regulatory-ethics-officer` |
| Clinical safety review, tests | `clinical-safety-qa` |

Personas are roles at the standard of senior consultants in leading cancer centres; never real named people.

## Project files
`docs/RESEARCH.md` (sources) · `docs/ARCHITECTURE.md` · `docs/brief/index.html` (Bangla brief).

## Definition of done
Rules 1–8 hold; `clinical-safety-qa` pass for clinical features; claims cited; code tested; clinical logic has gold test cases reviewed by `chief-medical-oncologist`.
