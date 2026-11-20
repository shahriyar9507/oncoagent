---
name: therapy-personalization-engine
description: The platform's 3-level therapy engine — Level 1 select an approved drug/regimen/trial by target protein, Level 2 personalise regimen and dose (organ function, PGx, toxicity, TDM, model-informed precision dosing, functional drug testing), Level 3 research-zone Analog Lab for modified/new molecules when resistance leaves no option. Covers evidence, real-world benchmarks, accuracy limits and hand-offs. Use for any therapy, dosing, resistance or "custom medicine" work.
---

# Therapy personalisation engine

Nothing here is 100 % accurate; every level reports uncertainty and ends in a clinician (Levels 1–2) or scientist + biosafety (Level 3) decision.

## Level 1 — Select (clinical track)
- Inputs: tumour type + stage, driver/resistance alterations with OncoKB/ESCAT/AMP levels, PD-L1, prior lines, organ function, comorbid drugs, local availability/cost.
- Sources: guideline RAG (versioned), drug labels, OncoKB/CIViC, ClinicalTrials.gov.
- Rule: in-indication, guideline-backed matches first. **Off-label "one gene → one drug" guessing is weak** — SHIVA (randomised) showed no PFS benefit for histology-agnostic off-label targeted therapy; NCI-MATCH found actionable alterations in ~38 % and assigned only ~18 %, and most arms missed their 16 % response bar. Higher matching of multiple alterations (I-PREDICT) correlated with better outcomes. Present off-label options only with level, evidence and "consider trial" framing.

## Level 2 — Personalise regimen and dose (clinical track)
- Deterministic calculators (unit-tested, label-sourced): BSA dosing, carboplatin by Calvert formula from renal function, hepatic/renal adjustments, label dose-reduction steps for toxicity, mandatory premedication/supplementation reminders.
- Pharmacogenomic gates where labels/guidelines say so (e.g., DPYD for fluoropyrimidines, UGT1A1 for irinotecan).
- Therapeutic drug monitoring where validated (e.g., 5-FU AUC-guided dosing in some centres).
- Model-informed precision dosing / N-of-1 AI dosing = research-grade evidence: CURATE.AI feasibility (10 patients, 26 of 27 considered recommendations accepted, average dose ~20 % lower than projected standard, no randomised outcome data yet).
- Functional precision medicine (ex vivo drug testing on patient cells): EXALT (haematological cancers) — 54 % of 56 guided patients reached PFS ratio ≥ 1.3; randomised EXALT-2 ongoing. For solid tumours (organoids) still investigational — show as information, not as a default.
- Output: dose card with formula, inputs (with dates), label/guideline source, rounding policy, and "pharmacist + oncologist must verify".

## Level 3 — Modified / new molecule (research zone only)
Real-world state (Nov 2026):
- **Per-mutation redesign works but takes years.** EGFR C797S (resistance to osimertinib, first reported 2015) still has no approved drug; fourth-generation inhibitors are in phase 1/2 (e.g., BH-30643 ORR 45 % in 40 patients, 2026). Daraxonrasib (pan-RAS(ON)) — RAS was "undruggable" for decades — phase 3 RASolute 302: median OS 13.2 vs 6.7 months (HR 0.40) in second-line pancreatic cancer.
- **Per-patient custom medicine exists for programmable modalities**: personalised mRNA neoantigen vaccines (intismeran phase 3, autogene cevumeran phase 1→2), antisense oligonucleotides (milasen, <1 year, 2019), in-vivo base editing (baby KJ, ~6 months, 2025), CAR-T (patient's own cells, approved since 2017). These are templates where only a sequence changes.
- **Per-patient new small molecules are not routine**: each new chemical entity needs synthesis, ADMET/toxicology, GMP manufacture and regulatory clearance. AI-native molecules: phase I success 80–90 % (21/24) but phase II ~40 % (4/10), similar to industry; oncology historic likelihood of approval from phase I ≈ 5 %.
- **Prediction accuracy is moderate**: AF3 pose success ~76 % (PoseBusters, <2 Å; higher with pocket given); affinity models rank compounds moderately (e.g., Boltz-2 Pearson ~0.66 vs FEP+ ~0.78 on a benchmark). Every in-silico ranking needs lab confirmation.

Analog Lab (what the platform does at Level 3):
1. Trigger: de-identified cohort signal (recurrent resistance pattern with no approved option).
2. Target dossier (biology, prevalence, structures, existing compounds/trials) → principal scientist + biosafety approval.
3. In-silico candidate hypotheses (modifications of known scaffolds or partner-generated molecules) each with predicted binding, selectivity, ADMET flags, synthesizability score and **uncertainty**; generation runs inside licensed partner engines or approved in-house tools — no recipes in repo docs.
4. Medicinal-chemistry review (`computational-medicinal-chemist`) → partner lab synthesis/testing → preclinical → IND/CTA → trials.
5. Clinical bridge: Level 1 shows patients the **trials** of next-generation drugs (that is how today's patient benefits).

Hard limits: same as `structural-biology-module` (human cancer targets only; no toxins/pathogens/harm enhancement; no synthesis protocols).
