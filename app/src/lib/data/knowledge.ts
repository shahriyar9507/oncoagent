// Curated NSCLC therapy knowledge pack, version 2026-11-20.
// A summary of public regulatory approvals and pivotal trials for demonstration. It is not a guideline:
// every entry must be checked against the current product label and NCCN / ESMO guideline before clinical use.

export const KNOWLEDGE_VERSION = "nsclc-pack 2026-11-20";

export const FDA_APPROVALS_URL =
  "https://www.fda.gov/drugs/resources-information-approved-drugs/oncology-cancer-hematologic-malignancies-approval-notifications";

export function dailymedSearch(drug: string): string {
  return `https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=${encodeURIComponent(drug)}`;
}

export interface TherapyOption {
  id: string;
  regimen: string;
  drugs: string[];
  rank: number;
  role: "preferred" | "option" | "later-line" | "trial";
  basis: string;
  notes: string;
  /** Regimen key in regimens.ts when a dose card can be calculated. */
  regimenKey?: string;
  url: string;
}

export interface BiomarkerEntry {
  key: string;
  title: string;
  setting: string;
  driver: { gene: string; alteration: string; meaning: string };
  options: TherapyOption[];
  notRecommended: { regimen: string; why: string }[];
  testsToConsider: { test: string; why: string }[];
}

export const knowledge: Record<string, BiomarkerEntry> = {
  EGFR_POST_OSIMERTINIB: {
    key: "EGFR_POST_OSIMERTINIB",
    title: "EGFR-mutant NSCLC progressing on osimertinib",
    setting: "Second line after a third-generation EGFR inhibitor",
    driver: {
      gene: "EGFR",
      alteration: "L858R with acquired C797S",
      meaning:
        "L858R is the sensitising driver. C797S removes the cysteine that osimertinib binds covalently, a known on-target resistance mechanism.",
    },
    options: [
      {
        id: "egfr2-amivantamab-chemo",
        regimen: "Amivantamab + carboplatin + pemetrexed",
        drugs: ["amivantamab", "carboplatin", "pemetrexed"],
        rank: 1,
        role: "preferred",
        basis: "FDA approval Sep 2024 after osimertinib progression (MARIPOSA-2).",
        notes: "Infusion reactions with first doses; weight-band dosing for amivantamab per label.",
        regimenKey: "carboplatin-pemetrexed",
        url: FDA_APPROVALS_URL,
      },
      {
        id: "egfr2-platinum-pemetrexed",
        regimen: "Carboplatin + pemetrexed",
        drugs: ["carboplatin", "pemetrexed"],
        rank: 2,
        role: "option",
        basis: "Platinum doublet is the standard chemotherapy backbone after EGFR TKI failure.",
        notes: "Choose when amivantamab is unavailable or not affordable.",
        regimenKey: "carboplatin-pemetrexed",
        url: FDA_APPROVALS_URL,
      },
      {
        id: "egfr2-trial",
        regimen: "Clinical trial of a fourth-generation EGFR inhibitor active against C797S",
        drugs: [],
        rank: 3,
        role: "trial",
        basis: "No approved C797S-directed drug; several agents in phase 1–3 trials (e.g. BH-30643 ORR 45% in 40 patients, 2026).",
        notes: "Screen early: eligibility often requires measurable disease and adequate organ function.",
        url: "https://clinicaltrials.gov/",
      },
    ],
    notRecommended: [
      { regimen: "Continuing osimertinib alone", why: "Radiological progression with an on-target resistance mutation." },
      { regimen: "First- or second-generation EGFR inhibitor without testing T790M status", why: "Activity against C797S depends on whether T790M is in cis or trans; not established here." },
    ],
    testsToConsider: [
      { test: "Tissue re-biopsy of the new liver lesion", why: "Rules out transformation to small-cell histology and finds MET amplification that plasma can miss." },
      { test: "Repeat ECG with potassium and magnesium", why: "Patient takes two QT-prolonging drugs." },
    ],
  },
  KRAS_G12C_1L: {
    key: "KRAS_G12C_1L",
    title: "KRAS G12C NSCLC, treatment-naive, PD-L1 ≥ 50%",
    setting: "First line",
    driver: {
      gene: "KRAS",
      alteration: "G12C",
      meaning: "Oncogenic driver. KRAS G12C inhibitors are approved after at least one prior systemic therapy, not first line.",
    },
    options: [
      {
        id: "kras1-pembrolizumab",
        regimen: "Pembrolizumab monotherapy",
        drugs: ["pembrolizumab"],
        rank: 1,
        role: "preferred",
        basis: "PD-L1 TPS ≥ 50% without EGFR/ALK alteration: approved first-line monotherapy (KEYNOTE-024).",
        notes: "Flat dose per label; no calculation needed.",
        regimenKey: "pembrolizumab",
        url: FDA_APPROVALS_URL,
      },
      {
        id: "kras1-pembro-chemo",
        regimen: "Pembrolizumab + carboplatin + pemetrexed",
        drugs: ["pembrolizumab", "carboplatin", "pemetrexed"],
        rank: 2,
        role: "option",
        basis: "Approved first-line combination for non-squamous NSCLC (KEYNOTE-189).",
        notes: "Consider with high disease burden or visceral crisis.",
        regimenKey: "pembrolizumab-carboplatin-pemetrexed",
        url: FDA_APPROVALS_URL,
      },
      {
        id: "kras1-trial",
        regimen: "Clinical trial of a KRAS G12C inhibitor in first line",
        drugs: [],
        rank: 3,
        role: "trial",
        basis: "First-line KRAS G12C combinations are being tested in recruiting trials.",
        notes: "Check eligibility before starting standard therapy.",
        url: "https://clinicaltrials.gov/",
      },
      {
        id: "kras2-sotorasib-adagrasib",
        regimen: "Sotorasib or adagrasib (at progression)",
        drugs: ["sotorasib", "adagrasib"],
        rank: 4,
        role: "later-line",
        basis: "Approved after at least one prior systemic therapy (CodeBreaK 100, KRYSTAL-1).",
        notes: "Plan for second line.",
        url: FDA_APPROVALS_URL,
      },
    ],
    notRecommended: [
      { regimen: "KRAS G12C inhibitor as first line outside a trial", why: "Approved indication is after prior systemic therapy." },
    ],
    testsToConsider: [
      { test: "HbA1c and baseline thyroid function", why: "Diabetic patient starting a checkpoint inhibitor." },
    ],
  },
  ALK_1L: {
    key: "ALK_1L",
    title: "ALK-positive NSCLC, treatment-naive, brain metastases",
    setting: "First line",
    driver: {
      gene: "ALK",
      alteration: "EML4::ALK fusion",
      meaning: "Oncogenic driver; ALK inhibitors with central nervous system activity are standard first line.",
    },
    options: [
      {
        id: "alk1-alectinib",
        regimen: "Alectinib",
        drugs: ["alectinib"],
        rank: 1,
        role: "preferred",
        basis: "Approved first line (ALEX); intracranial activity.",
        notes: "Fixed oral dose per label; check liver tests and CK.",
        regimenKey: "alectinib",
        url: FDA_APPROVALS_URL,
      },
      {
        id: "alk1-lorlatinib",
        regimen: "Lorlatinib",
        drugs: ["lorlatinib"],
        rank: 2,
        role: "preferred",
        basis: "Approved first line (CROWN); strong intracranial activity.",
        notes: "Contraindicated with strong CYP3A inducers. Monitor lipids and mood.",
        regimenKey: "lorlatinib",
        url: FDA_APPROVALS_URL,
      },
      {
        id: "alk1-brigatinib",
        regimen: "Brigatinib",
        drugs: ["brigatinib"],
        rank: 3,
        role: "option",
        basis: "Approved first line (ALTA-1L); intracranial activity.",
        notes: "Avoid strong CYP3A inducers. Step-up dosing per label.",
        regimenKey: "brigatinib",
        url: FDA_APPROVALS_URL,
      },
    ],
    notRecommended: [
      { regimen: "Immunotherapy before an ALK inhibitor", why: "Driver-positive NSCLC benefits little from first-line checkpoint inhibitors." },
    ],
    testsToConsider: [
      { test: "Neurology review of the antiseizure drug", why: "Carbamazepine is a strong CYP3A inducer; a non-inducing alternative avoids ALK-inhibitor interactions." },
      { test: "Baseline lipids, liver tests and CK", why: "Monitoring required by ALK-inhibitor labels." },
    ],
  },
};

export interface InteractionRule {
  drug: string;
  medTag: string;
  severity: "contraindicated" | "avoid" | "monitor";
  message: string;
  source: string;
}

export const interactionRules: InteractionRule[] = [
  { drug: "osimertinib", medTag: "qt-prolonging", severity: "monitor", message: "Osimertinib can prolong QTc. With another QT-prolonging drug, check ECG and electrolytes periodically.", source: "Osimertinib label, QTc prolongation" },
  { drug: "osimertinib", medTag: "strong-cyp3a-inducer", severity: "avoid", message: "Avoid strong CYP3A inducers with osimertinib; the label gives a dose increase if unavoidable.", source: "Osimertinib label, drug interactions" },
  { drug: "lorlatinib", medTag: "strong-cyp3a-inducer", severity: "contraindicated", message: "Lorlatinib is contraindicated with strong CYP3A inducers (risk of serious liver toxicity).", source: "Lorlatinib label, contraindications" },
  { drug: "brigatinib", medTag: "strong-cyp3a-inducer", severity: "avoid", message: "Avoid strong CYP3A inducers with brigatinib (lower exposure).", source: "Brigatinib label, drug interactions" },
  { drug: "alectinib", medTag: "strong-cyp3a-inducer", severity: "monitor", message: "Check the alectinib label for CYP3A inducer guidance before co-prescribing; prefer a non-inducing antiseizure drug.", source: "Alectinib label, drug interactions" },
  { drug: "amivantamab", medTag: "qt-prolonging", severity: "monitor", message: "Not a known QT interaction; continue ECG monitoring while the other QT-prolonging drug is used.", source: "Amivantamab label" },
];
