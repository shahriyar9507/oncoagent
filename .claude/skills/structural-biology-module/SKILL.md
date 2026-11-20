---
name: structural-biology-module
description: Scope, licensing and safety rules for the platform's protein-structure and drug-discovery liaison module — structure prediction (AlphaFold DB / AlphaFold 3 / open alternatives), mapping patient variants onto 3D structures, explaining drug-resistance mechanisms, druggability notes, and hand-off to licensed discovery partners (e.g., Isomorphic Labs). Use for any structure, target or drug-discovery related work.
---

# Structural biology & discovery-liaison module

## What this module does (in scope)
1. **Explain**: place a patient's variant on the protein's 3D structure (experimental PDB or predicted) and show why it matters — e.g., a kinase-domain mutation near a drug's binding site that explains resistance.
2. **Prioritise targets for research**: aggregate de-identified cohort data (recurrent variants with no approved therapy) into a target dossier: biology, existing drugs/trials, known structures, literature.
3. **Liaise**: package target dossiers for licensed discovery partners and track the partner's candidate pipeline status. Candidate molecules remain **research assets** until they pass preclinical work and regulated clinical trials.
4. **Analog Lab support (therapy Level 3, research zone)**: supply structures, pocket annotations and confidence to the Analog Lab described in `therapy-personalization-engine`; candidate generation itself runs inside licensed partner engines or approved in-house tools and is reviewed by `computational-medicinal-chemist`.

## Out of scope (hard limits)
- No patient ever receives a molecule from this module outside an approved clinical trial or regulator-sanctioned programme.
- Only human cancer-associated targets. Never design, optimise, or describe toxins, pathogen proteins, virulence/transmissibility, immune evasion, or anything that could increase harm.
- No wet-lab synthesis or expression protocols. No step-by-step generative design recipes in docs or code — the design step is a black-box call to a licensed partner under biosafety review.

## Tools and licensing (verify before use; see docs/RESEARCH.md)
| Tool | Use | Licence note |
|---|---|---|
| AlphaFold Protein Structure Database (EMBL-EBI) | precomputed single-chain structures | CC-BY 4.0, commercial use allowed |
| AlphaFold 3 (code + weights) | complexes (protein–ligand/DNA/RNA) | weights **non-commercial only**; outputs not for commercial use; commercial → licence via Google DeepMind / Isomorphic |
| AlphaFold Server | quick complex predictions | non-commercial, daily quota |
| Open re-implementations (e.g., OpenFold3, Boltz, Protenix, Chai) | complexes with commercial-friendly terms | check each licence + weights terms at time of use |
| Isomorphic Labs IsoDDE (announced Feb 2026) | integrated design engine | partner-only, not self-service; performance claims are company-reported |
| RCSB PDB | experimental structures | free |
| Mol* (molstar) | 3D viewer in our web app | MIT |

## Output format for clinicians
A "structure insight" card: protein, variant, location (domain, distance to drug site if known), known effect from literature (cited), confidence of predicted structure (pLDDT/PAE ranges), and an explicit line: *"Structural insight is explanatory; treatment choice follows guideline evidence."*

## Confidence honesty
Predicted structures can be wrong in disordered regions and for novel complexes; always display model confidence and never present a prediction as an experimental structure.
