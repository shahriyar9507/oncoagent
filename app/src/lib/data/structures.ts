// Experimental structures from RCSB PDB used for the structure-insight view (titles checked against RCSB on 2026-11-20).
// Residue numbers are as deposited in each PDB file, checked against the coordinate files on 2026-11-20.
// 1M17 uses mature EGFR numbering (24 lower than the clinical numbering): C773 = C797, L834 = L858, T766 = T790.
export interface Highlight {
  /** auth_seq_id in the PDB file. */
  seq: number;
  chain: string;
  label: string;
  role: "driver" | "resistance" | "site";
  note: string;
}

export interface StructureInfo {
  pdbId: string;
  title: string;
  protein: string;
  /** Ligand residue as deposited (chain and auth_seq_id). */
  ligand: { code: string; name: string; chain: string; seq: number };
  highlights: Highlight[];
  insight: string[];
}

export const structures: Record<string, StructureInfo> = {
  "P-001": {
    pdbId: "1M17",
    title: "EGFR tyrosine kinase domain with the inhibitor erlotinib",
    protein: "EGFR kinase domain",
    ligand: { code: "AQ4", name: "erlotinib", chain: "A", seq: 999 },
    highlights: [
      { seq: 834, chain: "A", label: "L858", role: "driver", note: "L834 in the PDB file. L858R keeps the kinase switched on: the reason EGFR inhibitors work." },
      { seq: 773, chain: "A", label: "C797", role: "resistance", note: "C773 in the PDB file. Osimertinib bonds to this cysteine; C797S removes it." },
      { seq: 766, chain: "A", label: "T790", role: "site", note: "T766 in the PDB file. The gatekeeper; T790M was the earlier resistance route." },
    ],
    insight: [
      "L858 sits in the activation loop: L858R keeps the kinase switched on, which is why EGFR inhibitors work.",
      "C797 lines the edge of the ATP pocket where osimertinib forms its covalent bond; C797S removes that cysteine, so binding weakens.",
      "Explanatory view only: treatment choice follows guideline evidence.",
    ],
  },
  "P-002": {
    pdbId: "6OIM",
    title: "KRAS G12C covalently bound to AMG 510 (sotorasib)",
    protein: "KRAS G12C",
    ligand: { code: "MOV", name: "sotorasib", chain: "A", seq: 303 },
    highlights: [
      { seq: 12, chain: "A", label: "C12", role: "driver", note: "The G12C mutation creates this cysteine; sotorasib bonds to it in the switch-II pocket." },
    ],
    insight: [
      "The G12C mutation creates a cysteine that KRAS G12C inhibitors bind covalently in the switch-II pocket.",
      "In this setting the inhibitors are approved after prior therapy; first-line use is through trials.",
      "Explanatory view only: treatment choice follows guideline evidence.",
    ],
  },
  "P-003": {
    pdbId: "2XP2",
    title: "ALK kinase domain in complex with crizotinib",
    protein: "ALK kinase domain",
    ligand: { code: "VGH", name: "crizotinib", chain: "A", seq: 9000 },
    highlights: [
      { seq: 1196, chain: "A", label: "L1196", role: "site", note: "Gatekeeper residue; L1196M is a known resistance mutation." },
      { seq: 1202, chain: "A", label: "G1202", role: "resistance", note: "Solvent-front residue; G1202R is a common resistance mutation after second-generation inhibitors." },
    ],
    insight: [
      "The EML4::ALK fusion keeps the ALK kinase domain constantly active.",
      "ALK inhibitors bind the ATP pocket shown here; newer agents reach the brain better, which matters with brain metastases.",
      "L1196 and G1202 are where resistance mutations often arise; lorlatinib was designed to keep binding when they change.",
      "Explanatory view only: treatment choice follows guideline evidence.",
    ],
  },
};

/**
 * Structure view for a clinician-entered case: reuse a verified PDB scene when the driver matches, and keep only the
 * highlights that apply to this patient (the gatekeeper site always; driver and resistance residues only when present).
 */
export function structureForVariants(variants: { gene: string; alteration: string }[]): StructureInfo | undefined {
  const has = (gene: string, re: RegExp) => variants.some((v) => v.gene.toUpperCase() === gene && re.test(v.alteration));
  let baseKey: string | undefined;
  if (variants.some((v) => v.gene.toUpperCase() === "EGFR")) baseKey = "P-001";
  else if (has("KRAS", /G12C/i)) baseKey = "P-002";
  else if (variants.some((v) => v.gene.toUpperCase() === "ALK")) baseKey = "P-003";
  if (!baseKey) return undefined;
  const s = structures[baseKey];
  const applies = (label: string) => variants.some((v) => v.alteration.toUpperCase().startsWith(label.toUpperCase()) || (label === "C12" && /G12C/i.test(v.alteration)));
  const highlights = s.highlights.filter((h) => h.role === "site" || applies(h.label));
  return { ...s, highlights, insight: s.insight.filter((line) => !s.highlights.some((h) => line.startsWith(h.label)) || highlights.some((h) => line.startsWith(h.label))) };
}
