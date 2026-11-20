import type { Patient } from "../types";

// Three fictional non-small-cell lung cancer cases. Names, dates and values are invented for demonstration.
// The NSCLC biomarker panel recommended before first-line treatment.
export const NSCLC_PANEL = ["EGFR", "ALK", "ROS1", "BRAF", "KRAS", "MET", "RET", "NTRK", "ERBB2", "PD-L1"];

export const patients: Patient[] = [
  {
    id: "P-001",
    displayName: "Rahela Khatun",
    age: 55,
    sex: "F",
    smoking: "Never smoked",
    diagnosis: "Non-small-cell lung cancer",
    histology: "Adenocarcinoma, right upper lobe",
    stage: "IVB (bone, mediastinal nodes)",
    ecog: 1,
    weightKg: 54,
    heightCm: 152,
    serumCreatinineMgDl: 0.8,
    creatinineDate: "2026-11-17",
    pdl1Tps: 10,
    variants: [
      { gene: "EGFR", alteration: "L858R", kind: "SNV", hgvsP: "p.Leu858Arg", vafPercent: 31, origin: "somatic", sample: "tissue", reportedOn: "2025-09-19", lab: "Molecular lab (NGS panel)" },
      { gene: "TP53", alteration: "R273H", kind: "SNV", hgvsP: "p.Arg273His", vafPercent: 28, origin: "somatic", sample: "tissue", reportedOn: "2025-09-19", lab: "Molecular lab (NGS panel)" },
      { gene: "EGFR", alteration: "C797S", kind: "SNV", hgvsP: "p.Cys797Ser", vafPercent: 1.2, origin: "somatic", sample: "plasma", reportedOn: "2026-11-17", lab: "Liquid biopsy (ctDNA)" },
    ],
    medications: [
      { name: "Osimertinib 80 mg daily", indication: "First-line EGFR TKI", tags: ["qt-prolonging"] },
      { name: "Citalopram 20 mg daily", indication: "Depression", tags: ["qt-prolonging"] },
    ],
    allergies: ["None known"],
    therapyLines: [
      { line: 1, regimen: "Osimertinib 80 mg once daily", start: "2025-09-24", end: "2026-11-16", bestResponse: "Partial response", stopReason: "Progression" },
    ],
    events: [
      { id: "e1", date: "2025-09-01", kind: "referral", title: "Referral received", detail: "Cough for 6 weeks, 5 kg weight loss in 3 months; chest X-ray shadow, right upper zone.", source: "GP referral letter" },
      { id: "e2", date: "2025-09-05", kind: "imaging", title: "Contrast CT chest and abdomen", detail: "3.4 cm right upper lobe mass, enlarged mediastinal nodes, lytic lesion T9.", source: "Radiology report" },
      { id: "e3", date: "2025-09-10", kind: "imaging", title: "Brain MRI", detail: "No intracranial metastases.", source: "Radiology report" },
      { id: "e4", date: "2025-09-15", kind: "pathology", title: "CT-guided biopsy", detail: "Adenocarcinoma, TTF-1 positive. PD-L1 TPS 10%.", source: "Pathology report" },
      { id: "e5", date: "2025-09-19", kind: "molecular", title: "Tissue NGS panel", detail: "EGFR L858R (VAF 31%), TP53 R273H (VAF 28%). ALK, ROS1, BRAF, KRAS, MET, RET, NTRK, ERBB2 negative.", source: "Molecular report" },
      { id: "e6", date: "2025-09-21", kind: "tumor-board", title: "Tumour board", detail: "Osimertinib chosen with the patient: preference, cost, distance from the centre.", source: "Tumour-board minutes" },
      { id: "e7", date: "2025-09-24", kind: "treatment", title: "Osimertinib started", detail: "Baseline ECG QTc 438 ms; potassium and magnesium normal.", source: "Prescription record" },
      { id: "e8", date: "2026-03-23", kind: "imaging", title: "CT restaging", detail: "Partial response; sum of target lesions 33 mm.", source: "Radiology report" },
      { id: "e9", date: "2026-09-21", kind: "lab", title: "ctDNA re-detected", detail: "EGFR L858R 0.3% after two undetectable results.", source: "Liquid biopsy report" },
      { id: "e10", date: "2026-11-16", kind: "imaging", title: "CT restaging", detail: "Target lesions 45 mm (nadir 32 mm); new 1.4 cm liver lesion.", source: "Radiology report" },
      { id: "e11", date: "2026-11-17", kind: "molecular", title: "Plasma NGS", detail: "EGFR L858R 2.1%, EGFR C797S 1.2%. No MET amplification detected in plasma.", source: "Liquid biopsy report" },
    ],
    recist: [
      { date: "2025-09-05", months: 0, sumMm: 62, newLesions: false, note: "Baseline" },
      { date: "2025-12-22", months: 3.5, sumMm: 38, newLesions: false },
      { date: "2026-03-23", months: 6.5, sumMm: 33, newLesions: false },
      { date: "2026-06-22", months: 9.5, sumMm: 32, newLesions: false },
      { date: "2026-09-21", months: 12.5, sumMm: 34, newLesions: false },
      { date: "2026-11-16", months: 14.4, sumMm: 45, newLesions: true, note: "New liver lesion" },
    ],
    ctdna: [
      { date: "2025-09-12", months: 0.2, vafPercent: 31, marker: "EGFR L858R" },
      { date: "2025-12-22", months: 3.5, vafPercent: 0.4, marker: "EGFR L858R" },
      { date: "2026-03-23", months: 6.5, vafPercent: null, marker: "EGFR L858R" },
      { date: "2026-06-22", months: 9.5, vafPercent: null, marker: "EGFR L858R" },
      { date: "2026-09-21", months: 12.5, vafPercent: 0.3, marker: "EGFR L858R" },
      { date: "2026-11-17", months: 14.4, vafPercent: 2.1, marker: "EGFR L858R" },
    ],
    question: "Progression on first-line osimertinib at month 14. Plasma NGS shows EGFR C797S. Propose next tests, next-line options, recruiting trials, safety checks and dosing.",
    status: "Progression · next line",
    biomarkerKey: "EGFR_POST_OSIMERTINIB",
    trialQuery: { condition: "non-small cell lung cancer", term: "EGFR C797S" },
  },
  {
    id: "P-002",
    displayName: "Karim Uddin",
    age: 61,
    sex: "M",
    smoking: "Former smoker, 30 pack-years, quit 2019",
    diagnosis: "Non-small-cell lung cancer",
    histology: "Adenocarcinoma, left lower lobe",
    stage: "IVB (liver, left adrenal)",
    ecog: 1,
    weightKg: 68,
    heightCm: 168,
    serumCreatinineMgDl: 1.1,
    creatinineDate: "2026-11-14",
    pdl1Tps: 60,
    variants: [
      { gene: "KRAS", alteration: "G12C", kind: "SNV", hgvsP: "p.Gly12Cys", vafPercent: 22, origin: "somatic", sample: "tissue", reportedOn: "2026-11-12", lab: "Molecular lab (NGS panel)" },
      { gene: "TP53", alteration: "R248Q", kind: "SNV", hgvsP: "p.Arg248Gln", vafPercent: 19, origin: "somatic", sample: "tissue", reportedOn: "2026-11-12", lab: "Molecular lab (NGS panel)" },
    ],
    medications: [
      { name: "Amlodipine 5 mg daily", indication: "Hypertension", tags: [] },
      { name: "Metformin 500 mg twice daily", indication: "Type 2 diabetes", tags: [] },
    ],
    allergies: ["None known"],
    therapyLines: [],
    events: [
      { id: "e1", date: "2026-10-20", kind: "referral", title: "Referral received", detail: "Right upper abdominal pain, weight loss; ultrasound shows liver lesions.", source: "Referral letter" },
      { id: "e2", date: "2026-10-28", kind: "imaging", title: "Contrast CT chest and abdomen", detail: "4.1 cm left lower lobe mass, two liver lesions, 2.2 cm left adrenal lesion.", source: "Radiology report" },
      { id: "e3", date: "2026-11-05", kind: "imaging", title: "Brain MRI", detail: "No intracranial metastases.", source: "Radiology report" },
      { id: "e4", date: "2026-11-06", kind: "pathology", title: "Liver biopsy", detail: "Metastatic adenocarcinoma, lung primary (TTF-1 positive).", source: "Pathology report" },
      { id: "e5", date: "2026-11-08", kind: "pathology", title: "PD-L1 (22C3)", detail: "Tumour proportion score 60%.", source: "Pathology report" },
      { id: "e6", date: "2026-11-12", kind: "molecular", title: "Tissue NGS panel", detail: "KRAS G12C (VAF 22%), TP53 R248Q. EGFR, ALK, ROS1, BRAF, MET, RET, NTRK, ERBB2 negative. STK11 and KEAP1 wild-type.", source: "Molecular report" },
    ],
    recist: [{ date: "2026-10-28", months: 0, sumMm: 71, newLesions: false, note: "Baseline" }],
    ctdna: [{ date: "2026-11-10", months: 0.4, vafPercent: 4.6, marker: "KRAS G12C" }],
    question: "New diagnosis, treatment-naive. KRAS G12C with PD-L1 60%. Propose first-line options, recruiting trials, safety checks and dosing.",
    status: "New diagnosis · first line",
    biomarkerKey: "KRAS_G12C_1L",
    trialQuery: { condition: "non-small cell lung cancer", term: "KRAS G12C" },
  },
  {
    id: "P-003",
    displayName: "Nasrin Akter",
    age: 45,
    sex: "F",
    smoking: "Never smoked",
    diagnosis: "Non-small-cell lung cancer",
    histology: "Adenocarcinoma, right middle lobe",
    stage: "IVB (brain, pleura)",
    ecog: 1,
    weightKg: 58,
    heightCm: 156,
    serumCreatinineMgDl: 0.7,
    creatinineDate: "2026-11-15",
    pdl1Tps: 5,
    variants: [
      { gene: "ALK", alteration: "EML4::ALK", kind: "fusion", vafPercent: undefined, origin: "somatic", sample: "tissue", reportedOn: "2026-11-11", lab: "Molecular lab (RNA fusion panel)" },
    ],
    medications: [
      { name: "Carbamazepine 200 mg twice daily", indication: "Seizure after brain metastases (started in emergency department)", tags: ["strong-cyp3a-inducer"] },
      { name: "Dexamethasone 4 mg daily", indication: "Peritumoral oedema", tags: [] },
    ],
    allergies: ["Penicillin (rash)"],
    therapyLines: [],
    events: [
      { id: "e1", date: "2026-10-25", kind: "symptom", title: "Seizure", detail: "First generalised seizure; carbamazepine started in the emergency department.", source: "Emergency department note" },
      { id: "e2", date: "2026-10-27", kind: "imaging", title: "Brain MRI", detail: "Three metastases, largest 9 mm, mild oedema; no midline shift.", source: "Radiology report" },
      { id: "e3", date: "2026-10-30", kind: "imaging", title: "Contrast CT chest and abdomen", detail: "2.9 cm right middle lobe mass, small right pleural effusion.", source: "Radiology report" },
      { id: "e4", date: "2026-11-04", kind: "pathology", title: "Bronchoscopic biopsy", detail: "Adenocarcinoma, TTF-1 positive. PD-L1 TPS 5%.", source: "Pathology report" },
      { id: "e5", date: "2026-11-11", kind: "molecular", title: "DNA + RNA panel", detail: "EML4::ALK fusion. EGFR, ROS1, BRAF, KRAS, MET, RET, NTRK, ERBB2 negative.", source: "Molecular report" },
    ],
    recist: [{ date: "2026-10-30", months: 0, sumMm: 54, newLesions: false, note: "Baseline" }],
    ctdna: [],
    question: "Treatment-naive ALK-positive NSCLC with brain metastases, taking carbamazepine. Propose first-line ALK inhibitor options with an interaction check, trials and dosing.",
    status: "New diagnosis · first line",
    biomarkerKey: "ALK_1L",
    trialQuery: { condition: "non-small cell lung cancer", term: "ALK" },
  },
];

export function getPatient(id: string): Patient | undefined {
  return patients.find((p) => p.id === id);
}

/** Genes on the panel that this patient was tested for (from the molecular events). */
export function testedGenes(p: Patient): string[] {
  const text = p.events.filter((e) => e.kind === "molecular" || e.kind === "pathology").map((e) => e.detail).join(" ");
  return NSCLC_PANEL.filter((g) => (g === "PD-L1" ? p.pdl1Tps !== undefined : text.includes(g) || p.variants.some((v) => v.gene === g)));
}
