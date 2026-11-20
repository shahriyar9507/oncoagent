import type { RecistPoint } from "../types";

// RECIST 1.1 response from the sum of target-lesion diameters.
export type RecistCategory = "Baseline" | "CR" | "PR" | "SD" | "PD";

export interface RecistAssessment extends RecistPoint {
  changeFromBaselinePct: number;
  changeFromNadirPct: number;
  nadirMm: number;
  category: RecistCategory;
}

export const PR_THRESHOLD = -30; // % from baseline
export const PD_THRESHOLD = 20; // % from nadir
export const PD_MIN_ABSOLUTE_MM = 5;

export function assessRecist(points: RecistPoint[]): RecistAssessment[] {
  if (points.length === 0) return [];
  const baseline = points[0].sumMm;
  let nadir = baseline;
  return points.map((pt, i) => {
    const fromBaseline = baseline === 0 ? 0 : ((pt.sumMm - baseline) / baseline) * 100;
    const fromNadir = nadir === 0 ? 0 : ((pt.sumMm - nadir) / nadir) * 100;
    let category: RecistCategory;
    if (i === 0) category = "Baseline";
    else if (pt.newLesions) category = "PD";
    else if (fromNadir >= PD_THRESHOLD && pt.sumMm - nadir >= PD_MIN_ABSOLUTE_MM) category = "PD";
    else if (pt.sumMm === 0) category = "CR";
    else if (fromBaseline <= PR_THRESHOLD) category = "PR";
    else category = "SD";
    const result: RecistAssessment = { ...pt, changeFromBaselinePct: fromBaseline, changeFromNadirPct: fromNadir, nadirMm: nadir, category };
    nadir = Math.min(nadir, pt.sumMm);
    return result;
  });
}

export function bestResponse(assessments: RecistAssessment[]): RecistCategory | undefined {
  const order: RecistCategory[] = ["CR", "PR", "SD", "PD"];
  const found = assessments.filter((a) => a.category !== "Baseline").map((a) => a.category);
  return order.find((c) => found.includes(c));
}
