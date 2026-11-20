---
name: regulatory-compliance
description: Regulatory, privacy, quality and ethics requirements for the oncology platform — FDA CDS guidance (Jan 2026) and SaMD, IEC 62304, ISO 14971, ISO 13485, IEC 62366, EU MDR / AI Act, HIPAA, Bangladesh Personal Data Protection Ordinance 2025 and DGDA, IRB/ethics, clinical-trial rules for novel therapies. Use when deciding what is a medical device, designing data flows, planning pilots, or writing any compliance artefact.
---

# Regulatory & compliance

## Is our software a medical device?
- **US FDA — Clinical Decision Support guidance, revised Jan 2026** (supersedes 2022): non-device CDS must be for health-care professionals, not process medical images/signals/IVD patterns, and let the HCP independently review the basis. The 2026 revision relaxed the earlier position on "single recommendation" outputs. The guidance is largely silent on LLM transparency — design for explainability anyway. Verify current text on fda.gov.
- Anything that **analyses images, pathology slides or raw sequencing signals** → regulated **SaMD** (510(k)/De Novo; plan a Predetermined Change Control Plan for ML updates).
- **EU**: MDR Class IIa+ likely; EU AI Act high-risk obligations.
- **Bangladesh**: medical devices regulated by DGDA (Directorate General of Drug Administration); confirm current software/AI rules with DGDA before a clinical pilot.

## Quality system (build from day 1, even pre-regulatory)
IEC 62304 software lifecycle (Class B/C), ISO 14971 risk management (hazard log for every agent), IEC 62366 usability engineering, ISO 13485 QMS when commercialising, ISO 27001 / SOC 2 for security.

## Privacy
- US: HIPAA (BAA with every vendor touching PHI).
- **Bangladesh Personal Data Protection Ordinance 2025** (cabinet approved Oct 2025, gazetted Nov 2025): health and genetic data are sensitive; data subjects own their data; confidential/restricted data must be stored within Bangladesh; penalties for breaches; research/public-health exemptions exist — check the gazette and any sector rules.
- Genomic data is re-identifiable: no public release of individual-level genotypes.

## Ethics / research
- IRB / ethics committee approval (e.g., BMRC in Bangladesh) for any pilot using real data; informed consent including AI use and data sharing.
- Report AI studies with TRIPOD+AI / CONSORT-AI / DECIDE-AI.

## Novel therapies (reality check)
- A newly designed molecule needs preclinical safety studies, IND/CTA, and phased trials before any patient use.
- FDA **"plausible mechanism" framework** (draft guidance Feb 2026) targets individualised genetic therapies for severe rare diseases — not a shortcut for new cancer drugs; status beyond draft unconfirmed as of Nov 2026.
- Personalised neoantigen vaccines (e.g., intismeran autogene + pembrolizumab, positive Phase 3 in resected melanoma, ESMO 2026) are made by licensed manufacturers inside trials/approvals; our platform's role is matching and data, not manufacture.
