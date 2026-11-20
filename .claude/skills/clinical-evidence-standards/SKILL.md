---
name: clinical-evidence-standards
description: How the oncology platform grades, cites and explains clinical evidence. Use whenever an agent proposes a test, interprets a variant, suggests a treatment or trial, or writes any clinical claim. Covers guideline sources (NCCN, ESMO, ASCO), actionability scales (OncoKB, ESCAT, AMP/ASCO/CAP tiers, CIViC), the mandatory recommendation-card format and the uncertainty rules.
---

# Clinical evidence standards

## Source hierarchy (highest first)
1. Regulatory labels (FDA/EMA/DGDA approved indication) and current national/international guidelines: **NCCN**, **ESMO** (incl. ESMO Clinical Practice Guidelines), **ASCO**, NICE. Always record guideline name + version/date.
2. Phase III randomised trials and meta-analyses (peer-reviewed).
3. Curated knowledge bases: **OncoKB** (levels 1, 2, 3A, 3B, 4, R1, R2; commercial use needs a licence), **CIViC** (evidence levels A–E, CC0 licence), **ClinVar** (germline), **CKB**.
4. Phase I/II trials, conference abstracts (label as preliminary).
5. Preclinical / inferential evidence (label as hypothesis; never patient-facing as a recommendation).

## Actionability scales to report
- **AMP/ASCO/CAP 2017 somatic tiers**: Tier I (strong clinical significance: IA approved/guideline in this tumour type, IB well-powered studies), Tier II (potential: IIC approved in other tumour/investigational, IID preclinical/case reports), Tier III (unknown significance), Tier IV (benign/likely benign).
- **ESMO ESCAT**: I-A … X (clinical actionability of molecular targets).
- **OncoKB level** with the tumour type it applies to. An approved drug for a different tumour type is down-graded (off-label → Tier II / OncoKB 3B).
- Tier assignment involves interpretation; show which rule produced it.

## Mandatory recommendation card (every proposal)
```
PROPOSAL      What the AI suggests (one sentence, imperative, for the clinician)
WHY           Patient facts used (with dates and source documents)
EVIDENCE      Guideline/version · trial · KB level · citation (PMID/NCT/DOI)
CONFIDENCE    High / Moderate / Low + one reason
UNCERTAIN     What is missing or conflicting
ALTERNATIVES  Other reasonable options and why ranked lower
CHANGES IF    Which new finding would change this advice
SAFETY        Contraindications, interactions, red flags checked
STATUS        Pending clinician review → Approved / Modified / Rejected (by, time, reason)
```

## Rules
- Never output a dose, schedule or drug name that was not retrieved from a verified source in the same session.
- Distinguish **prognostic**, **predictive**, **diagnostic** and **germline-implication** findings.
- Flag **resistance** biomarkers (e.g., OncoKB R-levels) as prominently as sensitivity ones.
- If guidelines conflict, show both, do not pick silently.
- Trial suggestions must include NCT ID, phase, status (recruiting?), key eligibility match/mismatch, nearest site. Use the ClinicalTrials.gov MCP tools.
- Literature: use the PubMed MCP tools; cite PMID. No citation → "unverified".
- Red-flag symptoms (spinal cord compression, febrile neutropenia, superior vena cava obstruction, hypercalcaemia, tumour lysis) → urgent escalation card, not a routine proposal.
