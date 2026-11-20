# Architecture — Agentic AI-based Precision Oncology Platform (working name: OncoAgent)

Version 0.2 · 2026-11-20 · Status: proposal for review. Evidence behind each design choice: [RESEARCH.md](RESEARCH.md).

## 1. Goal and scope
An AI assistant team **for oncologists and their clinical team** that (1) watches each patient's hospital data continuously, (2) proposes the next test, (3) interprets results down to the responsible gene/protein, (4) proposes therapy at three levels — select an approved drug/trial, personalise regimen and dose, and (research only) explore modified or new molecules when resistance leaves no option, (5) explains the molecular mechanism in 3D, and (6) feeds a research pipeline for licensed drug-discovery partners. **Every clinical step ends in a clinician's decision.**

- **Users:** doctors and clinical staff only (oncologists, pathologists, radiologists, tumor boards, pharmacists, oncology nurses, research scientists). No patient app, no patient-facing messages.
- **First cancer:** non-small-cell lung cancer (NSCLC). Then breast, then colorectal. All modules are cancer-agnostic; a new cancer = clinical rules + knowledge-base configuration + gold cases.

Two tracks share one data platform but have a hard wall between them:
- **Clinical track** — patient care, approved drugs, guidelines, registered trials. Regulated decision support.
- **Research track** — de-identified cohorts, target dossiers, structure work, partner discovery pipeline. Output never enters a patient's chart as a recommendation.

## 2. Design principles
1. HITL at every clinical gate (autonomy levels A0–A3; A4 forbidden) — see `.claude/skills/hitl-clinical-governance`.
2. Tools, not memory: every drug, dose, trial and citation fetched and cited.
3. Explain or don't show: every proposal is a recommendation card with reason, evidence, confidence and uncertainty.
4. Privacy by design and in-country data residency where law requires.
5. Evaluation before deployment; monitoring after.
6. Standards-first data (FHIR R4 + mCODE, GRIG, OMOP, DICOM).
7. Licences clean (AlphaFold 3 non-commercial; OncoKB commercial licence; NCCN redistribution limits).

## 3. Layered architecture
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ L6 APPS  Clinician workspace · Tumor-board mode · Research workbench          │
│          Admin & compliance console          (clinician-only, no patient app) │
├──────────────────────────────────────────────────────────────────────────────┤
│ L5 HITL  Recommendation cards · Approval queues · E-signature · Override      │
│          reasons · Escalation/on-call · Immutable audit log                   │
├──────────────────────────────────────────────────────────────────────────────┤
│ L4 AGENTS  Orchestrator (durable workflow)                                    │
│   Sentinel · Test-advisor · Genomic-interpreter · Imaging · Pathology ·       │
│   Guideline · Trial-matcher · Pharmacology-safety · Dose-optimizer ·          │
│   Structure-insight · Report-writer · Safety-critic                           │
│                     ║ research wall ║ Discovery-liaison · Analog-lab          │
├──────────────────────────────────────────────────────────────────────────────┤
│ L3 ENGINES  NGS pipelines (nf-core) · Variant KB service · Imaging AI (MONAI) │
│   Pathology foundation models · Clinical NLP/extraction · Risk models ·       │
│   Guideline RAG · Structure service (PDB / AlphaFold DB / licensed AF3-class) │
├──────────────────────────────────────────────────────────────────────────────┤
│ L2 DATA  HAPI FHIR (mCODE) · PostgreSQL+pgvector · Object store (BAM/VCF/WSI) │
│   Orthanc DICOMweb · Knowledge graph (gene–variant–drug–trial) · OMOP mart    │
│   (de-identified research zone)                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ L1 SOURCES  EHR/HIS · LIS · PACS · NGS labs (incl. external PDF reports) ·     │
│   Pathology scanners · Clinician/nurse notes & symptom entries · Public KBs    │
└──────────────────────────────────────────────────────────────────────────────┘
 Cross-cutting: Identity/consent · Security zones · De-identification gateway ·
 LLMOps/MLOps evaluation · Observability · Quality management system
```

## 4. Agent catalogue
| Agent | Trigger | Main inputs | Tools | Output | Autonomy | Approver |
|---|---|---|---|---|---|---|
| Orchestrator | any new event | event + case context | all agents, workflow engine | routes work, enforces gates | A3 (routing only) | — |
| Sentinel monitor | new lab/scan/vital/clinician symptom entry; schedule | timeline, thresholds, CTCAE entries | FHIR, rules engine, risk models | red-flag alert or watch note | A1 (critical interrupts) | on-call clinician |
| Test-advisor | new diagnosis, progression, missing biomarker | diagnosis, stage, prior tests | guideline RAG, test catalogue (local labs, turnaround, cost) | "order test X" card | A1/A2 draft order | treating oncologist |
| Genomic-interpreter | new NGS/molecular report | VCF/MAF or PDF report | variant KB (OncoKB/CIViC/ClinVar), pipelines | tiered findings + GRIG report draft | A2 | molecular pathologist |
| Imaging | new imaging report/study | DICOM, reports, prior lesions | imaging AI, RECIST calculator, NLP | response assessment draft | A2 | radiologist |
| Pathology | new pathology report/WSI | report, slides | NLP extraction, pathology FM (triage) | structured path data, biomarker triage flag | A2 | pathologist |
| Guideline | any treatment decision point | mCODE case summary | guideline RAG (versioned) | options ranked by guideline | A1 | oncologist / tumor board |
| Trial-matcher | diagnosis, progression, new biomarker | case summary, location | ClinicalTrials.gov, local trial registry | matched trials per criterion | A1 | investigator |
| Pharmacology-safety | any drug proposal or med change | meds, labs (renal/hepatic), PGx | interaction DB, label DB, local formulary | interaction/dose-check verdict | A1 (blocks on critical) | pharmacist/oncologist |
| Structure-insight | actionable or resistance variant | gene, variant | PDB, AlphaFold DB, licensed predictor, literature | 3D insight card (explanatory) | A0 | — (information) |
| Dose-optimizer (therapy L2) | regimen approved in principle; new labs; toxicity | weight/height, renal/hepatic function, PGx, toxicity grade, drug levels | label/guideline dose tables, BSA & Calvert calculators, PGx rules | dose card with formula and sources | A2 | pharmacist + oncologist |
| Report-writer | tumor board scheduled; referral; treatment summary | approved content only | templates, mCODE summary | tumor-board pre-read, referral letter, treatment summary (for clinicians) | A2 | treating clinician |
| Safety-critic | every card before display | card + sources | citation verifier, rule checks | pass / fail with reasons | A3 (can block) | — |
| Discovery-liaison (research zone) | cohort signal threshold | de-identified cohort stats | knowledge graph, literature, partner API | target dossier | A2 | principal scientist + biosafety |
| Analog-lab (therapy L3, research zone) | approved target dossier | structures, known compounds, assay data | licensed partner engine or approved in-house scoring; ADMET/synthesizability predictors | ranked candidate hypotheses with uncertainty | A2 | computational medicinal chemist + principal scientist + biosafety |

### 4a. Therapy engine levels
| Level | Question | Track | Evidence status (Nov 2026) |
|---|---|---|---|
| L1 Select | Which approved drug / regimen / trial fits this target protein? | clinical | strong for in-indication guideline matches; weak for off-label guessing (SHIVA negative, NCI-MATCH low yield) |
| L2 Personalise | Which dose and schedule for this patient's organ function, genes, toxicity? | clinical | label calculators standard; AI N-of-1 dosing (CURATE.AI) and ex-vivo testing (EXALT) promising but small |
| L3 Research | If resistance leaves no option, can a modified or new molecule work? | research only | per-mutation redesign succeeds over years (4th-gen EGFR inhibitors in phase 1/2; daraxonrasib phase 3); per-patient small molecules not routine; per-patient vaccines/ASOs/gene editing exist |

## 5. Key flow — "new molecular report arrives"
1. Lab uploads PDF or VCF → ingestion service stores file, creates FHIR DiagnosticReport; malware scan; prompt-injection sanitiser for text.
2. Orchestrator starts workflow `molecular_report_received(patient, report)`.
3. Genomic-interpreter extracts variants (structured or LLM-extraction with field-level confidence), annotates via KB service, assigns tiers.
4. In parallel: Guideline agent (options for the tumour type + variant), Trial-matcher, Pharmacology-safety (against current meds), Structure-insight (if resistance/actionable).
5. Safety-critic verifies every claim has a source and checks contraindications; failures marked "AI disagreement".
6. HITL: molecular pathologist confirms variant interpretation → oncologist sees combined card set → Approve / Modify / Reject with reason → optional tumor-board scheduling.
7. Approved plan → Dose-optimizer drafts the dose card → pharmacist and oncologist verify → orders drafted for signature in EHR (via FHIR/CDS Hooks) → Report-writer drafts the treatment summary for the chart.
8. Audit log records every step; eval store captures the decision for learning.

## 6. Core data model (beyond FHIR)
- `case_event` (id, patient_ref, type, source_ref, received_at)
- `agent_run` (id, agent, model_id, prompt_version, input_hash, started/ended, cost, status)
- `recommendation_card` (id, patient_ref, type, proposal, why[], evidence[], confidence, uncertainty, alternatives[], changes_if, safety_checks[], critic_verdict, status)
- `decision` (card_id, reviewer, role, action approve/modify/reject, reason_code, reason_text, signed_at)
- `audit_log` (append-only, hash-chained: actor, action, object, before/after hash, time)
- `evidence_item` (source type guideline/kb/trial/pmid, identifier, version, retrieved_at, excerpt)
- `target_dossier` (research zone only; cohort-level, no patient identifiers)

## 7. Technology stack (recommended)
| Concern | Choice | Why |
|---|---|---|
| Frontend | Next.js + TypeScript + Tailwind + Radix/shadcn, next-intl (en/bn) | fast, typed, i18n |
| Visual | Mol* (3D proteins), igv.js (genome), Cornerstone3D/OHIF (DICOM), Plotly/Recharts/D3, Cytoscape.js | domain-standard viewers |
| Backend | Python 3.12 FastAPI, Pydantic v2 | best bio/ML ecosystem |
| Workflows | Temporal (durable) + agent framework inside activities | retries, state, auditability |
| Clinical data | HAPI FHIR (mCODE), PostgreSQL 16 + pgvector | standards + RAG |
| Imaging | Orthanc (DICOMweb) | open source |
| Files | MinIO / S3 | BAM/VCF/WSI |
| Events | NATS JetStream (or Kafka at scale) | real-time monitoring |
| Bio pipelines | Nextflow + nf-core (sarek, rnaseq, rnafusion), VEP | reproducible |
| ML | PyTorch, MONAI, scikit-learn, lifelines | clinical ML |
| LLMs | Claude (Opus 5.5 case synthesis, Sonnet 5.5 agent steps, Haiku 5.5 extraction) behind a de-identification gateway; pinned IDs; eval-gated changes | quality + controllability |
| Auth | Keycloak (OIDC, MFA), RBAC+ABAC | hospital SSO |
| Infra | Docker Compose (dev), Kubernetes + OpenTofu (prod), in-country hosting option | residency |
| Observability | OpenTelemetry, Prometheus/Grafana, Langfuse-style LLM tracing (self-hosted) | traces with PHI controls |

## 8. Security and privacy
- Zones: **PHI zone** (FHIR, files, audit), **De-identified research zone** (OMOP, dossiers, Analog Lab), **Edge** (clinician web access via SSO/VPN only). One-way de-identification pipeline PHI → research.
- De-identification gateway for every external model call; minimum-necessary context; no training on our data by providers (contractual).
- Encryption at rest (KMS) and in transit (mTLS); secrets in vault; least privilege; break-glass access logged.
- Consent enforced at query time (FHIR Consent).
- Threat model covers prompt injection, model data exfiltration, insider misuse, ransomware; backups + DR tested.

## 9. Evaluation and monitoring
- Gold-case suite per cancer type (synthetic first, then de-identified retrospective with tumor-board answers).
- Metrics: tumor-board concordance, citation precision, unsupported-claim rate, contraindication-miss (= 0 gate), time saved, override reasons, alert acceptance, subgroup equity.
- CI gate: any prompt/model/tool change re-runs suite; regression blocks release.
- Production: drift, acceptance and override dashboards; monthly safety review; incident process.

## 10. Repository layout (to create in Phase 0)
```
apps/web/              Next.js clinician + tumor board + research workbench
services/dosing/       Level-2 calculators (BSA, Calvert, adjustments) with unit tests
services/research/     Level-3 Analog Lab adapters (research zone only)
services/api/          FastAPI gateway, auth, cards, decisions, audit
services/agents/       orchestrator workflows + specialist agents + critic
services/genomics/     Nextflow configs, annotation & tiering service
services/structure/    structure-insight service (PDB/AFDB, licence gate)
services/ingest/       FHIR/HL7/PDF/DICOM ingestion + de-identification
packages/schemas/      OpenAPI + JSON Schemas (recommendation card etc.)
evals/                 gold cases, red-team set, runners
infra/                 docker-compose, k8s, IaC
docs/                  architecture, research, regulatory, hazards, KPIs, plan
```

## 11. Roadmap
| Phase | Time | Deliverable | Exit criteria |
|---|---|---|---|
| 0 Foundation | months 0–2 | repo, dev stack, schemas, design system, synthetic **NSCLC** patients (TCGA/GENIE-informed), eval harness skeleton, hazard log, regulatory classification | one synthetic NSCLC patient flows end-to-end in a demo |
| 1 NSCLC MVP | months 2–8 | patient timeline, Sentinel (rules), Test-advisor, Genomic-interpreter (structured + PDF), Guideline RAG, Trial-matcher, Pharmacology-safety, Dose-optimizer (L2 calculators), cards + approvals + audit, Report-writer, structure-insight viewer (EGFR/ALK/KRAS first) | ≥ 90 % concordance on NSCLC gold cases, 0 contraindication misses, 0 dose-calculation errors, clinician usability target met |
| 2 Pilot + breast | months 8–14 | ethics approval, hospital integration (FHIR/HL7, PACS), silent-mode prospective study, imaging/pathology triage models, ctDNA trends; add breast cancer rules | silent-mode safety + concordance report; go/no-go for live pilot |
| 3 Scale + research | months 14–30 | live pilot with HITL, colorectal rules, OMOP research zone, target dossiers, Analog Lab (L3) with a discovery partner, regulatory submission for any SaMD parts | pilot outcomes published; partner agreement; regulatory pathway confirmed |

## 12. Team mapping
Every component has an owner agent in `.claude/agents/` (see roster in `.claude/skills/precision-oncology-platform/SKILL.md`). Clinical features require chief-medical-oncologist + clinical-safety-qa sign-off.

## 13. Decisions
Made (2026-11-20): clinician-only product; first cancer NSCLC, then breast, then colorectal; 3-level therapy engine with Level 3 in the research zone.

Open (need the founder):
1. First market and first hospital partner (Bangladesh recommended) — drives regulation, hosting and language.
2. Product form: demo for investors/partners vs hospital pilot product.
3. Budget and team (real oncologists/pathologists must join before any pilot).
4. Discovery-partner strategy for Level 3 (industry partnership vs academic medicinal-chemistry lab).
