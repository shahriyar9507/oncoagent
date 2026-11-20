import { dailymedSearch } from "./knowledge";

// Dose parameters taken from product labels for the demo regimens. Clinicians must confirm against the current label.
export interface WeightBand {
  /** Upper weight limit (kg, exclusive). Omit on the last band, which covers every heavier weight. */
  maxKgExclusive?: number;
  /** Dose text for this band, exactly as in the label. */
  dose: string;
}

export interface RegimenComponent {
  drug: string;
  method: "calvert" | "bsa" | "flat" | "weight-band" | "per-kg";
  /** Target AUC (mg/mL·min) for Calvert dosing. */
  targetAuc?: number;
  /** mg per m² for BSA dosing. */
  mgPerM2?: number;
  /** mg per kg of actual body weight for per-kg dosing. */
  mgPerKg?: number;
  /** Weight bands in ascending order for weight-band dosing; the first band whose limit is above the weight applies. */
  bands?: WeightBand[];
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

  // ---------- regimens for the generic knowledge-pack entries ----------

  osimertinib: {
    key: "osimertinib",
    name: "Osimertinib",
    components: [{ drug: "Osimertinib", method: "flat", flatDose: "80 mg orally once daily, with or without food", schedule: "Continuous", source: "Osimertinib label", url: dailymedSearch("osimertinib") }],
    premedication: [],
  },
  "osimertinib-carboplatin-pemetrexed": {
    key: "osimertinib-carboplatin-pemetrexed",
    name: "Osimertinib + carboplatin + pemetrexed (every 21 days)",
    components: [
      { drug: "Osimertinib", method: "flat", flatDose: "80 mg orally once daily", schedule: "Continuous, with chemotherapy and then with pemetrexed maintenance", source: "Osimertinib label (FLAURA2 regimen)", url: dailymedSearch("osimertinib") },
      { drug: "Carboplatin", method: "calvert", targetAuc: 5, schedule: "Day 1, every 21 days, 4 cycles", source: "Osimertinib label (FLAURA2: carboplatin AUC 5 or cisplatin 75 mg/m²); carboplatin label (Calvert formula; GFR capped at 125 mL/min)", url: dailymedSearch("carboplatin") },
      { drug: "Pemetrexed", method: "bsa", mgPerM2: 500, schedule: "Day 1, every 21 days (4 cycles with platinum, then maintenance)", source: "Pemetrexed label", url: dailymedSearch("pemetrexed") },
    ],
    premedication: [
      "Folic acid 400–1000 mcg orally once daily, starting 7 days before the first dose (pemetrexed label)",
      "Vitamin B12 1 mg intramuscularly 1 week before the first dose, then every 3 cycles (pemetrexed label)",
      "Dexamethasone 4 mg orally twice daily the day before, the day of and the day after pemetrexed (pemetrexed label)",
    ],
    renalRule: { drug: "Pemetrexed", minCrCl: 45, message: "Pemetrexed is not recommended when creatinine clearance is below 45 mL/min." },
  },
  "lazertinib-amivantamab": {
    key: "lazertinib-amivantamab",
    name: "Lazertinib + amivantamab (intravenous)",
    components: [
      { drug: "Lazertinib", method: "flat", flatDose: "240 mg orally once daily, with or without food", schedule: "Continuous; on infusion days give before amivantamab", source: "Lazertinib label", url: dailymedSearch("lazertinib") },
      {
        drug: "Amivantamab",
        method: "weight-band",
        bands: [
          { maxKgExclusive: 80, dose: "1,050 mg IV weekly for weeks 1–4 (week 1 dose split over days 1 and 2), then every 2 weeks from week 5" },
          { dose: "1,400 mg IV weekly for weeks 1–4 (week 1 dose split over days 1 and 2), then every 2 weeks from week 5" },
        ],
        schedule: "Band set by baseline body weight; not changed for later weight changes",
        source: "Amivantamab label (with lazertinib)",
        url: dailymedSearch("amivantamab"),
      },
    ],
    premedication: [
      "Before amivantamab infusions: antihistamine, antipyretic and glucocorticoid per label (glucocorticoid required for the first doses)",
      "Prophylactic anticoagulation for the first 4 months of treatment; vitamin K antagonists are not recommended (lazertinib label)",
    ],
  },
  "amivantamab-carboplatin-pemetrexed": {
    key: "amivantamab-carboplatin-pemetrexed",
    name: "Amivantamab + carboplatin + pemetrexed (every 21 days)",
    components: [
      {
        drug: "Amivantamab",
        method: "weight-band",
        bands: [
          { maxKgExclusive: 80, dose: "1,400 mg IV weekly for weeks 1–4 (week 1 dose split over days 1 and 2), then 1,750 mg every 3 weeks from week 7" },
          { dose: "1,750 mg IV weekly for weeks 1–4 (week 1 dose split over days 1 and 2), then 2,100 mg every 3 weeks from week 7" },
        ],
        schedule: "Given after carboplatin and pemetrexed; band set by baseline body weight",
        source: "Amivantamab label (with carboplatin and pemetrexed)",
        url: dailymedSearch("amivantamab"),
      },
      { drug: "Carboplatin", method: "calvert", targetAuc: 5, schedule: "Day 1, every 21 days, up to 4 cycles", source: "Amivantamab label (carboplatin AUC 5); carboplatin label (Calvert formula; GFR capped at 125 mL/min)", url: dailymedSearch("carboplatin") },
      { drug: "Pemetrexed", method: "bsa", mgPerM2: 500, schedule: "Day 1, every 21 days (continued as maintenance)", source: "Pemetrexed label", url: dailymedSearch("pemetrexed") },
    ],
    premedication: [
      "Before amivantamab infusions: antihistamine, antipyretic and glucocorticoid per label (glucocorticoid required for the first doses)",
      "Folic acid 400–1000 mcg orally once daily, starting 7 days before the first dose (pemetrexed label)",
      "Vitamin B12 1 mg intramuscularly 1 week before the first dose, then every 3 cycles (pemetrexed label)",
      "Dexamethasone 4 mg orally twice daily the day before, the day of and the day after pemetrexed (pemetrexed label)",
    ],
    renalRule: { drug: "Pemetrexed", minCrCl: 45, message: "Pemetrexed is not recommended when creatinine clearance is below 45 mL/min." },
  },
  crizotinib: {
    key: "crizotinib",
    name: "Crizotinib",
    components: [{ drug: "Crizotinib", method: "flat", flatDose: "250 mg orally twice daily, with or without food", schedule: "Continuous", source: "Crizotinib label", url: dailymedSearch("crizotinib") }],
    premedication: [],
  },
  entrectinib: {
    key: "entrectinib",
    name: "Entrectinib",
    components: [{ drug: "Entrectinib", method: "flat", flatDose: "600 mg orally once daily, with or without food", schedule: "Continuous (adult dose)", source: "Entrectinib label", url: dailymedSearch("entrectinib") }],
    premedication: [],
  },
  repotrectinib: {
    key: "repotrectinib",
    name: "Repotrectinib",
    components: [{ drug: "Repotrectinib", method: "flat", flatDose: "160 mg orally once daily for 14 days, then 160 mg twice daily", schedule: "Continuous, with or without food", source: "Repotrectinib label", url: dailymedSearch("repotrectinib") }],
    premedication: [],
  },
  taletrectinib: {
    key: "taletrectinib",
    name: "Taletrectinib",
    components: [{ drug: "Taletrectinib", method: "flat", flatDose: "600 mg orally once daily on an empty stomach", schedule: "Continuous; no food from 2 hours before to 2 hours after each dose", source: "Taletrectinib label", url: dailymedSearch("taletrectinib") }],
    premedication: [],
  },
  ensartinib: {
    key: "ensartinib",
    name: "Ensartinib",
    components: [{ drug: "Ensartinib", method: "flat", flatDose: "225 mg orally once daily, with or without food", schedule: "Continuous", source: "Ensartinib label", url: dailymedSearch("ensartinib") }],
    premedication: [],
  },
  "dabrafenib-trametinib": {
    key: "dabrafenib-trametinib",
    name: "Dabrafenib + trametinib",
    components: [
      { drug: "Dabrafenib", method: "flat", flatDose: "150 mg orally twice daily", schedule: "Continuous; at least 1 hour before or 2 hours after a meal", source: "Dabrafenib label", url: dailymedSearch("dabrafenib") },
      { drug: "Trametinib", method: "flat", flatDose: "2 mg orally once daily", schedule: "Continuous; at least 1 hour before or 2 hours after a meal", source: "Trametinib label", url: dailymedSearch("trametinib") },
    ],
    premedication: [],
  },
  "encorafenib-binimetinib": {
    key: "encorafenib-binimetinib",
    name: "Encorafenib + binimetinib",
    components: [
      { drug: "Encorafenib", method: "flat", flatDose: "450 mg orally once daily", schedule: "Continuous", source: "Encorafenib label", url: dailymedSearch("encorafenib") },
      { drug: "Binimetinib", method: "flat", flatDose: "45 mg orally twice daily, about 12 hours apart", schedule: "Continuous", source: "Binimetinib label", url: dailymedSearch("binimetinib") },
    ],
    premedication: [],
  },
  capmatinib: {
    key: "capmatinib",
    name: "Capmatinib",
    components: [{ drug: "Capmatinib", method: "flat", flatDose: "400 mg orally twice daily, with or without food", schedule: "Continuous", source: "Capmatinib label", url: dailymedSearch("capmatinib") }],
    premedication: [],
  },
  tepotinib: {
    key: "tepotinib",
    name: "Tepotinib",
    components: [{ drug: "Tepotinib", method: "flat", flatDose: "450 mg orally once daily with food", schedule: "Continuous", source: "Tepotinib label", url: dailymedSearch("tepotinib") }],
    premedication: [],
  },
  selpercatinib: {
    key: "selpercatinib",
    name: "Selpercatinib",
    components: [
      {
        drug: "Selpercatinib",
        method: "weight-band",
        bands: [
          { maxKgExclusive: 50, dose: "120 mg orally twice daily" },
          { dose: "160 mg orally twice daily" },
        ],
        schedule: "Continuous (adults and children 12 years and older)",
        source: "Selpercatinib label (weight-based dosage)",
        url: dailymedSearch("selpercatinib"),
      },
    ],
    premedication: [],
  },
  pralsetinib: {
    key: "pralsetinib",
    name: "Pralsetinib",
    components: [{ drug: "Pralsetinib", method: "flat", flatDose: "400 mg orally once daily on an empty stomach", schedule: "Continuous; no food from 2 hours before to 1 hour after each dose", source: "Pralsetinib label", url: dailymedSearch("pralsetinib") }],
    premedication: [],
  },
  larotrectinib: {
    key: "larotrectinib",
    name: "Larotrectinib",
    components: [{ drug: "Larotrectinib", method: "flat", flatDose: "100 mg orally twice daily, with or without food", schedule: "Continuous (adults and children with BSA ≥ 1.0 m²)", source: "Larotrectinib label", url: dailymedSearch("larotrectinib") }],
    premedication: [],
  },
  sotorasib: {
    key: "sotorasib",
    name: "Sotorasib",
    components: [{ drug: "Sotorasib", method: "flat", flatDose: "960 mg orally once daily", schedule: "Continuous", source: "Sotorasib label", url: dailymedSearch("sotorasib") }],
    premedication: [],
  },
  adagrasib: {
    key: "adagrasib",
    name: "Adagrasib",
    components: [{ drug: "Adagrasib", method: "flat", flatDose: "600 mg orally twice daily", schedule: "Continuous", source: "Adagrasib label", url: dailymedSearch("adagrasib") }],
    premedication: [],
  },
  zongertinib: {
    key: "zongertinib",
    name: "Zongertinib",
    components: [
      {
        drug: "Zongertinib",
        method: "weight-band",
        bands: [
          { maxKgExclusive: 90, dose: "120 mg orally once daily" },
          { dose: "180 mg orally once daily" },
        ],
        schedule: "Continuous, with or without food",
        source: "Zongertinib label (weight-based dosage)",
        url: dailymedSearch("zongertinib"),
      },
    ],
    premedication: [],
  },
  sevabertinib: {
    key: "sevabertinib",
    name: "Sevabertinib",
    components: [{ drug: "Sevabertinib", method: "flat", flatDose: "20 mg orally twice daily with food", schedule: "Continuous", source: "Sevabertinib label", url: dailymedSearch("sevabertinib") }],
    premedication: [],
  },
  "trastuzumab-deruxtecan": {
    key: "trastuzumab-deruxtecan",
    name: "Trastuzumab deruxtecan (every 21 days)",
    components: [
      { drug: "Trastuzumab deruxtecan", method: "per-kg", mgPerKg: 5.4, schedule: "IV infusion on day 1, every 21 days; do not substitute trastuzumab or ado-trastuzumab emtansine", source: "Trastuzumab deruxtecan label (HER2-mutant NSCLC)", url: dailymedSearch("trastuzumab deruxtecan") },
    ],
    premedication: ["Antiemetic prophylaxis before each dose; the current label classes trastuzumab deruxtecan as highly emetogenic (trastuzumab deruxtecan label)"],
  },
  cemiplimab: {
    key: "cemiplimab",
    name: "Cemiplimab monotherapy",
    components: [{ drug: "Cemiplimab", method: "flat", flatDose: "350 mg every 3 weeks", schedule: "Intravenous infusion", source: "Cemiplimab label", url: dailymedSearch("cemiplimab") }],
    premedication: [],
  },
  atezolizumab: {
    key: "atezolizumab",
    name: "Atezolizumab monotherapy",
    components: [{ drug: "Atezolizumab", method: "flat", flatDose: "840 mg every 2 weeks, 1,200 mg every 3 weeks or 1,680 mg every 4 weeks", schedule: "Intravenous infusion", source: "Atezolizumab label (intravenous)", url: dailymedSearch("atezolizumab") }],
    premedication: [],
  },
  nivolumab: {
    key: "nivolumab",
    name: "Nivolumab monotherapy",
    components: [{ drug: "Nivolumab", method: "flat", flatDose: "240 mg every 2 weeks or 480 mg every 4 weeks", schedule: "Intravenous infusion", source: "Nivolumab label (intravenous)", url: dailymedSearch("nivolumab") }],
    premedication: [],
  },
  "pembrolizumab-carboplatin-paclitaxel": {
    key: "pembrolizumab-carboplatin-paclitaxel",
    name: "Pembrolizumab + carboplatin + paclitaxel (every 21 days)",
    components: [
      { drug: "Pembrolizumab", method: "flat", flatDose: "200 mg every 3 weeks", schedule: "Day 1, every 21 days", source: "Pembrolizumab label", url: dailymedSearch("pembrolizumab") },
      { drug: "Carboplatin", method: "calvert", targetAuc: 6, schedule: "Day 1, every 21 days, 4 cycles", source: "KEYNOTE-407 regimen (carboplatin AUC 6); carboplatin label (Calvert formula; GFR capped at 125 mL/min)", url: dailymedSearch("carboplatin") },
      { drug: "Paclitaxel", method: "bsa", mgPerM2: 200, schedule: "Day 1, every 21 days, 4 cycles (3-hour infusion)", source: "KEYNOTE-407 regimen; paclitaxel label", url: dailymedSearch("paclitaxel") },
    ],
    premedication: [
      "Dexamethasone 20 mg orally about 12 and 6 hours before paclitaxel (paclitaxel label)",
      "Diphenhydramine 50 mg IV (or equivalent) 30–60 minutes before paclitaxel (paclitaxel label)",
      "An H2 antagonist IV 30–60 minutes before paclitaxel; the label names cimetidine 300 mg or ranitidine 50 mg (paclitaxel label)",
    ],
  },
  docetaxel: {
    key: "docetaxel",
    name: "Docetaxel (every 21 days)",
    components: [{ drug: "Docetaxel", method: "bsa", mgPerM2: 75, schedule: "Day 1, every 21 days (1-hour infusion)", source: "Docetaxel label (NSCLC after platinum)", url: dailymedSearch("docetaxel") }],
    premedication: ["Dexamethasone 8 mg orally twice daily for 3 days, starting the day before docetaxel (docetaxel label: oral corticosteroid premedication)"],
  },
  "docetaxel-ramucirumab": {
    key: "docetaxel-ramucirumab",
    name: "Ramucirumab + docetaxel (every 21 days)",
    components: [
      { drug: "Ramucirumab", method: "per-kg", mgPerKg: 10, schedule: "IV over 60 minutes on day 1 before docetaxel, every 21 days", source: "Ramucirumab label (NSCLC with docetaxel)", url: dailymedSearch("ramucirumab") },
      { drug: "Docetaxel", method: "bsa", mgPerM2: 75, schedule: "Day 1, every 21 days, after ramucirumab", source: "Docetaxel label; REVEL regimen", url: dailymedSearch("docetaxel") },
    ],
    premedication: [
      "An intravenous H1 antagonist (e.g. diphenhydramine) before each ramucirumab infusion (ramucirumab label)",
      "Dexamethasone 8 mg orally twice daily for 3 days, starting the day before docetaxel (docetaxel label: oral corticosteroid premedication)",
    ],
  },
  pemetrexed: {
    key: "pemetrexed",
    name: "Pemetrexed (every 21 days)",
    components: [{ drug: "Pemetrexed", method: "bsa", mgPerM2: 500, schedule: "Day 1, every 21 days", source: "Pemetrexed label", url: dailymedSearch("pemetrexed") }],
    premedication: [
      "Folic acid 400–1000 mcg orally once daily, starting 7 days before the first dose (pemetrexed label)",
      "Vitamin B12 1 mg intramuscularly 1 week before the first dose, then every 3 cycles (pemetrexed label)",
      "Dexamethasone 4 mg orally twice daily the day before, the day of and the day after pemetrexed (pemetrexed label)",
    ],
    renalRule: { drug: "Pemetrexed", minCrCl: 45, message: "Pemetrexed is not recommended when creatinine clearance is below 45 mL/min." },
  },
};
