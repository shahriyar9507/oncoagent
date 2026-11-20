import type { Patient } from "../types";
import { regimens, type Regimen, type WeightBand } from "../data/regimens";

// Deterministic dose calculators. The language model never produces a dose.

/** Body surface area (m²) by the Mosteller formula. */
export function bsaMosteller(heightCm: number, weightKg: number): number {
  if (heightCm <= 0 || weightKg <= 0) throw new Error("Height and weight must be positive");
  return Math.sqrt((heightCm * weightKg) / 3600);
}

/** Creatinine clearance (mL/min) by Cockcroft–Gault with actual body weight. */
export function crclCockcroftGault(age: number, weightKg: number, serumCreatinineMgDl: number, sex: "F" | "M"): number {
  if (serumCreatinineMgDl <= 0) throw new Error("Serum creatinine must be positive");
  const base = ((140 - age) * weightKg) / (72 * serumCreatinineMgDl);
  return sex === "F" ? base * 0.85 : base;
}

export const GFR_CAP = 125;

/** Carboplatin dose (mg) by the Calvert formula, GFR capped at 125 mL/min. */
export function calvertDose(targetAuc: number, gfr: number): { dose: number; gfrUsed: number; capped: boolean } {
  const capped = gfr > GFR_CAP;
  const gfrUsed = Math.min(gfr, GFR_CAP);
  return { dose: targetAuc * (gfrUsed + 25), gfrUsed, capped };
}

export function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/** Per-kilogram dose (mg) on actual body weight, rounded to the nearest whole mg. */
export function perKgDose(mgPerKg: number, weightKg: number): { raw: number; rounded: number } {
  if (mgPerKg <= 0 || weightKg <= 0) throw new Error("Dose per kg and weight must be positive");
  const raw = mgPerKg * weightKg;
  return { raw, rounded: Math.round(raw) };
}

/** Index of the band that applies: the first band whose exclusive upper limit is above the weight (the last band is open-ended). */
export function pickWeightBand(bands: WeightBand[], weightKg: number): number {
  if (!bands.length) throw new Error("No weight bands defined");
  if (weightKg <= 0) throw new Error("Weight must be positive");
  const i = bands.findIndex((b) => b.maxKgExclusive === undefined || weightKg < b.maxKgExclusive);
  return i === -1 ? bands.length - 1 : i;
}

/** Human-readable band limits, e.g. "< 50 kg", "50 to < 80 kg", "≥ 80 kg". */
export function bandLabel(bands: WeightBand[], i: number): string {
  const lower = i > 0 ? bands[i - 1].maxKgExclusive : undefined;
  const upper = bands[i].maxKgExclusive;
  if (lower === undefined && upper !== undefined) return `< ${upper} kg`;
  if (lower !== undefined && upper !== undefined) return `${lower} to < ${upper} kg`;
  if (lower !== undefined) return `≥ ${lower} kg`;
  return "any weight";
}

export interface DoseLine {
  drug: string;
  method: string;
  formula: string;
  inputs: string[];
  raw?: number;
  rounded?: number;
  text: string;
  schedule: string;
  source: string;
  url: string;
}

export interface DoseCard {
  regimenKey: string;
  regimenName: string;
  bsa: number;
  crcl: number;
  lines: DoseLine[];
  premedication: string[];
  blocks: string[];
  warnings: string[];
  asOf: string;
}

/** Maximum age of a creatinine result (days) before a dose card is blocked. */
export const CREATININE_MAX_AGE_DAYS = 7;

export function buildDoseCard(p: Patient, regimenKey: string, today: string): DoseCard {
  const regimen: Regimen | undefined = regimens[regimenKey];
  if (!regimen) throw new Error(`Unknown regimen ${regimenKey}`);
  const bsa = bsaMosteller(p.heightCm, p.weightKg);
  const crcl = crclCockcroftGault(p.age, p.weightKg, p.serumCreatinineMgDl, p.sex);
  const blocks: string[] = [];
  const warnings: string[] = [];

  const age = daysBetween(p.creatinineDate, today);
  const needsRenal = regimen.components.some((c) => c.method === "calvert") || !!regimen.renalRule;
  if (needsRenal && age > CREATININE_MAX_AGE_DAYS) {
    blocks.push(`Creatinine is ${age} days old (limit ${CREATININE_MAX_AGE_DAYS}). Repeat before dosing.`);
  }
  if (regimen.renalRule && crcl < regimen.renalRule.minCrCl) {
    blocks.push(regimen.renalRule.message);
  }

  const lines: DoseLine[] = regimen.components.map((c) => {
    if (c.method === "calvert" && c.targetAuc) {
      const r = calvertDose(c.targetAuc, crcl);
      if (r.capped) warnings.push(`GFR estimate ${crcl.toFixed(0)} mL/min capped at ${GFR_CAP} for carboplatin.`);
      const rounded = roundTo(r.dose, 10);
      return {
        drug: c.drug,
        method: "Calvert",
        formula: `Dose = AUC × (GFR + 25) = ${c.targetAuc} × (${r.gfrUsed.toFixed(1)} + 25)`,
        inputs: [`Target AUC ${c.targetAuc} mg/mL·min (regimen protocol)`, `GFR ≈ CrCl ${crcl.toFixed(1)} mL/min (Cockcroft–Gault)`],
        raw: r.dose,
        rounded,
        text: `${rounded} mg`,
        schedule: c.schedule,
        source: c.source,
        url: c.url,
      };
    }
    if (c.method === "bsa" && c.mgPerM2) {
      const raw = c.mgPerM2 * bsa;
      const rounded = roundTo(raw, 10);
      return {
        drug: c.drug,
        method: "Body surface area",
        formula: `Dose = ${c.mgPerM2} mg/m² × ${bsa.toFixed(2)} m²`,
        inputs: [`Height ${p.heightCm} cm, weight ${p.weightKg} kg`, `BSA ${bsa.toFixed(2)} m² (Mosteller)`],
        raw,
        rounded,
        text: `${rounded} mg`,
        schedule: c.schedule,
        source: c.source,
        url: c.url,
      };
    }
    if (c.method === "per-kg" && c.mgPerKg) {
      const r = perKgDose(c.mgPerKg, p.weightKg);
      return {
        drug: c.drug,
        method: "Per kilogram",
        formula: `Dose = ${c.mgPerKg} mg/kg × ${p.weightKg} kg`,
        inputs: [`Weight ${p.weightKg} kg (record; confirm it is current)`, "Rounded to the nearest mg"],
        raw: r.raw,
        rounded: r.rounded,
        text: `${r.rounded} mg`,
        schedule: c.schedule,
        source: c.source,
        url: c.url,
      };
    }
    if (c.method === "weight-band" && c.bands?.length) {
      const bands = c.bands;
      const i = pickWeightBand(bands, p.weightKg);
      return {
        drug: c.drug,
        method: "Weight band",
        formula: `Weight-band rule: ${bands.map((b, j) => `${bandLabel(bands, j)} → ${b.dose}`).join("; ")}`,
        inputs: [`Weight ${p.weightKg} kg (record; confirm it is current)`, `Band applied: ${bandLabel(bands, i)}`],
        text: bands[i].dose,
        schedule: c.schedule,
        source: c.source,
        url: c.url,
      };
    }
    return {
      drug: c.drug,
      method: "Fixed dose",
      formula: "No calculation: fixed dose from the label",
      inputs: [],
      text: c.flatDose ?? "See label",
      schedule: c.schedule,
      source: c.source,
      url: c.url,
    };
  });

  return {
    regimenKey,
    regimenName: regimen.name,
    bsa,
    crcl,
    lines,
    premedication: regimen.premedication,
    blocks,
    warnings,
    asOf: `Weight and height from the record; creatinine ${p.serumCreatinineMgDl} mg/dL on ${p.creatinineDate}`,
  };
}
