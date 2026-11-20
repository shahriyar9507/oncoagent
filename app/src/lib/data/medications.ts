// Common co-medications of oncology patients in Bangladesh, with the interaction tags used by the
// Pharmacology-safety agent (see interactionRules in knowledge.ts). Only well-established properties are tagged:
//   qt-prolonging           known risk of QT prolongation / torsades de pointes, or a QT warning in its own label
//   strong-cyp3a-inducer    strong CYP3A inducer (FDA classification; phenobarbital tagged conservatively, see its note)
//   strong-cyp3a-inhibitor  strong CYP3A inhibitor (FDA classification)
//   acid-reducing           proton-pump inhibitor, potassium-competitive acid blocker, H2 blocker or antacid
//   nsaid                   non-steroidal anti-inflammatory drug
// Moderate inhibitors/inducers are not tagged; where a cancer-drug label also restricts moderate ones, the note says so.
// A demonstration subset: production use needs a licensed interaction database.

export interface CatalogueMedication {
  name: string;
  group: string;
  tags: string[];
  note?: string;
}

export const MEDICATION_CATALOGUE: CatalogueMedication[] = [
  // QT-prolonging
  { name: "Citalopram", group: "Antidepressant (SSRI)", tags: ["qt-prolonging"] },
  { name: "Escitalopram", group: "Antidepressant (SSRI)", tags: ["qt-prolonging"] },
  { name: "Ondansetron", group: "Antiemetic (5-HT3 antagonist)", tags: ["qt-prolonging"], note: "Common with chemotherapy; check ECG when combined with other QT-prolonging drugs." },
  { name: "Domperidone", group: "Antiemetic / prokinetic", tags: ["qt-prolonging"] },
  { name: "Haloperidol", group: "Antipsychotic", tags: ["qt-prolonging"] },
  { name: "Chlorpromazine", group: "Antipsychotic", tags: ["qt-prolonging"] },
  { name: "Azithromycin", group: "Antibiotic (macrolide)", tags: ["qt-prolonging"] },
  { name: "Clarithromycin", group: "Antibiotic (macrolide)", tags: ["qt-prolonging", "strong-cyp3a-inhibitor"] },
  { name: "Erythromycin", group: "Antibiotic (macrolide)", tags: ["qt-prolonging"], note: "Moderate CYP3A inhibitor; some cancer-drug labels also restrict moderate inhibitors." },
  { name: "Levofloxacin", group: "Antibiotic (fluoroquinolone)", tags: ["qt-prolonging"] },
  { name: "Moxifloxacin", group: "Antibiotic (fluoroquinolone)", tags: ["qt-prolonging"] },
  { name: "Ciprofloxacin", group: "Antibiotic (fluoroquinolone)", tags: ["qt-prolonging"], note: "Moderate CYP3A inhibitor." },
  { name: "Fluconazole", group: "Antifungal (azole)", tags: ["qt-prolonging"], note: "Moderate CYP3A inhibitor; some cancer-drug labels also restrict moderate inhibitors." },
  { name: "Amiodarone", group: "Antiarrhythmic", tags: ["qt-prolonging"] },
  { name: "Sotalol", group: "Antiarrhythmic / beta-blocker", tags: ["qt-prolonging"] },
  { name: "Methadone", group: "Opioid analgesic", tags: ["qt-prolonging"] },
  { name: "Hydroxychloroquine", group: "Antimalarial / DMARD", tags: ["qt-prolonging"] },
  { name: "Chloroquine", group: "Antimalarial", tags: ["qt-prolonging"] },

  // Strong CYP3A inducers
  { name: "Carbamazepine", group: "Antiseizure", tags: ["strong-cyp3a-inducer"], note: "Ask neurology about a non-inducing alternative such as levetiracetam." },
  { name: "Phenytoin", group: "Antiseizure", tags: ["strong-cyp3a-inducer"], note: "Ask neurology about a non-inducing alternative such as levetiracetam." },
  { name: "Phenobarbital", group: "Antiseizure", tags: ["strong-cyp3a-inducer"], note: "The FDA example table classes phenobarbital as a moderate CYP3A inducer; it is tagged as strong here to stay on the safe side (most targeted-drug labels also restrict moderate inducers)." },
  { name: "Rifampicin", group: "Antituberculosis", tags: ["strong-cyp3a-inducer"], note: "Common in Bangladesh for tuberculosis; the TB programme must be involved before any change." },
  { name: "St John's wort", group: "Herbal supplement", tags: ["strong-cyp3a-inducer"] },

  // Strong CYP3A inhibitors
  { name: "Ketoconazole", group: "Antifungal (azole)", tags: ["strong-cyp3a-inhibitor", "qt-prolonging"] },
  { name: "Itraconazole", group: "Antifungal (azole)", tags: ["strong-cyp3a-inhibitor"] },
  { name: "Voriconazole", group: "Antifungal (azole)", tags: ["strong-cyp3a-inhibitor", "qt-prolonging"] },
  { name: "Posaconazole", group: "Antifungal (azole)", tags: ["strong-cyp3a-inhibitor", "qt-prolonging"] },
  { name: "Ritonavir", group: "Antiretroviral (boosted protease inhibitor)", tags: ["strong-cyp3a-inhibitor"], note: "Includes lopinavir/ritonavir." },

  // Acid-reducing agents
  { name: "Omeprazole", group: "Proton-pump inhibitor", tags: ["acid-reducing"] },
  { name: "Esomeprazole", group: "Proton-pump inhibitor", tags: ["acid-reducing"] },
  { name: "Pantoprazole", group: "Proton-pump inhibitor", tags: ["acid-reducing"] },
  { name: "Lansoprazole", group: "Proton-pump inhibitor", tags: ["acid-reducing"] },
  { name: "Rabeprazole", group: "Proton-pump inhibitor", tags: ["acid-reducing"] },
  { name: "Vonoprazan", group: "Potassium-competitive acid blocker", tags: ["acid-reducing"] },
  { name: "Famotidine", group: "H2 blocker", tags: ["acid-reducing"] },
  { name: "Antacid (aluminium/magnesium hydroxide)", group: "Locally acting antacid", tags: ["acid-reducing"], note: "Locally acting: several labels allow it with dose separation, unlike PPIs and H2 blockers." },

  // NSAIDs
  { name: "Ibuprofen", group: "NSAID", tags: ["nsaid"], note: "Named in the pemetrexed label (hold around doses when CrCl is 45–79 mL/min)." },
  { name: "Naproxen", group: "NSAID", tags: ["nsaid"] },
  { name: "Diclofenac", group: "NSAID", tags: ["nsaid"] },
  { name: "Aceclofenac", group: "NSAID", tags: ["nsaid"] },
  { name: "Ketorolac", group: "NSAID", tags: ["nsaid"] },
  { name: "Etoricoxib", group: "NSAID (COX-2 selective)", tags: ["nsaid"] },
  { name: "Celecoxib", group: "NSAID (COX-2 selective)", tags: ["nsaid"] },

  // Common co-medications without an interaction tag in this table
  { name: "Metformin", group: "Antidiabetic", tags: [] },
  { name: "Gliclazide", group: "Antidiabetic (sulfonylurea)", tags: [] },
  { name: "Insulin", group: "Antidiabetic", tags: [], note: "Check glucose closely with corticosteroid premedication and checkpoint inhibitors." },
  { name: "Amlodipine", group: "Antihypertensive (calcium-channel blocker)", tags: [] },
  { name: "Losartan", group: "Antihypertensive (ARB)", tags: [] },
  { name: "Atorvastatin", group: "Statin", tags: [] },
  { name: "Aspirin (low dose)", group: "Antiplatelet", tags: [], note: "Low-dose aspirin is not tagged as an NSAID for the pemetrexed rule." },
  { name: "Levetiracetam", group: "Antiseizure", tags: [], note: "Non-inducing antiseizure option." },
  { name: "Sodium valproate", group: "Antiseizure", tags: [] },
  { name: "Dexamethasone", group: "Corticosteroid", tags: [], note: "Can induce CYP3A at higher doses; not tagged as a strong inducer." },
  { name: "Prednisolone", group: "Corticosteroid", tags: [] },
  { name: "Paracetamol", group: "Analgesic", tags: [] },
  { name: "Morphine", group: "Opioid analgesic", tags: [] },
  { name: "Levothyroxine", group: "Thyroid hormone", tags: [] },
  { name: "Enoxaparin", group: "Anticoagulant (LMWH)", tags: [] },
  { name: "Salbutamol", group: "Bronchodilator", tags: [] },
];

/** Alternative spellings and generic synonyms mapped to the catalogue name. */
const ALIASES: Record<string, string> = {
  rifampin: "Rifampicin",
  acetaminophen: "Paracetamol",
  "st. john's wort": "St John's wort",
  "st johns wort": "St John's wort",
  hypericum: "St John's wort",
  "lopinavir/ritonavir": "Ritonavir",
  "valproic acid": "Sodium valproate",
  valproate: "Sodium valproate",
  albuterol: "Salbutamol",
  "aluminium hydroxide": "Antacid (aluminium/magnesium hydroxide)",
  "aluminum hydroxide": "Antacid (aluminium/magnesium hydroxide)",
  "magnesium hydroxide": "Antacid (aluminium/magnesium hydroxide)",
  antacid: "Antacid (aluminium/magnesium hydroxide)",
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Matches a term as a whole word or phrase (so "omeprazole" does not match "esomeprazole"). */
function containsTerm(text: string, term: string): boolean {
  return new RegExp(`(^|[^a-z])${escapeRegExp(term)}($|[^a-z])`).test(text);
}

/** The catalogue term used for matching: the name without a bracketed qualifier, e.g. "aspirin" for "Aspirin (low dose)". */
function matchTerm(name: string): string {
  return name.replace(/\s*\(.*\)\s*$/, "").toLowerCase();
}

/**
 * Interaction tags for a free-text medication entry such as "Omeprazole 20 mg daily" or "Lopinavir/ritonavir".
 * Case-insensitive; a text naming several catalogue drugs gets the union of their tags. Unknown drugs return [].
 */
export function tagsFor(name: string): string[] {
  const text = name.toLowerCase().replace(/[’`]/g, "'");
  const tags = new Set<string>();
  for (const m of MEDICATION_CATALOGUE) {
    if (containsTerm(text, matchTerm(m.name)) || containsTerm(text, m.name.toLowerCase())) m.tags.forEach((t) => tags.add(t));
  }
  for (const [alias, target] of Object.entries(ALIASES)) {
    if (!containsTerm(text, alias)) continue;
    MEDICATION_CATALOGUE.find((m) => m.name === target)?.tags.forEach((t) => tags.add(t));
  }
  return Array.from(tags);
}
