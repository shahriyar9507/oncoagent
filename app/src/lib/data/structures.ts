// Experimental structures from RCSB PDB used for the structure-insight view (titles checked against RCSB on 2026-11-20).
export interface StructureInfo {
  pdbId: string;
  title: string;
  protein: string;
  insight: string[];
}

export const structures: Record<string, StructureInfo> = {
  "P-001": {
    pdbId: "1M17",
    title: "EGFR tyrosine kinase domain with the inhibitor erlotinib",
    protein: "EGFR kinase domain",
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
    insight: [
      "The EML4::ALK fusion keeps the ALK kinase domain constantly active.",
      "ALK inhibitors bind the ATP pocket shown here; newer agents reach the brain better, which matters with brain metastases.",
      "Explanatory view only: treatment choice follows guideline evidence.",
    ],
  },
};
