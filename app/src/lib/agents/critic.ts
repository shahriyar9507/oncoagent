import type { RecommendationCard } from "../types";
import { knowledge, interactionRules } from "../data/knowledge";
import type { EvidenceRegistry } from "./rules";

// Safety-critic: deterministic checks on every card before a doctor sees it. Fails closed.
const DRUG_VOCAB = Array.from(
  new Set([
    ...Object.values(knowledge).flatMap((k) => k.options.flatMap((o) => o.drugs)),
    ...interactionRules.map((r) => r.drug),
    "osimertinib", "gefitinib", "erlotinib", "afatinib", "dacomitinib", "lazertinib", "crizotinib", "ceritinib", "entrectinib",
    "repotrectinib", "dabrafenib", "trametinib", "capmatinib", "tepotinib", "selpercatinib", "pralsetinib", "larotrectinib",
    "docetaxel", "cisplatin", "paclitaxel", "nivolumab", "atezolizumab", "durvalumab", "cemiplimab", "bevacizumab",
  ]),
);

export function criticCheck(card: RecommendationCard, reg: EvidenceRegistry, opts: { biomarkerKey: string; knownTrials: Set<string>; contraindicated: Set<string> }): RecommendationCard {
  const notes: string[] = [];
  const text = [card.proposal, ...card.why, ...card.alternatives].join(" ");
  const lower = text.toLowerCase();

  if (!card.evidenceIds.length) notes.push("No evidence attached.");
  const unknown = card.evidenceIds.filter((id) => !reg.has(id));
  if (unknown.length) notes.push(`Unknown evidence id(s): ${unknown.join(", ")}.`);

  const ncts = text.match(/NCT\d{8}/g) ?? [];
  const strayTrials = ncts.filter((n) => !opts.knownTrials.has(n));
  if (strayTrials.length) notes.push(`Trial ID(s) not returned by the registry: ${Array.from(new Set(strayTrials)).join(", ")}.`);

  if (card.kind !== "dose" && /\b\d+(\.\d+)?\s?(mg|mcg|g)\b(?!\/)/i.test(card.proposal)) {
    notes.push("A dose appears outside the dose calculator.");
  }

  const kb = opts.biomarkerKey ? knowledge[opts.biomarkerKey] : undefined;
  if (card.kind === "treatment" && !kb) {
    const named = DRUG_VOCAB.filter((d) => card.proposal.toLowerCase().includes(d));
    if (named.length) notes.push(`No knowledge-pack entry covers this setting, so ${named.join(", ")} cannot be checked against approved options.`);
  }
  if (card.kind === "treatment" && kb) {
    const allowed = new Set(kb.options.flatMap((o) => o.drugs));
    const currentDrugs = new Set(kb.options.filter((o) => o.role !== "later-line").flatMap((o) => o.drugs));
    const laterLine = new Set(kb.options.filter((o) => o.role === "later-line").flatMap((o) => o.drugs).filter((d) => !currentDrugs.has(d)));
    const lead = card.proposal.toLowerCase();
    const mentioned = DRUG_VOCAB.filter((d) => lead.includes(d));
    const outside = mentioned.filter((d) => !allowed.has(d));
    if (outside.length) notes.push(`Drug(s) not in the knowledge pack for this setting: ${outside.join(", ")}.`);
    const early = mentioned.filter((d) => laterLine.has(d) && !lead.includes("later line") && !lead.includes("at progression"));
    if (early.length) notes.push(`${early.join(", ")} is a later-line option in this setting.`);
    const contra = mentioned.filter((d) => opts.contraindicated.has(d));
    if (contra.length && !lower.includes("contraindicated")) notes.push(`${contra.join(", ")} is contraindicated with a current medication and the card does not say so.`);
  }

  return { ...card, critic: { verdict: notes.length ? "flag" : "pass", notes } };
}
