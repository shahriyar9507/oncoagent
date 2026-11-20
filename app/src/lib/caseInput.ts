import { z } from "zod";
import type { Medication, Patient, RecistPoint, TherapyLine, TimelineEvent, Variant } from "./types";
import { selectKnowledgeKey } from "./clinical/select";
import { tagsFor } from "./data/medications";

// A clinician-entered, de-identified NSCLC case. The same schema validates the form in the browser and the API on the
// server, and the server rebuilds the Patient from it (it never trusts a client-built record).
// No names, record numbers, addresses or exact birth dates are collected.

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").refine((d) => !Number.isNaN(Date.parse(d)), "Not a real date");

export const CASE_ID_PATTERN = /^C-[A-Z0-9]{6}$/;

export const STAGES = ["IIIB", "IIIC", "IVA", "IVB"] as const;
export const RESPONSES = ["Complete response", "Partial response", "Stable disease", "Progressive disease", "Not assessed"] as const;

export const VariantInputSchema = z.object({
  gene: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,8}$/, "Gene symbol, e.g. EGFR"),
  alteration: z.string().trim().min(1).max(40),
  kind: z.enum(["SNV", "fusion", "indel", "CNV"]),
  vafPercent: z.number().min(0).max(100).optional(),
  sample: z.enum(["tissue", "plasma"]),
  hgvsP: z.string().max(40).optional(),
});

export const PriorLineSchema = z.object({
  regimen: z.string().trim().min(2).max(80),
  start: isoDate,
  end: isoDate.optional(),
  bestResponse: z.enum(RESPONSES).optional(),
  progressed: z.boolean(),
});

export const RecistInputSchema = z.object({
  date: isoDate,
  sumMm: z.number().min(0).max(1000),
  newLesions: z.boolean(),
});

export const CaseInputSchema = z.object({
  /** The clinician's own short label (e.g. "Ward 3, bed 12" is NOT allowed: no identifiers). Shown only in this browser. */
  label: z.string().trim().max(40).optional(),
  age: z.number().int().min(18).max(100),
  sex: z.enum(["F", "M"]),
  smoking: z.enum(["never", "former", "current"]),
  histology: z.enum(["adenocarcinoma", "squamous", "nsclc-nos"]),
  stage: z.enum(STAGES),
  sites: z.string().trim().max(80).optional(),
  ecog: z.number().int().min(0).max(4),
  pdl1Tps: z.number().min(0).max(100).optional(),
  weightKg: z.number().min(25).max(250),
  heightCm: z.number().min(120).max(220),
  creatinineMgDl: z.number().min(0.2).max(15),
  creatinineDate: isoDate,
  reportDate: isoDate,
  variants: z.array(VariantInputSchema).max(12),
  testedNegative: z.array(z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,8}$/)).max(20),
  priorLines: z.array(PriorLineSchema).max(4),
  medications: z.array(z.string().trim().min(2).max(60)).max(20),
  recist: z.array(RecistInputSchema).max(12),
  question: z.string().trim().max(400).optional(),
  asOf: isoDate,
});

export type CaseInput = z.infer<typeof CaseInputSchema>;
export type VariantInput = z.infer<typeof VariantInputSchema>;

const SMOKING: Record<CaseInput["smoking"], string> = { never: "Never smoked", former: "Former smoker", current: "Current smoker" };
const HISTOLOGY: Record<CaseInput["histology"], string> = { adenocarcinoma: "Adenocarcinoma", squamous: "Squamous cell carcinoma", "nsclc-nos": "NSCLC, not otherwise specified" };

function monthsFrom(a: string, b: string): number {
  return Math.round(((Date.parse(b) - Date.parse(a)) / 86_400_000 / 30.4375) * 10) / 10;
}

export function newCaseId(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return `C-${s}`;
}

/** Build the agents' Patient record from a validated case input. Deterministic: same input, same record. */
export function buildPatientFromInput(input: CaseInput, id: string): Patient {
  const lines: TherapyLine[] = input.priorLines
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((l, i) => ({ line: i + 1, regimen: l.regimen, start: l.start, end: l.end, bestResponse: l.bestResponse, stopReason: l.progressed ? "Progression" : undefined }));
  const lastLine = input.priorLines.slice().sort((a, b) => a.start.localeCompare(b.start)).at(-1);
  const progressed = !!lastLine?.progressed;

  const variants: Variant[] = input.variants.map((v) => ({
    gene: v.gene,
    alteration: v.alteration,
    kind: v.kind,
    hgvsP: v.hgvsP,
    vafPercent: v.vafPercent,
    origin: "somatic",
    sample: v.sample,
    reportedOn: input.reportDate,
    lab: "Clinician-entered report",
  }));

  const selection = selectKnowledgeKey({
    variants: variants.map((v) => ({ gene: v.gene, alteration: v.alteration, kind: v.kind, sample: v.sample })),
    priorRegimens: lines.map((l) => l.regimen),
    progressedOnCurrentLine: progressed,
    pdl1Tps: input.pdl1Tps,
    histology: input.histology,
  });

  const medications: Medication[] = input.medications.map((name) => ({ name, indication: "Entered by clinician", tags: tagsFor(name) }));

  const recistSorted = input.recist.slice().sort((a, b) => a.date.localeCompare(b.date));
  const first = recistSorted[0]?.date;
  const recist: RecistPoint[] = recistSorted.map((r) => ({
    date: r.date,
    months: first ? monthsFrom(first, r.date) : 0,
    sumMm: r.sumMm,
    newLesions: r.newLesions,
    note: r.newLesions ? "see the CT report entered by the clinician" : undefined,
  }));

  // Timeline built from what the clinician entered; each event becomes citable evidence (pt:eN).
  const raw: Omit<TimelineEvent, "id">[] = [];
  const dxDate = [recistSorted[0]?.date, input.reportDate, lines[0]?.start].filter(Boolean).sort()[0] as string;
  raw.push({ date: dxDate, kind: "pathology", title: "Diagnosis", detail: `${HISTOLOGY[input.histology]}, stage ${input.stage}${input.sites ? ` (${input.sites})` : ""}. ECOG ${input.ecog}.${input.pdl1Tps !== undefined ? ` PD-L1 TPS ${input.pdl1Tps}%.` : ""}`, source: "Clinician-entered summary" });
  for (const r of recistSorted) {
    raw.push({ date: r.date, kind: "imaging", title: "CT measurement", detail: `Sum of target lesions ${r.sumMm} mm${r.newLesions ? "; new lesion reported" : ""}.`, source: "Clinician-entered radiology summary" });
  }
  for (const l of lines) {
    raw.push({ date: l.start, kind: "treatment", title: `${l.regimen} started`, detail: `Line ${l.line}${l.end ? `, stopped ${l.end}` : ", ongoing"}${l.bestResponse ? `; best response ${l.bestResponse.toLowerCase()}` : ""}${l.stopReason ? `; ${l.stopReason.toLowerCase()}` : ""}.`, source: "Clinician-entered history" });
  }
  const varText = variants.map((v) => `${v.gene} ${v.alteration}${v.vafPercent !== undefined ? ` (VAF ${v.vafPercent}%)` : ""}`).join(", ");
  const sample = variants[0]?.sample ?? "tissue";
  raw.push({
    date: input.reportDate,
    kind: "molecular",
    title: `${sample === "plasma" ? "Plasma" : "Tissue"} molecular report`,
    detail: `${varText || "No reportable alteration"}.${input.testedNegative.length ? ` Negative: ${input.testedNegative.join(", ")}.` : ""}`,
    source: "Clinician-entered molecular report",
  });
  raw.push({ date: input.creatinineDate, kind: "lab", title: "Kidney function", detail: `Serum creatinine ${input.creatinineMgDl} mg/dL; weight ${input.weightKg} kg; height ${input.heightCm} cm.`, source: "Clinician-entered labs" });
  const events: TimelineEvent[] = raw.sort((a, b) => a.date.localeCompare(b.date)).map((e, i) => ({ ...e, id: `e${i + 1}` }));

  const question =
    input.question?.trim() ||
    (progressed && lastLine
      ? `Progression on ${lastLine.regimen}. Propose next tests, next-line options, recruiting trials, safety checks and dosing.`
      : "New diagnosis. Propose missing tests, first-line options, recruiting trials, safety checks and dosing.");

  return {
    id,
    displayName: input.label?.trim() || `Case ${id}`,
    age: input.age,
    sex: input.sex,
    smoking: SMOKING[input.smoking],
    diagnosis: "Non-small-cell lung cancer",
    histology: HISTOLOGY[input.histology],
    stage: `${input.stage}${input.sites ? ` (${input.sites})` : ""}`,
    ecog: input.ecog,
    weightKg: input.weightKg,
    heightCm: input.heightCm,
    serumCreatinineMgDl: input.creatinineMgDl,
    creatinineDate: input.creatinineDate,
    asOf: input.asOf,
    pdl1Tps: input.pdl1Tps,
    variants,
    medications,
    allergies: [],
    therapyLines: lines,
    events,
    recist,
    ctdna: [],
    question,
    status: progressed ? "Progression · next line" : lines.length ? "On treatment" : "New diagnosis · first line",
    biomarkerKey: selection.key ?? "",
    knowledgeReason: selection.reason,
    trialQuery: { condition: "non-small cell lung cancer", term: selection.trialTerm },
  };
}
