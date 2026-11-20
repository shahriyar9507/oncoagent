---
name: medical-ui-ux
description: UI/UX rules for the oncology platform's clinician-only product — clinician workspace, tumor-board view, dose cards, research workbench — recommendation-card design, approval flows, information density, alert design, English/Bangla labels, accessibility and safety-critical interaction patterns. There is no patient app. Use for any screen, component or design-system work; load together with the user-level `ui-ux-pro-max` skill (and `impeccable`/`frontend-design` for polish).
---

# Medical UI/UX (clinician-only product)

## Users and their one job
| User | Job on the screen |
|---|---|
| Medical oncologist | Decide the next step for a patient in < 2 minutes with full confidence in the source |
| Molecular pathologist | Verify variant interpretation and sign the report |
| Radiologist | Confirm lesion measurements and response category |
| Tumor board | See one shared case summary, discuss, record the decision |
| Clinical pharmacist | Verify dose cards and interaction checks |
| Oncology nurse | Enter symptoms/toxicity at visits and follow-up calls, work the triage queue |
| Research scientist | Explore de-identified cohorts, target dossiers and Analog Lab candidates |

No screen is designed for patients or the public.

## Core patterns
- **Recommendation card** (from `clinical-evidence-standards`): proposal headline, why, evidence chips (guideline/version, KB level, PMID/NCT), confidence meter, "what is uncertain", buttons **Approve / Modify / Reject** (reject and modify require a reason). Never a single "Accept all".
- **Dose card** (Level 2): formula, every input with its date and source, result, rounding, label reference, "verify" checkboxes for pharmacist and oncologist.
- **Therapy level badge** on every option: L1 Select · L2 Personalise · L3 Research (L3 appears only in the research workbench).
- **Source-on-hover**: every AI sentence links to the document/line it came from.
- **AI vs human provenance**: AI text has an "AI draft" badge until a clinician signs.
- **Urgency tiers**: Critical (interruptive, needs acknowledgement), Today (queue top), Routine. Only Critical may interrupt.
- **Patient journey timeline** is the home screen of each patient record.
- Dense but calm: 14–16 px body, tabular numerals for labs and doses, consistent units, no decorative motion in clinical views.

## Language
- English UI with a Bangla toggle for labels and summaries; keep HGVS, gene symbols and drug INN names unchanged in both.
- Bangla fonts: Hind Siliguri / Noto Sans Bengali; line-height ≥ 1.6; test conjunct rendering. Western numerals in all clinical values.

## Safety-critical interaction
- Confirm clinical actions with a consequence summary; undo where possible.
- No dark patterns; no auto-approve timers.
- Show data freshness ("creatinine from 3 days ago") — stale inputs block dose cards.
- WCAG 2.2 AA minimum; keyboard-complete; colour never the only signal.

## Hand-off
Design tokens in `DESIGN.md` (colour, type, spacing, radius, elevation, severity semantics, AI-provenance styling).
