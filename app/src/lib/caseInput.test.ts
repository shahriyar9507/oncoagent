import { describe, expect, it } from "vitest";
import { CaseInputSchema, buildPatientFromInput, CASE_ID_PATTERN, newCaseId, type CaseInput } from "./caseInput";
import { criticCheck } from "./agents/critic";
import { EvidenceRegistry } from "./agents/rules";
import type { RecommendationCard } from "./types";

const base: CaseInput = {
  age: 58, sex: "F", smoking: "never", histology: "adenocarcinoma", stage: "IVB", ecog: 1, pdl1Tps: 5,
  weightKg: 52, heightCm: 155, creatinineMgDl: 0.7, creatinineDate: "2026-11-18", reportDate: "2026-11-15",
  variants: [{ gene: "EGFR", alteration: "Exon 19 Deletion", kind: "indel", sample: "tissue", vafPercent: 28 }],
  testedNegative: ["ALK", "ROS1"], priorLines: [], medications: ["Omeprazole"], recist: [{ date: "2026-11-12", sumMm: 48, newLesions: false }], asOf: "2026-11-20",
};

describe("case input schema", () => {
  it("accepts a complete de-identified case", () => {
    expect(CaseInputSchema.safeParse(base).success).toBe(true);
  });
  it("rejects out-of-range values and bad dates", () => {
    expect(CaseInputSchema.safeParse({ ...base, age: 12 }).success).toBe(false);
    expect(CaseInputSchema.safeParse({ ...base, creatinineMgDl: 0 }).success).toBe(false);
    expect(CaseInputSchema.safeParse({ ...base, reportDate: "15/11/2026" }).success).toBe(false);
    expect(CaseInputSchema.safeParse({ ...base, variants: [{ ...base.variants[0], gene: "egfr mutation!" }] }).success).toBe(false);
  });
  it("normalises gene symbols to upper case", () => {
    const r = CaseInputSchema.parse({ ...base, variants: [{ ...base.variants[0], gene: "egfr" }] });
    expect(r.variants[0].gene).toBe("EGFR");
  });
  it("generates case IDs in the expected format", () => {
    for (let i = 0; i < 20; i++) expect(CASE_ID_PATTERN.test(newCaseId())).toBe(true);
  });
});

describe("buildPatientFromInput", () => {
  it("selects the EGFR first-line setting and the EGFR trial term", () => {
    const p = buildPatientFromInput(base, "C-ABC234");
    expect(p.biomarkerKey).toBe("EGFR_COMMON_1L");
    expect(p.trialQuery.term.toUpperCase()).toContain("EGFR");
    expect(p.status).toBe("New diagnosis · first line");
  });
  it("builds citable timeline events, sorted by date, with no name", () => {
    const p = buildPatientFromInput(base, "C-ABC234");
    expect(p.displayName).toBe("Case C-ABC234");
    expect(p.events.map((e) => e.id)).toEqual(p.events.map((_, i) => `e${i + 1}`));
    expect([...p.events].map((e) => e.date)).toEqual([...p.events].map((e) => e.date).sort());
    expect(p.events.some((e) => e.kind === "molecular" && e.detail.includes("Negative: ALK, ROS1"))).toBe(true);
  });
  it("tags medications from the catalogue", () => {
    const p = buildPatientFromInput(base, "C-ABC234");
    expect(p.medications[0].tags).toContain("acid-reducing");
  });
  it("marks progression and moves EGFR to the post-osimertinib setting", () => {
    const p = buildPatientFromInput({ ...base, priorLines: [{ regimen: "Osimertinib", start: "2025-01-10", end: "2026-11-01", bestResponse: "Partial response", progressed: true }] }, "C-ABC234");
    expect(p.status).toBe("Progression · next line");
    expect(p.biomarkerKey).toBe("EGFR_PROGRESSION");
    expect(p.therapyLines[0].stopReason).toBe("Progression");
  });
  it("leaves the setting empty with a reason when the pack does not cover the case", () => {
    const p = buildPatientFromInput({ ...base, variants: [{ gene: "ALK", alteration: "EML4::ALK", kind: "fusion", sample: "tissue" }], priorLines: [{ regimen: "Alectinib", start: "2024-01-01", end: "2026-10-01", progressed: true }] }, "C-ABC234");
    expect(p.biomarkerKey).toBe("");
    expect(p.knowledgeReason).toBeTruthy();
  });
});

describe("safety-critic: uncovered setting", () => {
  const card: RecommendationCard = {
    id: "x", patientId: "C-ABC234", agent: "Synthesis (Claude)", kind: "treatment", origin: "claude",
    proposal: "Consider lorlatinib.", why: [], evidenceIds: ["pt:e1"], confidence: "low", confidenceReason: "", uncertain: "", alternatives: [], changesIf: "", safety: [],
    critic: { verdict: "pass", notes: [] },
  };
  it("flags a named drug when no knowledge-pack entry covers the setting", () => {
    const reg = new EvidenceRegistry();
    reg.add({ id: "pt:e1", kind: "patient", label: "x", detail: "x" });
    const r = criticCheck(card, reg, { biomarkerKey: "", knownTrials: new Set(), contraindicated: new Set() });
    expect(r.critic.verdict).toBe("flag");
    expect(r.critic.notes.join(" ")).toMatch(/No knowledge-pack entry/);
  });
  it("passes a tumour-board recommendation without a drug name", () => {
    const reg = new EvidenceRegistry();
    reg.add({ id: "pt:e1", kind: "patient", label: "x", detail: "x" });
    const r = criticCheck({ ...card, proposal: "Discuss at tumour board; screen for trials." }, reg, { biomarkerKey: "", knownTrials: new Set(), contraindicated: new Set() });
    expect(r.critic.verdict).toBe("pass");
  });
});
