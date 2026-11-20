import { describe, expect, it } from "vitest";
import { knowledge, interactionRules } from "../data/knowledge";
import { regimens } from "../data/regimens";
import { MEDICATION_CATALOGUE, tagsFor } from "../data/medications";
import { getPatient } from "../data/patients";
import { bandLabel, buildDoseCard, perKgDose, pickWeightBand } from "./dose";
import { selectKnowledgeKey } from "./select";
import { EvidenceRegistry, guideline } from "../agents/rules";
import { criticCheck } from "../agents/critic";
import type { KnowledgeSelectionInput, Patient } from "../types";

type V = KnowledgeSelectionInput["variants"][number];
const v = (gene: string, alteration: string, kind: V["kind"] = "SNV", sample: V["sample"] = "tissue"): V => ({ gene, alteration, kind, sample });
const sel = (p: Partial<KnowledgeSelectionInput>) =>
  selectKnowledgeKey({ variants: [], priorRegimens: [], progressedOnCurrentLine: false, histology: "adenocarcinoma", ...p });

const ORIGINAL_KEYS = ["EGFR_POST_OSIMERTINIB", "KRAS_G12C_1L", "ALK_1L"];
const GENERIC_KEYS = Object.keys(knowledge).filter((k) => !ORIGINAL_KEYS.includes(k));

/** A synthetic adult used for dose maths (not a real patient). */
function synthetic(weightKg: number, extra: Partial<Patient> = {}): Patient {
  return { ...getPatient("P-002")!, id: "SYN", weightKg, heightCm: 165, age: 60, sex: "M", serumCreatinineMgDl: 0.9, creatinineDate: "2026-11-18", medications: [], ...extra };
}

describe("knowledge selection: one case per entry", () => {
  const cases: [string, Partial<KnowledgeSelectionInput>, string][] = [
    ["EGFR_COMMON_1L", { variants: [v("EGFR", "L858R"), v("TP53", "R273H")] }, "EGFR"],
    ["EGFR_EX20_1L", { variants: [v("EGFR", "Exon 20 Insertion", "indel")] }, "EGFR exon 20 insertion"],
    ["EGFR_PROGRESSION", { variants: [v("EGFR", "Exon 19 Deletion", "indel"), v("EGFR", "C797S", "SNV", "plasma")], priorRegimens: ["Osimertinib 80 mg daily"], progressedOnCurrentLine: true }, "EGFR C797S"],
    ["ALK_1L_STD", { variants: [v("ALK", "EML4::ALK", "fusion")] }, "ALK"],
    ["ROS1_1L", { variants: [v("ROS1", "CD74::ROS1", "fusion")] }, "ROS1"],
    ["BRAF_V600E_1L", { variants: [v("BRAF", "V600E")] }, "BRAF V600E"],
    ["MET_EX14_1L", { variants: [v("MET", "Exon 14 Skipping Mutation", "indel")] }, "MET exon 14"],
    ["RET_1L", { variants: [v("RET", "KIF5B::RET", "fusion")] }, "RET fusion"],
    ["NTRK_1L", { variants: [v("NTRK1", "Fusion", "fusion")] }, "NTRK fusion"],
    ["KRAS_G12C_POST", { variants: [v("KRAS", "G12C")], priorRegimens: ["Carboplatin + pemetrexed + pembrolizumab"], progressedOnCurrentLine: true, pdl1Tps: 30 }, "KRAS G12C"],
    ["ERBB2_MUT_1L", { variants: [v("HER2", "Exon 20 Insertion", "indel")] }, "HER2 mutation"],
    ["ERBB2_MUT_POST", { variants: [v("ERBB2", "Y772_A775dup", "indel")], priorRegimens: ["Carboplatin + pemetrexed + pembrolizumab"], progressedOnCurrentLine: true }, "HER2 mutation"],
    ["NO_DRIVER_PDL1_HIGH", { variants: [v("TP53", "R175H"), v("STK11", "Q37*"), v("KEAP1", "G333C")], pdl1Tps: 80 }, "non-small cell lung cancer PD-L1"],
    ["NO_DRIVER_NONSQ", { variants: [v("TP53", "R248Q")], pdl1Tps: 10 }, "non-small cell lung cancer PD-L1"],
    ["NO_DRIVER_SQ", { histology: "squamous", pdl1Tps: 20, variants: [v("TP53", "R273C")] }, "squamous non-small cell lung cancer"],
    ["SECOND_LINE_NO_DRIVER", { pdl1Tps: 5, priorRegimens: ["Carboplatin + paclitaxel + pembrolizumab x4, then pembrolizumab"], progressedOnCurrentLine: true }, "previously treated"],
    ["SECOND_LINE_IO_NAIVE", { histology: "squamous", priorRegimens: ["Cisplatin + gemcitabine"], progressedOnCurrentLine: true }, "previously treated"],
  ];
  for (const [key, input, term] of cases) {
    it(`selects ${key}`, () => {
      const r = sel(input);
      expect(r.key).toBe(key);
      expect(r.trialTerm).toBe(term);
      expect(r.reason.length).toBeGreaterThan(20);
      expect(knowledge[r.key!]).toBeDefined();
    });
  }

  it("covers every generic entry with at least one selection case", () => {
    expect(new Set(cases.map((c) => c[0]))).toEqual(new Set(GENERIC_KEYS));
  });

  it("never selects the three patient-specific demo entries", () => {
    for (const [, input] of cases) expect(ORIGINAL_KEYS).not.toContain(sel(input).key);
  });
});

describe("knowledge selection: rules and edge cases", () => {
  it("is tolerant of case, three-letter protein notation and HGVS", () => {
    expect(sel({ variants: [v("egfr", "l858r")] }).key).toBe("EGFR_COMMON_1L");
    expect(sel({ variants: [v("EGFR", "p.Glu746_Ala750del", "indel")] }).key).toBe("EGFR_COMMON_1L");
    expect(sel({ variants: [v("EGFR", "D770_N771insSVD", "indel")] }).key).toBe("EGFR_EX20_1L");
    expect(sel({ variants: [v("kras", "p.Gly12Cys")], priorRegimens: ["docetaxel"], progressedOnCurrentLine: true }).key).toBe("KRAS_G12C_POST");
    expect(sel({ variants: [v("braf", "Val600Glu")] }).key).toBe("BRAF_V600E_1L");
    expect(sel({ variants: [v("EML4", "EML4-ALK fusion", "fusion")] }).key).toBe("ALK_1L_STD");
    expect(sel({ variants: [v("NTRK3", "ETV6::NTRK3", "fusion")] }).key).toBe("NTRK_1L");
  });

  it("applies driver precedence and reports the other driver", () => {
    const r = sel({ variants: [v("KRAS", "G12C"), v("EGFR", "L858R")] });
    expect(r.key).toBe("EGFR_COMMON_1L");
    expect(r.reason).toMatch(/Additional driver/);
    expect(r.reason).toMatch(/KRAS G12C/);
  });

  it("treats co-mutations as non-drivers", () => {
    const r = sel({ variants: [v("STK11", "Q37*"), v("KEAP1", "G333C"), v("TP53", "R175H")], pdl1Tps: 5 });
    expect(r.key).toBe("NO_DRIVER_NONSQ");
    expect(r.reason).toMatch(/Co-mutation/);
  });

  it("routes untreated KRAS G12C to the driver-negative first-line entries by PD-L1", () => {
    const high = sel({ variants: [v("KRAS", "G12C")], pdl1Tps: 60 });
    expect(high.key).toBe("NO_DRIVER_PDL1_HIGH");
    expect(high.trialTerm).toBe("KRAS G12C");
    expect(high.reason).toMatch(/after prior systemic therapy/);
    expect(sel({ variants: [v("KRAS", "G12C")], pdl1Tps: 10, histology: "squamous" }).key).toBe("NO_DRIVER_SQ");
  });

  it("routes untreated squamous HER2-mutant NSCLC to the driver-negative pathway", () => {
    expect(sel({ variants: [v("ERBB2", "S310F")], histology: "squamous", pdl1Tps: 10 }).key).toBe("NO_DRIVER_SQ");
  });

  it("keeps a working current line: no progression means the last regimen has not failed", () => {
    const r = sel({ variants: [v("EGFR", "L858R")], priorRegimens: ["Osimertinib"], progressedOnCurrentLine: false });
    expect(r.key).toBe("EGFR_COMMON_1L");
    expect(r.reason).toMatch(/current line/);
    expect(sel({ variants: [v("KRAS", "G12C")], priorRegimens: ["Carboplatin + pemetrexed + pembrolizumab"], pdl1Tps: 10 }).key).toBe("NO_DRIVER_NONSQ");
    expect(sel({ variants: [v("EGFR", "L858R")], priorRegimens: ["Osimertinib", "Amivantamab + carboplatin + pemetrexed"] }).key).toBe("EGFR_PROGRESSION");
  });

  it("does not count radiotherapy or surgery as a systemic line", () => {
    const r = sel({ variants: [v("ALK", "Fusion", "fusion")], priorRegimens: ["SBRT to adrenal metastasis", "Right upper lobectomy"], progressedOnCurrentLine: true });
    expect(r.key).toBe("ALK_1L_STD");
    expect(r.reason).toMatch(/Not counted as systemic/);
  });

  it("keeps targeted therapy available after chemotherapy alone", () => {
    expect(sel({ variants: [v("ROS1", "Fusion", "fusion")], priorRegimens: ["Carboplatin + pemetrexed"], progressedOnCurrentLine: true }).key).toBe("ROS1_1L");
    expect(sel({ variants: [v("EGFR", "Exon 19 Deletion", "indel")], priorRegimens: ["Carboplatin + pemetrexed"], progressedOnCurrentLine: true }).key).toBe("EGFR_COMMON_1L");
  });

  it("uses PD-L1 ≥ 50% ahead of histology and flags a missing PD-L1", () => {
    expect(sel({ histology: "squamous", pdl1Tps: 50 }).key).toBe("NO_DRIVER_PDL1_HIGH");
    const r = sel({ histology: "nsclc-nos" });
    expect(r.key).toBe("NO_DRIVER_NONSQ");
    expect(r.reason).toMatch(/PD-L1 not reported/);
    expect(r.reason).toMatch(/No variants were entered/);
  });

  it("does not treat MET amplification, non-V600 BRAF or HER2 amplification as drivers", () => {
    expect(sel({ variants: [v("MET", "Amplification", "CNV")], pdl1Tps: 5 }).key).toBe("NO_DRIVER_NONSQ");
    expect(sel({ variants: [v("BRAF", "G469A")], pdl1Tps: 5 }).key).toBe("NO_DRIVER_NONSQ");
    expect(sel({ variants: [v("ERBB2", "Amplification", "CNV")], pdl1Tps: 5 }).key).toBe("NO_DRIVER_NONSQ");
  });

  const nulls: [string, Partial<KnowledgeSelectionInput>, RegExp][] = [
    ["ALK after progression on alectinib", { variants: [v("ALK", "EML4::ALK", "fusion")], priorRegimens: ["Alectinib 600 mg BD"], progressedOnCurrentLine: true }, /ALK inhibitor/],
    ["EGFR after a first-generation inhibitor", { variants: [v("EGFR", "L858R")], priorRegimens: ["Gefitinib"], progressedOnCurrentLine: true }, /T790M/],
    ["EGFR after osimertinib plus platinum (FLAURA2-style)", { variants: [v("EGFR", "L858R")], priorRegimens: ["Osimertinib + carboplatin + pemetrexed"], progressedOnCurrentLine: true }, /platinum/],
    ["EGFR after amivantamab", { variants: [v("EGFR", "L858R")], priorRegimens: ["Amivantamab + lazertinib"], progressedOnCurrentLine: true }, /amivantamab/],
    ["uncommon EGFR mutation", { variants: [v("EGFR", "G719A")] }, /uncommon EGFR/],
    ["EGFR exon 20 after platinum", { variants: [v("EGFR", "Exon 20 Insertion", "indel")], priorRegimens: ["Carboplatin + pemetrexed"], progressedOnCurrentLine: true }, /sunvozertinib/],
    ["KRAS G12C after sotorasib", { variants: [v("KRAS", "G12C")], priorRegimens: ["Carboplatin + pemetrexed + pembrolizumab", "Sotorasib"], progressedOnCurrentLine: true }, /G12C inhibitor/],
    ["HER2 after trastuzumab deruxtecan", { variants: [v("ERBB2", "Exon 20 Insertion", "indel")], priorRegimens: ["Carboplatin + pemetrexed", "Trastuzumab deruxtecan"], progressedOnCurrentLine: true }, /trastuzumab deruxtecan/],
    ["no driver after docetaxel", { priorRegimens: ["Carboplatin + pemetrexed + pembrolizumab", "Docetaxel"], progressedOnCurrentLine: true }, /docetaxel/],
    ["no driver after first-line immunotherapy alone", { pdl1Tps: 90, priorRegimens: ["Pembrolizumab"], progressedOnCurrentLine: true }, /immunotherapy without platinum/],
    ["targeted drug in the history but no driver entered", { priorRegimens: ["Osimertinib"], progressedOnCurrentLine: true }, /no matching driver/],
  ];
  for (const [name, input, re] of nulls) {
    it(`returns null with a reason: ${name}`, () => {
      const r = sel(input);
      expect(r.key).toBeNull();
      expect(r.reason).toMatch(/Not covered by the knowledge pack/);
      expect(r.reason).toMatch(re);
      expect(r.trialTerm.length).toBeGreaterThan(2);
    });
  }
});

describe("knowledge pack integrity", () => {
  const options = Object.values(knowledge).flatMap((k) => k.options.map((o) => ({ k, o })));

  it("every regimenKey exists in regimens", () => {
    const missing = options.filter(({ o }) => o.regimenKey && !regimens[o.regimenKey]).map(({ o }) => `${o.id} → ${o.regimenKey}`);
    expect(missing).toEqual([]);
  });

  it("every option has a non-empty basis and an http(s) url", () => {
    for (const { o } of options) {
      expect(o.basis.trim().length, o.id).toBeGreaterThan(10);
      expect(o.url, o.id).toMatch(/^https:\/\//);
    }
  });

  it("option ids are unique and entry keys match their record keys", () => {
    const ids = options.map(({ o }) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [key, entry] of Object.entries(knowledge)) expect(entry.key).toBe(key);
  });

  it("every entry has a current (non-later-line) option and later-line drugs never overlap current drugs", () => {
    for (const entry of Object.values(knowledge)) {
      const current = entry.options.filter((o) => o.role !== "later-line");
      expect(current.length, entry.key).toBeGreaterThan(0);
      const currentDrugs = new Set(current.flatMap((o) => o.drugs));
      const overlap = entry.options.filter((o) => o.role === "later-line").flatMap((o) => o.drugs).filter((d) => currentDrugs.has(d));
      expect(overlap, entry.key).toEqual([]);
    }
  });

  it("drug names are lower-case INN names (the safety-critic matches them in text)", () => {
    for (const { o } of options) for (const d of o.drugs) expect(d, o.id).toMatch(/^[a-z][a-z -]+$/);
  });

  it("generic entries carry no patient-specific text", () => {
    for (const key of GENERIC_KEYS) {
      const e = knowledge[key];
      const text = JSON.stringify([e.title, e.setting, e.testsToConsider, e.notRecommended]);
      expect(text, key).not.toMatch(/the patient|patient takes|diabetic patient|new liver lesion|this patient/i);
    }
  });

  it("the leading dose-calculable option of every generic entry builds a dose card", () => {
    const p = synthetic(62);
    for (const key of GENERIC_KEYS) {
      const opt = knowledge[key].options.filter((o) => o.regimenKey && o.role !== "later-line").sort((a, b) => a.rank - b.rank)[0];
      expect(opt, key).toBeDefined();
      const card = buildDoseCard(p, opt.regimenKey!, "2026-11-20");
      expect(card.lines.every((l) => l.text && l.text !== "See label"), key).toBe(true);
    }
  });

  it("the Guideline card for every generic entry passes the safety-critic", () => {
    for (const key of GENERIC_KEYS) {
      const p = { ...synthetic(62), biomarkerKey: key };
      const reg = new EvidenceRegistry();
      const card = guideline(p, knowledge[key], reg);
      const checked = criticCheck(card, reg, { biomarkerKey: key, knownTrials: new Set(), contraindicated: new Set() });
      expect(checked.critic.notes, key).toEqual([]);
    }
  });
});

describe("interaction rules and medication catalogue", () => {
  const catalogueTags = new Set(MEDICATION_CATALOGUE.flatMap((m) => m.tags));
  const packDrugs = new Set(Object.values(knowledge).flatMap((k) => k.options.flatMap((o) => o.drugs)));

  it("every interaction rule's tag exists in the catalogue", () => {
    for (const r of interactionRules) expect(catalogueTags.has(r.medTag), `${r.drug} + ${r.medTag}`).toBe(true);
  });

  it("every interaction rule names a drug in the pack, a valid severity and a source", () => {
    for (const r of interactionRules) {
      expect(packDrugs.has(r.drug), r.drug).toBe(true);
      expect(["contraindicated", "avoid", "monitor"]).toContain(r.severity);
      expect(r.source).toMatch(/label/i);
      expect(r.message.length).toBeGreaterThan(20);
    }
  });

  it("has no duplicate drug + tag rules", () => {
    const pairs = interactionRules.map((r) => `${r.drug}|${r.medTag}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it("keeps lorlatinib as the only contraindication with strong CYP3A inducers (gold case P-003)", () => {
    expect(interactionRules.filter((r) => r.severity === "contraindicated").map((r) => `${r.drug}|${r.medTag}`)).toEqual(["lorlatinib|strong-cyp3a-inducer"]);
  });

  it("uses only the five interaction tags and unique catalogue names", () => {
    expect(Array.from(catalogueTags).sort()).toEqual(["acid-reducing", "nsaid", "qt-prolonging", "strong-cyp3a-inducer", "strong-cyp3a-inhibitor"]);
    const names = MEDICATION_CATALOGUE.map((m) => m.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it("tagsFor matches whole names, aliases and is case-insensitive", () => {
    expect(tagsFor("Omeprazole 20 mg daily")).toEqual(["acid-reducing"]);
    expect(tagsFor("ESOMEPRAZOLE 40 mg")).toEqual(["acid-reducing"]);
    expect(tagsFor("Escitalopram 10 mg")).toEqual(["qt-prolonging"]);
    expect(tagsFor("Clarithromycin 500 mg BD").sort()).toEqual(["qt-prolonging", "strong-cyp3a-inhibitor"]);
    expect(tagsFor("Rifampin")).toEqual(["strong-cyp3a-inducer"]);
    expect(tagsFor("Lopinavir/ritonavir")).toEqual(["strong-cyp3a-inhibitor"]);
    expect(tagsFor("St. John's wort")).toEqual(["strong-cyp3a-inducer"]);
    expect(tagsFor("Ibuprofen 400 mg PRN")).toEqual(["nsaid"]);
    expect(tagsFor("Carbamazepine 200 mg twice daily")).toEqual(["strong-cyp3a-inducer"]);
    expect(tagsFor("Metformin 500 mg")).toEqual([]);
    expect(tagsFor("Aspirin 75 mg")).toEqual([]);
    expect(tagsFor("Something unknown")).toEqual([]);
  });
});

describe("weight-band and per-kg dosing", () => {
  it("selpercatinib switches band at 50 kg", () => {
    const at49 = buildDoseCard(synthetic(49), "selpercatinib", "2026-11-20").lines[0];
    const at50 = buildDoseCard(synthetic(50), "selpercatinib", "2026-11-20").lines[0];
    expect(at49.text).toBe("120 mg orally twice daily");
    expect(at50.text).toBe("160 mg orally twice daily");
    expect(at49.method).toBe("Weight band");
    expect(at49.formula).toBe("Weight-band rule: < 50 kg → 120 mg orally twice daily; ≥ 50 kg → 160 mg orally twice daily");
    expect(at50.inputs).toContain("Band applied: ≥ 50 kg");
  });

  it("trastuzumab deruxtecan 5.4 mg/kg × 62 kg = 334.8 mg, shown as 335 mg", () => {
    const line = buildDoseCard(synthetic(62), "trastuzumab-deruxtecan", "2026-11-20").lines[0];
    expect(line.raw).toBeCloseTo(334.8, 6);
    expect(line.rounded).toBe(335);
    expect(line.text).toBe("335 mg");
    expect(line.formula).toBe("Dose = 5.4 mg/kg × 62 kg");
  });

  it("ramucirumab 10 mg/kg is calculated alongside BSA-dosed docetaxel", () => {
    const card = buildDoseCard(synthetic(62), "docetaxel-ramucirumab", "2026-11-20");
    expect(card.lines[0].text).toBe("620 mg");
    expect(card.lines[1].method).toBe("Body surface area");
  });

  it("amivantamab and zongertinib bands switch at their label thresholds", () => {
    const below = buildDoseCard(synthetic(79.9), "amivantamab-carboplatin-pemetrexed", "2026-11-20").lines[0].text;
    const at80 = buildDoseCard(synthetic(80), "amivantamab-carboplatin-pemetrexed", "2026-11-20").lines[0].text;
    expect(below).toMatch(/^1,400 mg/);
    expect(at80).toMatch(/^1,750 mg/);
    expect(buildDoseCard(synthetic(80), "lazertinib-amivantamab", "2026-11-20").lines[1].text).toMatch(/^1,400 mg/);
    expect(buildDoseCard(synthetic(89), "zongertinib", "2026-11-20").lines[0].text).toBe("120 mg orally once daily");
    expect(buildDoseCard(synthetic(90), "zongertinib", "2026-11-20").lines[0].text).toBe("180 mg orally once daily");
  });

  it("band helpers handle three bands and open-ended limits", () => {
    const bands = [{ maxKgExclusive: 50, dose: "A" }, { maxKgExclusive: 80, dose: "B" }, { dose: "C" }];
    expect(pickWeightBand(bands, 49.9)).toBe(0);
    expect(pickWeightBand(bands, 50)).toBe(1);
    expect(pickWeightBand(bands, 120)).toBe(2);
    expect(bandLabel(bands, 1)).toBe("50 to < 80 kg");
    expect(() => pickWeightBand([], 60)).toThrow();
    expect(perKgDose(10, 55.5)).toEqual({ raw: 555, rounded: 555 });
    expect(() => perKgDose(5.4, 0)).toThrow();
  });

  it("renal and freshness blocks still apply to the new regimens", () => {
    const lowCrcl = buildDoseCard(synthetic(62, { serumCreatinineMgDl: 2.6 }), "amivantamab-carboplatin-pemetrexed", "2026-11-20");
    expect(lowCrcl.blocks.join(" ")).toMatch(/below 45/);
    const stale = buildDoseCard(synthetic(62, { creatinineDate: "2026-10-01" }), "pembrolizumab-carboplatin-paclitaxel", "2026-11-20");
    expect(stale.blocks.join(" ")).toMatch(/days old/);
    // Oral targeted drugs without a renal rule are not blocked by an old creatinine.
    expect(buildDoseCard(synthetic(62, { creatinineDate: "2026-10-01" }), "selpercatinib", "2026-11-20").blocks).toEqual([]);
  });

  it("paclitaxel regimen uses carboplatin AUC 6 and lists the paclitaxel premedication", () => {
    const card = buildDoseCard(synthetic(62), "pembrolizumab-carboplatin-paclitaxel", "2026-11-20");
    expect(card.lines[1].formula).toMatch(/^Dose = AUC × \(GFR \+ 25\) = 6 ×/);
    expect(card.premedication.join(" ")).toMatch(/Dexamethasone 20 mg/);
    expect(card.premedication.join(" ")).toMatch(/Diphenhydramine/);
  });
});

describe("original demo entries are unchanged", () => {
  const shape = (key: string) =>
    knowledge[key].options.map((o) => ({ id: o.id, rank: o.rank, role: o.role, drugs: o.drugs, regimenKey: o.regimenKey }));

  it("EGFR_POST_OSIMERTINIB", () => {
    const e = knowledge.EGFR_POST_OSIMERTINIB;
    expect(e.driver.alteration).toBe("L858R with acquired C797S");
    expect(shape("EGFR_POST_OSIMERTINIB")).toEqual([
      { id: "egfr2-amivantamab-chemo", rank: 1, role: "preferred", drugs: ["amivantamab", "carboplatin", "pemetrexed"], regimenKey: "carboplatin-pemetrexed" },
      { id: "egfr2-platinum-pemetrexed", rank: 2, role: "option", drugs: ["carboplatin", "pemetrexed"], regimenKey: "carboplatin-pemetrexed" },
      { id: "egfr2-trial", rank: 3, role: "trial", drugs: [], regimenKey: undefined },
    ]);
    expect(e.testsToConsider.map((t) => t.test)).toEqual(["Tissue re-biopsy of the new liver lesion", "Repeat ECG with potassium and magnesium"]);
  });

  it("KRAS_G12C_1L", () => {
    const e = knowledge.KRAS_G12C_1L;
    expect(e.driver.alteration).toBe("G12C");
    expect(shape("KRAS_G12C_1L")).toEqual([
      { id: "kras1-pembrolizumab", rank: 1, role: "preferred", drugs: ["pembrolizumab"], regimenKey: "pembrolizumab" },
      { id: "kras1-pembro-chemo", rank: 2, role: "option", drugs: ["pembrolizumab", "carboplatin", "pemetrexed"], regimenKey: "pembrolizumab-carboplatin-pemetrexed" },
      { id: "kras1-trial", rank: 3, role: "trial", drugs: [], regimenKey: undefined },
      { id: "kras2-sotorasib-adagrasib", rank: 4, role: "later-line", drugs: ["sotorasib", "adagrasib"], regimenKey: undefined },
    ]);
    expect(e.testsToConsider.map((t) => t.test)).toEqual(["HbA1c and baseline thyroid function"]);
  });

  it("ALK_1L", () => {
    const e = knowledge.ALK_1L;
    expect(e.driver.alteration).toBe("EML4::ALK fusion");
    expect(shape("ALK_1L")).toEqual([
      { id: "alk1-alectinib", rank: 1, role: "preferred", drugs: ["alectinib"], regimenKey: "alectinib" },
      { id: "alk1-lorlatinib", rank: 2, role: "preferred", drugs: ["lorlatinib"], regimenKey: "lorlatinib" },
      { id: "alk1-brigatinib", rank: 3, role: "option", drugs: ["brigatinib"], regimenKey: "brigatinib" },
    ]);
    expect(e.testsToConsider.map((t) => t.test)).toEqual(["Neurology review of the antiseizure drug", "Baseline lipids, liver tests and CK"]);
  });

  it("the original regimens keep their parameters", () => {
    const params = (key: string) => regimens[key].components.map((c) => [c.drug, c.method, c.targetAuc ?? c.mgPerM2 ?? c.flatDose]);
    expect(params("carboplatin-pemetrexed")).toEqual([["Carboplatin", "calvert", 5], ["Pemetrexed", "bsa", 500]]);
    expect(params("pembrolizumab")).toEqual([["Pembrolizumab", "flat", "200 mg every 3 weeks or 400 mg every 6 weeks"]]);
    expect(params("pembrolizumab-carboplatin-pemetrexed")).toEqual([["Pembrolizumab", "flat", "200 mg every 3 weeks"], ["Carboplatin", "calvert", 5], ["Pemetrexed", "bsa", 500]]);
    expect(params("alectinib")).toEqual([["Alectinib", "flat", "600 mg orally twice daily with food"]]);
    expect(params("lorlatinib")).toEqual([["Lorlatinib", "flat", "100 mg orally once daily"]]);
    expect(params("brigatinib")).toEqual([["Brigatinib", "flat", "90 mg once daily for 7 days, then 180 mg once daily"]]);
  });
});
