import { dailymedSearch } from "./knowledge";

// Dose parameters taken from product labels for the demo regimens. Clinicians must confirm against the current label.
export interface RegimenComponent {
  drug: string;
  method: "calvert" | "bsa" | "flat" | "weight-band";
  /** Target AUC (mg/mL·min) for Calvert dosing. */
  targetAuc?: number;
  /** mg per m² for BSA dosing. */
  mgPerM2?: number;
  /** Fixed dose text for flat dosing, exactly as in the label. */
  flatDose?: string;
  schedule: string;
  source: string;
  url: string;
}

export interface Regimen {
  key: string;
  name: string;
  components: RegimenComponent[];
  premedication: string[];
  renalRule?: { drug: string; minCrCl: number; message: string };
}

export const regimens: Record<string, Regimen> = {
  "carboplatin-pemetrexed": {
    key: "carboplatin-pemetrexed",
    name: "Carboplatin + pemetrexed (every 21 days)",
    components: [
      { drug: "Carboplatin", method: "calvert", targetAuc: 5, schedule: "Day 1, every 21 days", source: "Carboplatin label (Calvert formula; FDA advises capping GFR at 125 mL/min)", url: dailymedSearch("carboplatin") },
      { drug: "Pemetrexed", method: "bsa", mgPerM2: 500, schedule: "Day 1, every 21 days", source: "Pemetrexed label", url: dailymedSearch("pemetrexed") },
    ],
    premedication: [
      "Folic acid 400–1000 mcg orally once daily, starting 7 days before the first dose (pemetrexed label)",
      "Vitamin B12 1 mg intramuscularly 1 week before the first dose, then every 3 cycles (pemetrexed label)",
      "Dexamethasone 4 mg orally twice daily the day before, the day of and the day after pemetrexed (pemetrexed label)",
    ],
    renalRule: { drug: "Pemetrexed", minCrCl: 45, message: "Pemetrexed is not recommended when creatinine clearance is below 45 mL/min." },
  },
  pembrolizumab: {
    key: "pembrolizumab",
    name: "Pembrolizumab monotherapy",
    components: [
      { drug: "Pembrolizumab", method: "flat", flatDose: "200 mg every 3 weeks or 400 mg every 6 weeks", schedule: "Intravenous infusion", source: "Pembrolizumab label", url: dailymedSearch("pembrolizumab") },
    ],
    premedication: [],
  },
  "pembrolizumab-carboplatin-pemetrexed": {
    key: "pembrolizumab-carboplatin-pemetrexed",
    name: "Pembrolizumab + carboplatin + pemetrexed (every 21 days)",
    components: [
      { drug: "Pembrolizumab", method: "flat", flatDose: "200 mg every 3 weeks", schedule: "Day 1, every 21 days", source: "Pembrolizumab label", url: dailymedSearch("pembrolizumab") },
      { drug: "Carboplatin", method: "calvert", targetAuc: 5, schedule: "Day 1, every 21 days, 4 cycles", source: "Carboplatin label (Calvert formula; GFR capped at 125 mL/min)", url: dailymedSearch("carboplatin") },
      { drug: "Pemetrexed", method: "bsa", mgPerM2: 500, schedule: "Day 1, every 21 days", source: "Pemetrexed label", url: dailymedSearch("pemetrexed") },
    ],
    premedication: [
      "Folic acid 400–1000 mcg orally once daily, starting 7 days before the first dose (pemetrexed label)",
      "Vitamin B12 1 mg intramuscularly 1 week before the first dose, then every 3 cycles (pemetrexed label)",
    ],
    renalRule: { drug: "Pemetrexed", minCrCl: 45, message: "Pemetrexed is not recommended when creatinine clearance is below 45 mL/min." },
  },
  alectinib: {
    key: "alectinib",
    name: "Alectinib",
    components: [{ drug: "Alectinib", method: "flat", flatDose: "600 mg orally twice daily with food", schedule: "Continuous", source: "Alectinib label", url: dailymedSearch("alectinib") }],
    premedication: [],
  },
  lorlatinib: {
    key: "lorlatinib",
    name: "Lorlatinib",
    components: [{ drug: "Lorlatinib", method: "flat", flatDose: "100 mg orally once daily", schedule: "Continuous", source: "Lorlatinib label", url: dailymedSearch("lorlatinib") }],
    premedication: [],
  },
  brigatinib: {
    key: "brigatinib",
    name: "Brigatinib",
    components: [{ drug: "Brigatinib", method: "flat", flatDose: "90 mg once daily for 7 days, then 180 mg once daily", schedule: "Continuous", source: "Brigatinib label", url: dailymedSearch("brigatinib") }],
    premedication: [],
  },
};
