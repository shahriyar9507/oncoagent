import { describe, expect, it } from "vitest";
import { extractReport, normaliseGene, threeToOne } from "./extract";
import type { ReportExtraction } from "../types";

// All report texts below are fictional and written for these tests.

const alts = (r: ReportExtraction) => r.variants.map((v) => `${v.gene} ${v.alteration}`);
const find = (r: ReportExtraction, gene: string, alteration: string) => r.variants.find((v) => v.gene === gene && v.alteration === alteration);
const hasWarning = (r: ReportExtraction, re: RegExp) => r.warnings.some((w) => re.test(w));

const TISSUE_NGS = `MOLECULAR PATHOLOGY REPORT (fictional patient)
Specimen: FFPE tissue block, right upper lobe core biopsy
Tumour content: 40%
Test: Targeted NGS panel (DNA + RNA), 52 genes

RESULTS – Clinically significant variants
Gene | Variant | Exon | VAF
EGFR | p.Leu858Arg (c.2573T>G) | 21 | 31.2%
TP53 | p.Arg273His | 8 | 28%

Variants of uncertain significance
ATM | p.Val2424Gly | 49 | 12%

Pertinent negatives: ALK, ROS1, RET, NTRK1/2/3 fusions not detected; KRAS, BRAF wild-type; no MET exon 14 skipping or MET amplification.

PD-L1 (22C3) TPS: 10%`;

const PLASMA_NGS = `LIQUID BIOPSY REPORT — cfDNA NGS (fictional patient)
Sample: plasma (Streck tube), collected 2026-11-10
Indication: progression on osimertinib

Detected alterations:
• EGFR exon 19 deletion (p.E746_A750del) — VAF 4.8%
• EGFR C797S (c.2390G>C) — VAF 0.4%
• TP53 R248Q, allele frequency 1.2%
Not detected: MET amplification, ALK fusion, EGFR T790M.
Comment: C797S confers resistance to osimertinib; tissue biopsy may be considered.`;

const ALK_FISH_IHC = `Pathology addendum — biomarkers (fictional patient)
Specimen: EBUS-TBNA cell block, station 7 lymph node
ALK (D5F3) IHC: POSITIVE (strong granular cytoplasmic staining)
ALK break-apart FISH: positive, 62% of 100 nuclei with split signals
ROS1 FISH: negative
EGFR (real-time PCR): no mutation detected
PD-L1 22C3: TPS 70%`;

describe("normaliseGene", () => {
  it("maps aliases, trims and ignores case", () => {
    expect(normaliseGene("HER2")).toBe("ERBB2");
    expect(normaliseGene(" her2/neu ")).toBe("ERBB2");
    expect(normaliseGene("c-MET")).toBe("MET");
    expect(normaliseGene("cMet")).toBe("MET");
    expect(normaliseGene("egfr")).toBe("EGFR");
    expect(normaliseGene("ROS-1")).toBe("ROS1");
    expect(normaliseGene("LKB1")).toBe("STK11");
    expect(normaliseGene("atm")).toBe("ATM");
  });
});

describe("threeToOne", () => {
  it("converts 3-letter HGVS to 1-letter names", () => {
    expect(threeToOne("p.Leu858Arg")).toBe("L858R");
    expect(threeToOne("p.Gly12Cys")).toBe("G12C");
    expect(threeToOne("p.Val600Glu")).toBe("V600E");
    expect(threeToOne("p.(Leu858Arg)")).toBe("L858R");
    expect(threeToOne("Cys797Ser")).toBe("C797S");
  });

  it("handles stop codons, deletions, duplications, insertions and frameshifts", () => {
    expect(threeToOne("p.Arg213Ter")).toBe("R213*");
    expect(threeToOne("p.Arg213*")).toBe("R213*");
    expect(threeToOne("p.Glu746_Ala750del")).toBe("E746_A750del");
    expect(threeToOne("p.Ala767_Val769dup")).toBe("A767_V769dup");
    expect(threeToOne("p.Asp770_Asn771insSerValAsp")).toBe("D770_N771insSVD");
    expect(threeToOne("p.Leu747_Pro753delinsSer")).toBe("L747_P753delinsS");
    expect(threeToOne("p.Arg273GlyfsTer12")).toBe("R273Gfs*12");
  });

  it("leaves 1-letter names as they are, in canonical case", () => {
    expect(threeToOne("p.L858R")).toBe("L858R");
    expect(threeToOne("l858r")).toBe("L858R");
    expect(threeToOne("E746_A750DEL")).toBe("E746_A750del");
  });
});

describe("extractReport: realistic reports", () => {
  it("reads an EGFR tissue NGS report with TP53, VUS, negatives and PD-L1", () => {
    const r = extractReport(TISSUE_NGS);
    expect(alts(r)).toEqual(["EGFR L858R", "TP53 R273H"]);
    expect(find(r, "EGFR", "L858R")).toMatchObject({ kind: "SNV", hgvsP: "p.Leu858Arg", vafPercent: 31.2 });
    expect(find(r, "TP53", "R273H")).toMatchObject({ kind: "SNV", hgvsP: "p.Arg273His", vafPercent: 28 });
    expect(r.testedNegative).toEqual(["ALK", "ROS1", "RET", "NTRK", "KRAS", "BRAF", "MET"]);
    expect(r.pdl1Tps).toBe(10);
    expect(r.sample).toBe("tissue");
    expect(r.warnings).toEqual(["Variant of uncertain significance ignored: ATM p.Val2424Gly."]);
  });

  it("reads a plasma report with C797S and VAFs, ignoring the interpretive comment", () => {
    const r = extractReport(PLASMA_NGS);
    expect(r.sample).toBe("plasma");
    expect(alts(r)).toEqual(["EGFR Exon 19 Deletion", "EGFR C797S", "TP53 R248Q"]);
    expect(find(r, "EGFR", "Exon 19 Deletion")).toMatchObject({ kind: "indel", hgvsP: "p.E746_A750del", vafPercent: 4.8 });
    expect(find(r, "EGFR", "C797S")).toMatchObject({ kind: "SNV", vafPercent: 0.4 });
    expect(find(r, "TP53", "R248Q")?.vafPercent).toBe(1.2);
    // "EGFR T790M" not detected is variant-specific, so EGFR is not tested-negative (and it is positive anyway).
    expect(r.testedNegative).toEqual(["MET", "ALK"]);
    expect(r.variants.some((v) => v.alteration === "T790M")).toBe(false);
    expect(r.pdl1Tps).toBeUndefined();
    expect(r.warnings).toEqual([]);
  });

  it("reads an ALK FISH + IHC report", () => {
    const r = extractReport(ALK_FISH_IHC);
    expect(r.variants).toHaveLength(1);
    expect(r.variants[0]).toMatchObject({ gene: "ALK", alteration: "Fusion", kind: "fusion" });
    expect(r.variants[0].vafPercent).toBeUndefined();
    expect(r.testedNegative).toEqual(["ROS1", "EGFR"]);
    expect(r.pdl1Tps).toBe(70);
    expect(r.sample).toBe("tissue");
    expect(r.warnings).toEqual([]);
  });

  it("reads the one-line summaries used in the fictional patient records", () => {
    const r = extractReport("KRAS G12C (VAF 22%), TP53 R248Q. EGFR, ALK, ROS1, BRAF, MET, RET, NTRK, ERBB2 negative. STK11 and KEAP1 wild-type.");
    expect(alts(r)).toEqual(["KRAS G12C", "TP53 R248Q"]);
    expect(find(r, "KRAS", "G12C")?.vafPercent).toBe(22);
    expect(r.testedNegative).toEqual(["EGFR", "ALK", "ROS1", "BRAF", "MET", "RET", "NTRK", "ERBB2", "STK11", "KEAP1"]);
    expect(r.warnings).toContain("VAF not found for TP53 R248Q.");
  });

  it("follows a gene header over the lines below it (PCR kit layout)", () => {
    const r = extractReport("EGFR mutation analysis (cobas v2, tissue):\nExon 19 deletion: DETECTED\nT790M: NOT DETECTED\nL858R: Not detected");
    expect(alts(r)).toEqual(["EGFR Exon 19 Deletion"]);
    expect(r.testedNegative).toEqual([]);
  });

  it("reads vertical key-value exports", () => {
    const r = extractReport("Gene: EGFR\nVariant: p.L858R\nVAF: 31%\n\nGene: TP53\nVariant: p.R273H\nVAF: 12%");
    expect(r.variants.map((v) => [v.gene, v.alteration, v.vafPercent])).toEqual([["EGFR", "L858R", 31], ["TP53", "R273H", 12]]);
  });
});

describe("extractReport: messy formatting", () => {
  it("reads a table flattened into one line", () => {
    const r = extractReport("Gene Variant VAF EGFR p.L858R 31% TP53 p.R273H 12%");
    expect(r.variants.map((v) => [v.gene, v.alteration, v.vafPercent])).toEqual([["EGFR", "L858R", 31], ["TP53", "R273H", 12]]);
  });

  it("handles semicolons, bullets and mixed case", () => {
    const r = extractReport("egfr l858r detected • Kras G12C • ALK neg; Ros1 - Negative; braf: Wild Type");
    expect(alts(r)).toEqual(["EGFR L858R", "KRAS G12C"]);
    expect(r.testedNegative).toEqual(["ALK", "ROS1", "BRAF"]);
  });

  it("reads a tab-separated table with a VAF (%) column", () => {
    const r = extractReport("Gene\tAlteration\tVAF (%)\nEGFR\tp.T790M\t2.4\nEGFR\tp.C797S\t0.8");
    expect(r.variants.map((v) => [v.alteration, v.hgvsP, v.vafPercent])).toEqual([["T790M", "p.T790M", 2.4], ["C797S", "p.C797S", 0.8]]);
  });

  it("normalises unicode dashes and ≥, keeping the original text in `matched`", () => {
    const text = "EML4‑ALK fusion detected (RNA). PD‑L1 TPS ⩾50%; KRAS G12C — VAF 12%";
    const r = extractReport(text);
    expect(alts(r)).toEqual(["ALK EML4::ALK", "KRAS G12C"]);
    expect(r.variants[0].matched).toBe("EML4‑ALK fusion detected");
    expect(r.variants[1]).toMatchObject({ vafPercent: 12, matched: "KRAS G12C — VAF 12%" });
    expect(r.pdl1Tps).toBe(50);
  });

  it("treats ::, - and / between fusion partners the same", () => {
    for (const t of ["EML4::ALK fusion", "EML4-ALK fusion", "EML4/ALK fusion", "eml4-alk"]) {
      expect(alts(extractReport(t))).toEqual(["ALK EML4::ALK"]);
    }
  });
});

describe("extractReport: alteration names", () => {
  it("reads 3-letter HGVS and keeps it in hgvsP", () => {
    const r = extractReport("KRAS p.Gly12Cys; BRAF p.Val600Glu (VAF 31%); TP53 p.Arg213Ter; PIK3CA p.His1047Arg; KEAP1 p.(Gly333Cys)");
    expect(alts(r)).toEqual(["KRAS G12C", "BRAF V600E", "TP53 R213*", "PIK3CA H1047R", "KEAP1 G333C"]);
    expect(r.variants.map((v) => v.hgvsP)).toEqual(["p.Gly12Cys", "p.Val600Glu", "p.Arg213Ter", "p.His1047Arg", "p.(Gly333Cys)"]);
    expect(find(r, "BRAF", "V600E")?.vafPercent).toBe(31);
  });

  it.each([
    "EGFR exon 19 deletion",
    "EGFR ex19del",
    "EGFR exon 19 del",
    "EGFR Exon19 deletion detected",
    "EGFRex19del",
    "EGFR E746_A750del",
    "EGFR p.Glu746_Ala750del",
    "EGFR p.L747_P753delinsS",
    "Exon 19 deletion in EGFR",
  ])("reads %s as Exon 19 Deletion", (text) => {
    const r = extractReport(text);
    expect(r.variants).toHaveLength(1);
    expect(r.variants[0]).toMatchObject({ gene: "EGFR", alteration: "Exon 19 Deletion", kind: "indel" });
  });

  it("merges wording and HGVS of the same exon 19 deletion, keeping HGVS and VAF", () => {
    const r = extractReport("EGFR p.E746_A750del (exon 19 deletion), VAF: 0.4%\nEGFR exon 19 deletion confirmed by PCR.");
    expect(r.variants).toEqual([{ gene: "EGFR", alteration: "Exon 19 Deletion", kind: "indel", hgvsP: "p.E746_A750del", vafPercent: 0.4, matched: "EGFR p.E746_A750del (exon 19 deletion), VAF: 0.4%" }]);
  });

  it("reads EGFR and HER2 exon 20 insertions", () => {
    const r = extractReport("EGFR exon 20 insertion p.D770_N771insSVD; HER2 Y772_A775dup");
    expect(alts(r)).toEqual(["EGFR Exon 20 Insertion", "ERBB2 Exon 20 Insertion"]);
    expect(find(r, "ERBB2", "Exon 20 Insertion")?.hgvsP).toBe("p.Y772_A775dup");
    expect(alts(extractReport("EGFR ex20ins"))).toEqual(["EGFR Exon 20 Insertion"]);
    expect(alts(extractReport("EGFR A767_V769dup"))).toEqual(["EGFR Exon 20 Insertion"]);
  });

  it.each(["MET exon 14 skipping", "METex14 detected", "MET ex14 skipping (c.3082+1G>T)", "MET exon 14 splice site mutation"])("reads %s as MET exon 14 skipping", (text) => {
    expect(extractReport(text).variants).toEqual([expect.objectContaining({ gene: "MET", alteration: "Exon 14 Skipping Mutation", kind: "indel" })]);
  });

  it("keeps MET exon 14 skipping when the report says no MET amplification", () => {
    const r = extractReport("No MET amplification. MET exon 14 skipping detected (VAF 18%).");
    expect(r.variants).toEqual([expect.objectContaining({ gene: "MET", alteration: "Exon 14 Skipping Mutation", vafPercent: 18 })]);
    expect(r.testedNegative).not.toContain("MET");
    expect(hasWarning(r, /MET: Exon 14 Skipping Mutation kept/)).toBe(true);
  });

  it("reads MET amplification as a CNV and 'no MET amplification' as a negative", () => {
    expect(extractReport("MET amp").variants).toEqual([expect.objectContaining({ gene: "MET", alteration: "Amplification", kind: "CNV" })]);
    expect(alts(extractReport("HER2 amplification (ERBB2/CEP17 ratio 4.2)"))).toEqual(["ERBB2 Amplification"]);
    const neg = extractReport("No MET amplification.");
    expect(neg.variants).toEqual([]);
    expect(neg.testedNegative).toEqual(["MET"]);
  });

  it("names fusions partner::gene with the 5′ partner first", () => {
    const r = extractReport("CD74-ROS1 fusion; KIF5B-RET; ETV6::NTRK3 by RNA NGS; CD74-NRG1");
    expect(alts(r)).toEqual(["ROS1 CD74::ROS1", "RET KIF5B::RET", "NTRK3 ETV6::NTRK3", "NRG1 CD74::NRG1"]);
    expect(r.variants.every((v) => v.kind === "fusion")).toBe(true);
  });

  it("reads rearrangement wording without a partner as Fusion, and prefers the named partner", () => {
    expect(alts(extractReport("ALK rearrangement"))).toEqual(["ALK Fusion"]);
    expect(alts(extractReport("ALK fusion positive"))).toEqual(["ALK Fusion"]);
    expect(alts(extractReport("ROS1 positive by FISH"))).toEqual(["ROS1 Fusion"]);
    expect(alts(extractReport("ALK-positive (IHC D5F3)"))).toEqual(["ALK Fusion"]);
    expect(alts(extractReport("ALK rearrangement detected (EML4-ALK variant 1)"))).toEqual(["ALK EML4::ALK"]);
  });

  it("flags two EGFR sensitising mutations for confirmation", () => {
    const r = extractReport("EGFR L858R and exon 19 deletion detected");
    expect(alts(r)).toEqual(["EGFR L858R", "EGFR Exon 19 Deletion"]);
    expect(r.warnings).toContain("Two EGFR sensitising mutations found (L858R, Exon 19 Deletion); please confirm.");
  });

  it("deduplicates the same alteration, preferring the entry with HGVS and VAF", () => {
    const r = extractReport("EGFR L858R detected.\nEGFR p.Leu858Arg, VAF 31%");
    expect(r.variants).toEqual([{ gene: "EGFR", alteration: "L858R", kind: "SNV", hgvsP: "p.Leu858Arg", vafPercent: 31, matched: "EGFR p.Leu858Arg, VAF 31%" }]);
  });
});

describe("extractReport: VAF", () => {
  it.each([
    ["EGFR L858R VAF 31%", 31],
    ["EGFR L858R 31% VAF", 31],
    ["EGFR L858R, allele frequency 1.2%", 1.2],
    ["EGFR L858R (AF 2.1%)", 2.1],
    ["EGFR L858R, VAF: 0.4%", 0.4],
    ["EGFR L858R detected with a variant allele frequency of 12.5%", 12.5],
  ])("reads %s", (text, vaf) => {
    expect(extractReport(text).variants[0].vafPercent).toBe(vaf);
  });

  it("attaches each VAF to the nearest preceding variant on the line and warns when one is missing", () => {
    const r = extractReport("EGFR L858R (VAF 31%), TP53 R273H (VAF 28%); KRAS G12C");
    expect(r.variants.map((v) => [v.alteration, v.vafPercent])).toEqual([["L858R", 31], ["R273H", 28], ["G12C", undefined]]);
    expect(r.warnings).toContain("VAF not found for KRAS G12C.");
  });

  it("never attaches a VAF across another gene's negative statement", () => {
    const r = extractReport("EGFR L858R, ALK negative (VAF 0%)");
    expect(r.variants[0].vafPercent).toBeUndefined();
  });
});

describe("extractReport: PD-L1", () => {
  it.each([
    ["PD-L1 TPS 60%", 60],
    ["PD-L1 (22C3) TPS: 10%", 10],
    ["TPS <1%", 0],
    ["PD-L1 22C3 pharmDx: tumour proportion score (TPS) 0%", 0],
  ])("reads %s", (text, tps) => {
    const r = extractReport(text);
    expect(r.pdl1Tps).toBe(tps);
    expect(r.warnings).toEqual([]);
  });

  it("records ≥50% as 50 with a warning that the exact value was not given", () => {
    const r = extractReport("PD-L1 high (TPS ≥ 50%)");
    expect(r.pdl1Tps).toBe(50);
    expect(hasWarning(r, /exact value not given/)).toBe(true);
  });

  it("does not invent a TPS from words alone", () => {
    const r = extractReport("PD-L1: negative");
    expect(r.pdl1Tps).toBeUndefined();
    expect(hasWarning(r, /without a TPS value/)).toBe(true);
  });
});

describe("extractReport: negatives", () => {
  it.each([
    ["ALK negative", ["ALK"]],
    ["ROS1: not detected", ["ROS1"]],
    ["Negative for: BRAF, KRAS, MET, RET, NTRK", ["BRAF", "KRAS", "MET", "RET", "NTRK"]],
    ["EGFR, ALK and ROS1: negative", ["EGFR", "ALK", "ROS1"]],
    ["EGFR/ALK/ROS1 negative", ["EGFR", "ALK", "ROS1"]],
    ["No EML4-ALK fusion detected", ["ALK"]],
    ["Pertinent negatives:\nALK, ROS1\nRET", ["ALK", "ROS1", "RET"]],
    ["No pathogenic variants were detected in KRAS or BRAF.", ["KRAS", "BRAF"]],
  ])("reads %s as tested negative, never as a variant", (text, genes) => {
    const r = extractReport(text);
    expect(r.variants).toEqual([]);
    expect(r.testedNegative).toEqual(genes);
  });

  it("keeps a variant-specific negative out of testedNegative", () => {
    const r = extractReport("EGFR: L858R positive; T790M negative");
    expect(alts(r)).toEqual(["EGFR L858R"]);
    expect(r.testedNegative).toEqual([]);
    const only = extractReport("T790M (EGFR): not detected");
    expect(only.variants).toEqual([]);
    expect(only.testedNegative).toEqual([]);
    expect(hasWarning(only, /only specific changes were reported as not detected \(T790M\)/)).toBe(true);
  });

  it("applies one result to a list of changes", () => {
    const r = extractReport("EGFR L858R and T790M: not detected");
    expect(r.variants).toEqual([]);
  });

  it("drops a variant the report contradicts, with a warning", () => {
    const r = extractReport("MET amplification: not detected; MET amplified (GCN 7)");
    expect(r.variants).toEqual([]);
    expect(hasWarning(r, /Conflicting statements for MET Amplification/)).toBe(true);
  });
});

describe("extractReport: ignored and hedged statements", () => {
  it("ignores variants of uncertain significance inline, in sections and as Tier III", () => {
    const inline = extractReport("EGFR L858R (VAF 31%)\nVUS: KEAP1 p.R320Q (VAF 12%)");
    expect(alts(inline)).toEqual(["EGFR L858R"]);
    expect(inline.warnings).toContain("Variant of uncertain significance ignored: KEAP1 p.R320Q.");
    const section = extractReport("Variants of uncertain significance:\n\nKEAP1 p.R320Q\nSTK11 p.F354L\n\nEGFR L858R detected");
    expect(alts(section)).toEqual(["EGFR L858R"]);
    expect(section.warnings).toContain("Variant of uncertain significance ignored: KEAP1 p.R320Q; STK11 p.F354L.");
    const tier = extractReport("Tier III: TP53 p.P72R\nTier IA: EGFR L858R");
    expect(alts(tier)).toEqual(["EGFR L858R"]);
  });

  it("ignores a germline polymorphism only when it is labelled benign", () => {
    const benign = extractReport("TP53 p.P72R (germline polymorphism, benign)");
    expect(benign.variants).toEqual([]);
    expect(hasWarning(benign, /labelled benign ignored: TP53 p\.P72R/)).toBe(true);
    const unlabelled = extractReport("TP53 p.P72R germline polymorphism");
    expect(alts(unlabelled)).toEqual(["TP53 P72R"]);
    expect(hasWarning(unlabelled, /mentions germline origin/)).toBe(true);
  });

  it("does not read testing advice, drug names or pending results as findings", () => {
    for (const t of ["Testing for ALK rearrangement is recommended.", "Consider KRAS G12C inhibitor (sotorasib).", "ROS1 FISH: pending", "If EGFR exon 19 deletion, osimertinib."]) {
      expect(extractReport(t).variants).toEqual([]);
      expect(extractReport(t).testedNegative).toEqual([]);
    }
  });

  it("does not read general commentary as a finding, but warns about it", () => {
    const r = extractReport("MET amplification is a known mechanism of resistance to osimertinib.");
    expect(r.variants).toEqual([]);
    expect(hasWarning(r, /interpretive text/)).toBe(true);
    expect(extractReport("The panel covers ALK, ROS1, RET fusions and EGFR exon 19 deletions.").variants).toEqual([]);
    expect(extractReport("Patients with ALK-positive NSCLC are eligible for alectinib.").variants).toEqual([]);
  });

  it("never guesses a gene: orphans and unknown genes become warnings", () => {
    const orphan = extractReport("Exon 19 deletion detected.");
    expect(orphan.variants).toEqual([]);
    expect(hasWarning(orphan, /without a gene name/)).toBe(true);
    const unknown = extractReport("EGFR L858R, ATM p.V2424G");
    expect(alts(unknown)).toEqual(["EGFR L858R"]);
    expect(hasWarning(unknown, /gene the reader does not cover.*ATM/)).toBe(true);
    const impossible = extractReport("KRAS G1202R");
    expect(impossible.variants).toEqual([]);
    expect(hasWarning(impossible, /beyond the KRAS protein/)).toBe(true);
  });

  it("attaches a hallmark change to the gene named earlier on the line", () => {
    const r = extractReport("EGFR L858R was detected. T790M was also detected (VAF 3%).");
    expect(r.variants.map((v) => [v.gene, v.alteration, v.vafPercent])).toEqual([["EGFR", "L858R", undefined], ["EGFR", "T790M", 3]]);
  });
});

describe("extractReport: sample and quality", () => {
  it.each([
    ["Sample: plasma. EGFR L858R", "plasma"],
    ["ctDNA NGS: EGFR L858R detected", "plasma"],
    ["Liquid biopsy: EGFR T790M (VAF 1.1%)", "plasma"],
    ["cfDNA analysis, KRAS G12C", "plasma"],
    ["Specimen: lung tissue, core biopsy", "tissue"],
    ["FFPE block A2: EGFR L858R", "tissue"],
    ["DNA from biopsy block; EGFR L858R", "tissue"],
    ["EGFR L858R", undefined],
  ])("%s → %s", (text, sample) => {
    expect(extractReport(text).sample).toBe(sample);
  });

  it("warns that low tumour content can miss alterations", () => {
    const low = extractReport("Tumour content 10%. EGFR wild-type.");
    expect(hasWarning(low, /low tumour content can miss alterations/i)).toBe(true);
    expect(low.testedNegative).toEqual(["EGFR"]);
    expect(extractReport("Tumour content: 40%. EGFR wild-type.").warnings).toEqual([]);
    expect(hasWarning(extractReport("Low coverage in exon 20; interpret with caution."), /quality limitation/)).toBe(true);
  });
});

describe("extractReport: no false positives", () => {
  it("returns an empty result for clinical text without molecular findings", () => {
    const text = `Clinic letter (fictional). Patient met the eligibility criteria discussed; MET criteria for hospice not met.
RET-urned to clinic after CT. ALKaline phosphatase 98 U/L; ALK phos 120 U/L.
Stage IV, T2aN2M1b. Ki67 30%. TTF-1 positive, p40 negative. Plan: CT in 3 months.`;
    expect(extractReport(text)).toEqual({ variants: [], testedNegative: [], warnings: [] });
    expect(extractReport("")).toEqual({ variants: [], testedNegative: [], warnings: [] });
  });

  it("does not read lists of genes or drug classes as fusions", () => {
    const r = extractReport("ALK-TKI naive; EGFR/ALK negative; AMP/ASCO/CAP tier I: KRAS G12C");
    expect(alts(r)).toEqual(["KRAS G12C"]);
    expect(r.testedNegative).toEqual(["EGFR", "ALK"]);
  });
});

describe("extractReport: output contract", () => {
  const fixtures = [TISSUE_NGS, PLASMA_NGS, ALK_FISH_IHC, "EGFR p.L747_P753delinsS (exon 19 deletion), VAF: 0.4%", "Gene Variant VAF EGFR p.L858R 31% TP53 p.R273H 12%"];

  it("keeps `matched` an exact fragment of the input, at most 80 characters", () => {
    for (const text of fixtures) {
      for (const v of extractReport(text).variants) {
        expect(v.matched.length).toBeGreaterThan(0);
        expect(v.matched.length).toBeLessThanOrEqual(80);
        expect(text).toContain(v.matched);
      }
    }
  });

  it("is deterministic and fits the case-form limits", () => {
    for (const text of fixtures) {
      const a = extractReport(text);
      expect(extractReport(text)).toEqual(a);
      for (const v of a.variants) {
        expect(v.gene).toMatch(/^[A-Z0-9]{2,8}$/);
        expect(v.alteration.length).toBeLessThanOrEqual(40);
        if (v.hgvsP) expect(v.hgvsP.length).toBeLessThanOrEqual(40);
      }
      for (const g of a.testedNegative) expect(g).toMatch(/^[A-Z0-9-]{2,8}$/);
      expect(new Set(a.warnings).size).toBe(a.warnings.length);
    }
  });
});
