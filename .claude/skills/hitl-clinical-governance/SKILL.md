---
name: hitl-clinical-governance
description: Human-in-the-loop design for the oncology platform — approval gates, who may approve what, audit trail, override capture, escalation, autonomy levels per agent, and alert-fatigue limits. Use when designing any agent action, workflow, database table for decisions, or UI that shows AI proposals.
---

# Human-in-the-loop clinical governance

## Autonomy levels (assign one to every agent action)
| Level | Meaning | Examples |
|---|---|---|
| A0 Observe | Read and summarise only | timeline summary, data completeness check |
| A1 Suggest | Creates a proposal card; nothing happens until approved | order a test, change therapy, enrol in trial |
| A2 Prepare | Drafts an artefact for signature (order, letter, report) | draft NGS order, draft tumor board summary |
| A3 Act-reversible | Acts automatically, reversible, low risk, logged | send appointment reminder, re-run a pipeline |
| A4 Act-clinical | **Forbidden** in this platform | prescribing, final diagnosis, patient-facing clinical advice without review |

## Approval gates (who signs)
- Test orders → treating oncologist.
- Molecular report interpretation → molecular pathologist + oncologist.
- Treatment plan → tumor board (multidisciplinary) or treating oncologist per local policy.
- Trial enrolment → investigator + patient consent.
- Patient messages with clinical content → clinician or oncology nurse.
- Research hypotheses from the structure/discovery module → principal scientist + biosafety officer; never enters the patient chart as a recommendation.

## Audit trail (immutable, append-only)
Store for every proposal: input snapshot hash, model + version, prompt template version, retrieved evidence IDs, output, confidence, reviewer, decision (approve / modify / reject), reason text, timestamps, downstream action ID. Retain per local law (plan ≥ 10 years for oncology records).

## Override capture
A rejection or modification requires a short reason (pick-list + free text). Reasons feed the evaluation loop — they are the most valuable training signal; never punish clinicians for overriding.

## Escalation
- Red-flag findings: interrupt-level alert to on-call clinician, with acknowledgement timer and second-tier escalation.
- Everything else: batched into a daily review queue, ranked by clinical urgency.

## Alert-fatigue limits
- Max interruptive alerts per clinician per shift: configurable, default 5; the rest go to queue.
- De-duplicate: same proposal for same patient within 72 h is merged.
- Track acceptance rate per alert type; retire alerts below 10 % acceptance after review.

## Transparency to clinicians
Show what the AI looked at, what it did not have, and its confidence. Provide one-click "show source document".
