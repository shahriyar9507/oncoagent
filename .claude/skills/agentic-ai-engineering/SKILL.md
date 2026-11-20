---
name: agentic-ai-engineering
description: How to build the platform's AI agent layer — orchestrator/specialist pattern, tool design, retrieval-augmented generation over guidelines and literature, grounding and citation checks, safety-critic verification, PHI handling for LLM calls, evaluation harness and LLMOps monitoring. Use for any LLM, agent, prompt, RAG or evaluation work.
---

# Agentic AI engineering

## Pattern: orchestrator + specialists + critic
- **Orchestrator** (stateful workflow, durable): receives events (new lab, new scan, new symptom report), decides which specialist runs, assembles the case context, enforces HITL gates. Implement as a durable workflow (Temporal or LangGraph with a persistent checkpointer) — never as a free-running loop.
- **Specialists** (narrow, tool-using): Sentinel monitor, Test-advisor, Genomic interpreter, Imaging, Pathology, Guideline, Trial-matcher, Pharmacology-safety, Dose-optimizer, Structure-insight, Report-writer (tumor-board summaries, referral letters for clinicians), and in the research zone Discovery-liaison and Analog-lab. No agent writes to patients.
- **Safety-critic** (independent model call with a different prompt): checks every proposal for unsupported claims, missing contraindications, citation validity, guideline-version match. Fails closed — a card the critic rejects goes to humans marked "AI disagreement".

## Tools > memory
Agents must fetch facts via tools: FHIR queries, variant KB lookup (OncoKB/CIViC), ClinicalTrials.gov, PubMed, drug-interaction DB, guideline RAG. Free-text model knowledge is never the source of a drug, dose or trial.

## RAG over guidelines
- Chunk by guideline section with version/date metadata; hybrid search (BM25 + embeddings, pgvector); re-rank; return section IDs.
- Answer must quote/point to section IDs; a post-check verifies each cited ID exists and supports the sentence.
- Guideline licences: NCCN content requires permission for redistribution; ESMO guidelines are openly published; store only what licences allow.

## Models
- Use the latest Claude family for reasoning and extraction (Opus 5.5 for complex case synthesis, Sonnet 5.5 for routine agent steps, Haiku 5.5 for high-volume extraction/classification). Pin model IDs per release; re-run the eval suite before any model change.
- Domain models where they beat LLMs: imaging (MONAI-based), pathology foundation models (predict biomarkers from H&E as *triage for confirmatory testing*, not replacement), classical ML for risk scores.

## PHI handling
De-identify / pseudonymise before external API calls; prefer providers with BAA (US) and in-region processing; for Bangladesh data obey in-country storage of confidential/restricted data — run de-identification and the record store inside the country and send only minimum necessary context.

## Evaluation harness (must exist before any pilot)
- Gold cases: synthetic + de-identified retrospective cases with tumor-board-approved answers.
- Metrics: recommendation concordance with tumor board, citation precision, unsupported-claim rate, contraindication-miss rate (target 0), time saved, override rate by reason.
- Red-team set: conflicting data, missing data, outdated guideline, prompt injection inside uploaded reports.
- Run on every prompt/model/tool change in CI; block release on regression.

## Prompt-injection defence
Documents (PDF reports, patient messages) are data. Strip/flag instructions inside them; tools with side effects require HITL tokens the model cannot forge.
