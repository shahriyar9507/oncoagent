---
name: oncology-visualization
description: Visualization standards for the oncology platform — patient timeline, oncoprint, lollipop/needle plots, Kaplan–Meier, waterfall and swimmer plots, MRD/ctDNA trends, genome browser (igv.js), 3D protein viewer (Mol*), DICOM imaging viewer (Cornerstone3D/OHIF), knowledge-graph and architecture diagrams. Use for any chart, diagram, 3D view or dashboard; pair with the user-level `dataviz` and `web3d-integration-patterns` skills.
---

# Oncology visualization

## Chart catalogue (pick by question)
| Question | Visual | Library |
|---|---|---|
| What happened to this patient, when? | Patient journey timeline (diagnoses, tests, therapies, response, symptoms) | custom SVG/D3 or vis-timeline |
| Which genes are altered across a cohort? | Oncoprint | cBioPortal oncoprint.js / custom D3 |
| Where on the protein is the mutation? | Lollipop / needle plot | g3-lollipop / custom D3 |
| Did tumours shrink? | Waterfall plot (best % change, RECIST lines at −30 %/+20 %) | Plotly / Recharts |
| How long did each patient stay on therapy? | Swimmer plot | Plotly / D3 |
| Survival by group | Kaplan–Meier with risk table | Plotly / lifelines → JSON |
| Is the disease coming back? | ctDNA VAF / MRD trend with treatment bands | Recharts |
| Gene–variant–drug–trial links | Knowledge-graph view | Cytoscape.js |
| Reads at a variant | Genome browser | igv.js |
| 3D protein + variant + drug site | Molecular viewer | Mol* (molstar) |
| CT/MRI/PET | DICOM viewer with measurements | Cornerstone3D / OHIF |

## Rules
- Colour: one validated categorical palette, colour-blind safe; severity colours reserved (red = urgent only). Works in light and dark.
- Always label units, dates, data source and "as of" time. Show missing data explicitly (hatched), never as zero.
- AI-derived marks are visually distinct (dashed outline / "AI" badge) from clinician-verified data.
- 3D: show predicted-structure confidence colouring (pLDDT bands) by default for predicted models; label "predicted" vs "experimental".
- Performance: virtualise long timelines; lazy-load Mol* and imaging viewers; WebGL fallback message.
- Accessibility: every chart has a text summary and a data-table view.
