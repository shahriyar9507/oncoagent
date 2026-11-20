import { describe, expect, it } from "vitest";
import { bsaMosteller, buildDoseCard, calvertDose, crclCockcroftGault, roundTo } from "./dose";
import { assessRecist, bestResponse } from "./recist";
import { getPatient } from "../data/patients";

describe("dose calculators", () => {
  it("Mosteller BSA matches the hand calculation", () => {
    // sqrt(152 * 54 / 3600) = sqrt(2.28) = 1.50997
    expect(bsaMosteller(152, 54)).toBeCloseTo(1.50997, 4);
  });

  it("Cockcroft–Gault applies the 0.85 factor for women", () => {
    // (140-55)*54 / (72*0.8) = 79.6875; *0.85 = 67.734
    expect(crclCockcroftGault(55, 54, 0.8, "F")).toBeCloseTo(67.734, 2);
    expect(crclCockcroftGault(55, 54, 0.8, "M")).toBeCloseTo(79.6875, 3);
  });

  it("Calvert caps GFR at 125 mL/min", () => {
    expect(calvertDose(5, 67.734).dose).toBeCloseTo(463.67, 1);
    const capped = calvertDose(5, 160);
    expect(capped.capped).toBe(true);
    expect(capped.dose).toBe(750);
  });

  it("rounds to the nearest step", () => {
    expect(roundTo(463.67, 10)).toBe(460);
    expect(roundTo(754.98, 10)).toBe(750);
  });

  it("builds the carboplatin–pemetrexed card for P-001", () => {
    const card = buildDoseCard(getPatient("P-001")!, "carboplatin-pemetrexed", "2026-11-20");
    expect(card.blocks).toHaveLength(0);
    expect(card.lines[0].rounded).toBe(460);
    expect(card.lines[1].rounded).toBe(750);
    expect(card.premedication.length).toBeGreaterThan(0);
  });

  it("blocks a dose card when creatinine is stale", () => {
    const card = buildDoseCard(getPatient("P-001")!, "carboplatin-pemetrexed", "2026-12-20");
    expect(card.blocks.join(" ")).toMatch(/days old/);
  });

  it("every fictional record is dose-ready on its own as-of date", () => {
    for (const [id, regimen] of [["P-001", "carboplatin-pemetrexed"], ["P-002", "pembrolizumab-carboplatin-pemetrexed"], ["P-003", "alectinib"]] as const) {
      const p = getPatient(id)!;
      expect(p.asOf).toBeDefined();
      expect(buildDoseCard(p, regimen, p.asOf!).blocks).toHaveLength(0);
    }
  });

  it("blocks pemetrexed below CrCl 45", () => {
    const p = { ...getPatient("P-002")!, serumCreatinineMgDl: 2.4 };
    const card = buildDoseCard(p, "pembrolizumab-carboplatin-pemetrexed", "2026-11-20");
    expect(card.blocks.join(" ")).toMatch(/below 45/);
  });
});

describe("RECIST 1.1", () => {
  it("classifies the P-001 course", () => {
    const a = assessRecist(getPatient("P-001")!.recist);
    expect(a.map((x) => x.category)).toEqual(["Baseline", "PR", "PR", "PR", "PR", "PD"]);
    expect(a[5].nadirMm).toBe(32);
    expect(a[5].changeFromNadirPct).toBeCloseTo(40.6, 1);
    expect(bestResponse(a)).toBe("PR");
  });

  it("needs 5 mm absolute growth for progression", () => {
    const a = assessRecist([
      { date: "a", months: 0, sumMm: 10, newLesions: false },
      { date: "b", months: 1, sumMm: 13, newLesions: false },
    ]);
    // +30% but only +3 mm: stable disease
    expect(a[1].category).toBe("SD");
  });
});
