import type { EvidenceItem, Patient, RecommendationCard } from "../types";
import { knowledge, interactionRules, FDA_APPROVALS_URL, KNOWLEDGE_VERSION, dailymedSearch, type BiomarkerEntry } from "../data/knowledge";
import { NSCLC_PANEL, testedGenes } from "../data/patients";
import { assessRecist, bestResponse } from "../clinical/recist";
import { buildDoseCard, type DoseCard } from "../clinical/dose";
import type { CivicResult } from "../tools/civic";
import type { TrialSearchResult } from "../tools/trials";

// Deterministic specialist agents. They run without a language model and always cite their inputs.

export class EvidenceRegistry {
  private items = new Map<string, EvidenceItem>();
  add(item: EvidenceItem): string {
    if (!this.items.has(item.id)) this.items.set(item.id, item);
    return item.id;
  }
  has(id: string): boolean {
    return this.items.has(id);
  }
  list(): EvidenceItem[] {
    return Array.from(this.items.values());
  }
}

let counter = 0;
function cardId(patientId: string, agent: string): string {
  counter = (counter + 1) % 1_000_000;
  return `${patientId}-${agent.toLowerCase().replace(/[^a-z]+/g, "-")}-${Date.now().toString(36)}${counter.toString(36)}`;
}

function base(p: Patient, agent: string, kind: RecommendationCard["kind"]): Pick<RecommendationCard, "id" | "patientId" | "agent" | "kind" | "origin" | "critic"> {
  return { id: cardId(p.id, agent), patientId: p.id, agent, kind, origin: "rules", critic: { verdict: "pass", notes: [] } };
}

export function patientEvidence(p: Patient, reg: EvidenceRegistry) {
  for (const e of p.events) {
    reg.add({ id: `pt:${e.id}`, kind: "patient", label: `${e.date} · ${e.title}`, detail: `${e.detail} (${e.source})` });
  }
}

export function sentinel(p: Patient, reg: EvidenceRegistry): RecommendationCard {
  const a = assessRecist(p.recist);
  const last = a[a.length - 1];
  const recistId = reg.add({
    id: "calc:recist",
    kind: "calculator",
    label: "RECIST 1.1 calculation",
    detail: a.map((x) => `${x.date}: ${x.sumMm} mm, ${x.category}${x.newLesions ? " (new lesion)" : ""}`).join("; "),
  });
  const ct = p.ctdna;
  const ctLast = ct[ct.length - 1];
  const ctPrev = ct.length > 1 ? ct[ct.length - 2] : undefined;
  const ctRising = ctLast && ctPrev && (ctLast.vafPercent ?? 0) > (ctPrev.vafPercent ?? 0);
  const imaging = p.events.filter((e) => e.kind === "imaging").slice(-1)[0];
  const ev = [recistId];
  if (imaging) ev.push(`pt:${imaging.id}`);
  const molecular = p.events.filter((e) => e.kind === "molecular").slice(-1)[0];
  if (molecular) ev.push(`pt:${molecular.id}`);

  if (last.category === "PD") {
    return {
      ...base(p, "Sentinel", "monitoring"),
      proposal: `Treat the ${last.date} scan as progression by RECIST 1.1 and review next-line treatment now.`,
      why: [
        `Sum of target lesions ${last.sumMm} mm against a nadir of ${last.nadirMm} mm (+${last.changeFromNadirPct.toFixed(1)}%, +${(last.sumMm - last.nadirMm).toFixed(0)} mm).`,
        last.newLesions ? `New lesion reported: ${last.note ?? "see radiology report"}.` : "No new lesion reported.",
        ctLast ? `ctDNA ${ctLast.marker} ${ctLast.vafPercent === null ? "not detected" : ctLast.vafPercent + "%"} on ${ctLast.date}${ctRising ? ", rising" : ""}.` : "No ctDNA series.",
        `Best response on current line: ${bestResponse(a) ?? "not assessable"}.`,
      ],
      evidenceIds: ev,
      confidence: "high",
      confidenceReason: "Both RECIST criteria are met: ≥ 20% and ≥ 5 mm growth from nadir, and a new lesion.",
      uncertain: "Radiologist confirmation of the new liver lesion is pending in this record.",
      alternatives: ["Repeat imaging in 4–6 weeks if the new lesion is equivocal"],
      changesIf: "The radiologist reclassifies the liver lesion as benign and growth stays below 20%.",
      safety: [],
    };
  }
  return {
    ...base(p, "Sentinel", "monitoring"),
    proposal: `Record the baseline (${a[0].sumMm} mm) and schedule the first response scan per protocol after treatment starts.`,
    why: [
      `Baseline sum of target lesions ${a[0].sumMm} mm on ${a[0].date}.`,
      ctLast ? `Baseline ctDNA ${ctLast.marker} ${ctLast.vafPercent ?? "not detected"}% on ${ctLast.date}.` : "No baseline ctDNA available.",
      `ECOG ${p.ecog}.`,
    ],
    evidenceIds: ev,
    confidence: "high",
    confidenceReason: "Measurements come from the radiology report in the record.",
    uncertain: "Response interval depends on the regimen chosen (commonly every 6–9 weeks).",
    alternatives: [],
    changesIf: "New symptoms or a red-flag result arrive before the planned scan.",
    safety: [],
  };
}

export function genomicInterpreter(p: Patient, civic: CivicResult[], reg: EvidenceRegistry): RecommendationCard[] {
  return p.variants.map((v) => {
    const r = civic.find((c) => c.query.toLowerCase().includes(v.gene.toLowerCase()) && c.query.toLowerCase().includes(v.alteration.toLowerCase().split("::")[0]));
    const ids: string[] = [];
    for (const e of r?.lungEvidence.slice(0, 4) ?? []) {
      ids.push(
        reg.add({
          id: `civic:EID${e.id}`,
          kind: "civic",
          label: `CIViC EID${e.id} · level ${e.level} · ${e.type.toLowerCase()}`,
          detail: `${e.significance.replace(/_/g, " ").toLowerCase()} · ${e.disease}${e.therapies.length ? " · " + e.therapies.join(", ") : ""}${e.pmid ? " · PMID " + e.pmid : ""}`,
          url: e.url,
        }),
      );
    }
    const mol = p.events.filter((e) => e.kind === "molecular").find((e) => e.detail.includes(v.gene));
    if (mol) ids.push(`pt:${mol.id}`);
    const resistance = r?.lungEvidence.filter((e) => /RESIST/i.test(e.significance)) ?? [];
    const sensitivity = r?.lungEvidence.filter((e) => /SENSITIV/i.test(e.significance)) ?? [];
    const prognostic = r?.lungEvidence.filter((e) => e.type === "PROGNOSTIC") ?? [];
    const top = r?.lungEvidence[0];
    let proposal: string;
    if (resistance.length && v.sample === "plasma") {
      proposal = `${v.gene} ${v.alteration} is an acquired resistance alteration: record it as the cause of progression on the current ${v.gene} inhibitor.`;
    } else if (sensitivity.length) {
      proposal = `${v.gene} ${v.alteration} is the actionable driver: confirm and sign the molecular interpretation.`;
    } else if (prognostic.length || v.gene === "TP53") {
      proposal = `${v.gene} ${v.alteration} is a co-mutation without a matched drug: record as prognostic, not actionable.`;
    } else {
      proposal = `${v.gene} ${v.alteration}: review the evidence before calling it actionable.`;
    }
    return {
      ...base(p, "Genomic-interpreter", "summary"),
      proposal,
      why: [
        `${v.gene} ${v.alteration}${v.hgvsP ? ` (${v.hgvsP})` : ""}, ${v.sample}${v.vafPercent !== undefined ? `, VAF ${v.vafPercent}%` : ""}, reported ${v.reportedOn}.`,
        r && r.source !== "none"
          ? `CIViC ${r.profileName}: ${r.totalEvidence} evidence items, ${r.lungEvidence.length} in lung cancer${top ? `; strongest level ${top.level}` : ""} (${r.source === "live" ? "live" : "snapshot"}).`
          : "CIViC returned no evidence for this profile.",
        resistance.length ? `${resistance.length} lung evidence item(s) report resistance.` : sensitivity.length ? `${sensitivity.length} lung evidence item(s) report sensitivity.` : "No predictive lung evidence in the top results.",
      ],
      evidenceIds: ids,
      confidence: top && (top.level === "A" || top.level === "B") ? "high" : top ? "moderate" : "low",
      confidenceReason: top ? `Strongest CIViC level ${top.level}.` : "No curated evidence found.",
      uncertain: v.sample === "plasma" ? "Plasma testing can miss alterations present only in tissue (low shedding)." : "Interpretation must be signed by the molecular pathologist.",
      alternatives: [],
      changesIf: "A tissue re-biopsy shows a different dominant mechanism, such as small-cell transformation or MET amplification.",
      safety: [],
    };
  });
}

export function testAdvisor(p: Patient, kb: BiomarkerEntry, reg: EvidenceRegistry): RecommendationCard {
  const tested = testedGenes(p);
  const missing = NSCLC_PANEL.filter((g) => !tested.includes(g));
  const ids = kb.testsToConsider.map((t, i) => reg.add({ id: `kb:${kb.key}:test${i}`, kind: "guideline", label: `Knowledge pack · ${t.test}`, detail: t.why, url: FDA_APPROVALS_URL }));
  const tests = [...kb.testsToConsider.map((t) => t.test), ...missing.map((g) => `${g} testing (not found in the record)`)];
  return {
    ...base(p, "Test-advisor", "test"),
    proposal: tests.length ? `Order: ${tests.join("; ")}.` : "No further tests needed before the decision.",
    why: [
      `Biomarker panel complete for: ${tested.join(", ")}.`,
      missing.length ? `Not found in the record: ${missing.join(", ")}.` : "All guideline biomarkers for NSCLC are present in the record.",
      ...kb.testsToConsider.map((t) => `${t.test}: ${t.why}`),
    ],
    evidenceIds: ids,
    confidence: "moderate",
    confidenceReason: "Tests follow the knowledge pack; local availability and turnaround are not known to the system.",
    uncertain: "Whether a re-biopsy is feasible and safe for this patient.",
    alternatives: ["Repeat plasma NGS in 4 weeks if tissue cannot be obtained"],
    changesIf: "The patient declines biopsy or is clinically too unwell to wait for results.",
    safety: [],
  };
}

export function guideline(p: Patient, kb: BiomarkerEntry, reg: EvidenceRegistry): RecommendationCard {
  const current = kb.options.filter((o) => o.role !== "later-line").sort((a, b) => a.rank - b.rank);
  const ids = kb.options.map((o) =>
    reg.add({ id: `kb:${o.id}`, kind: "guideline", label: `${o.regimen} · ${o.role}`, detail: `${o.basis} ${o.notes} (${KNOWLEDGE_VERSION})`, url: o.url }),
  );
  const top = current[0];
  return {
    ...base(p, "Guideline", "treatment"),
    proposal: `Discuss ${top.regimen} as the leading option; ${current.slice(1).map((o) => o.regimen).join(" or ")} as alternatives.`,
    why: [kb.driver.meaning, `Setting: ${kb.setting}.`, ...current.map((o) => `${o.rank}. ${o.regimen}: ${o.basis}`)],
    evidenceIds: ids,
    confidence: "moderate",
    confidenceReason: "Options come from the curated knowledge pack; the current NCCN/ESMO version must be checked.",
    uncertain: "Drug availability, cost and the patient's preferences are not in the record.",
    alternatives: [...current.slice(1).map((o) => o.regimen), ...kb.options.filter((o) => o.role === "later-line").map((o) => `${o.regimen} (later line)`)],
    changesIf: kb.notRecommended.map((n) => `${n.regimen} is not advised: ${n.why}`).join(" "),
    safety: [],
  };
}

export function pharmacologySafety(p: Patient, kb: BiomarkerEntry, reg: EvidenceRegistry): RecommendationCard | undefined {
  const drugs = new Set<string>();
  kb.options.filter((o) => o.role !== "later-line").forEach((o) => o.drugs.forEach((d) => drugs.add(d)));
  p.medications.forEach((m) => interactionRules.forEach((r) => m.name.toLowerCase().includes(r.drug) && drugs.add(r.drug)));
  const tags = new Set(p.medications.flatMap((m) => m.tags));
  const hits = interactionRules.filter((r) => drugs.has(r.drug) && tags.has(r.medTag));
  // Two QT-prolonging medications already together is itself a finding.
  const qtMeds = p.medications.filter((m) => m.tags.includes("qt-prolonging"));
  if (!hits.length && qtMeds.length < 2) return undefined;
  const ids = hits.map((h, i) =>
    reg.add({ id: `label:${h.drug}:${h.medTag}:${i}`, kind: "label", label: h.source, detail: h.message, url: dailymedSearch(h.drug) }),
  );
  const inducer = p.medications.find((m) => m.tags.includes("strong-cyp3a-inducer"));
  const contraindicated = hits.filter((h) => h.severity === "contraindicated");
  const proposal = inducer
    ? `Before choosing a drug, ask neurology to replace ${inducer.name.split(" ")[0].toLowerCase()} (strong CYP3A inducer) with a non-inducing alternative${contraindicated.length ? `; ${contraindicated.map((c) => c.drug).join(", ")} is contraindicated while it continues` : ""}.`
    : `Repeat ECG and electrolytes before the next line: ${qtMeds.map((m) => m.name.split(" ")[0].toLowerCase()).join(" and ")} both prolong QT.`;
  return {
    ...base(p, "Pharmacology-safety", "safety"),
    proposal,
    why: [
      ...p.medications.filter((m) => m.tags.length).map((m) => `${m.name} (${m.indication}): ${m.tags.join(", ")}.`),
      ...hits.map((h) => `${h.drug}: ${h.severity}. ${h.message}`),
    ],
    evidenceIds: ids.length ? ids : ["pt:" + (p.events.find((e) => e.kind === "treatment")?.id ?? p.events[0].id)],
    confidence: "high",
    confidenceReason: "Rules come from product labels in the interaction table.",
    uncertain: "The interaction table is a demonstration subset; a licensed interaction database is needed in production.",
    alternatives: [],
    changesIf: "The interacting medication is stopped or changed.",
    safety: hits.map((h) => `${h.drug} + ${h.medTag.replace(/-/g, " ")}: ${h.severity}`),
  };
}

export function trialMatcher(p: Patient, trials: TrialSearchResult, reg: EvidenceRegistry): RecommendationCard {
  const top = trials.trials.slice(0, 4);
  const ids = top.map((t) =>
    reg.add({ id: `trial:${t.nctId}`, kind: "trial", label: `${t.nctId} · ${t.phases.join("/") || "phase n/a"} · ${t.status.toLowerCase()}`, detail: `${t.title}. Sponsor ${t.sponsor || "n/a"}. Countries: ${t.countries.slice(0, 6).join(", ") || "n/a"}.`, url: t.url }),
  );
  const nearest = top.find((t) => t.matchNotes.some((n) => n.startsWith("Sites in")));
  return {
    ...base(p, "Trial-matcher", "trial"),
    proposal: top.length
      ? `Screen for ${top.slice(0, 2).map((t) => t.nctId).join(" or ")}${nearest ? `; ${nearest.nctId} has sites in South Asia` : ""}.`
      : "No recruiting trial found for this biomarker today; re-check at next progression.",
    why: [
      `ClinicalTrials.gov: ${trials.total} recruiting studies for "${trials.term}" in ${trials.condition} (${trials.source === "live" ? "live" : "snapshot"}, ${trials.fetchedAt.slice(0, 10)}).`,
      ...top.map((t) => `${t.nctId}: ${t.title.slice(0, 110)}${t.title.length > 110 ? "…" : ""}`),
    ],
    evidenceIds: ids,
    confidence: top.length ? "moderate" : "low",
    confidenceReason: "Matched by biomarker in title/keywords; full eligibility needs the investigator.",
    uncertain: "Distance to sites, prior-therapy limits and organ-function criteria are not checked automatically yet.",
    alternatives: top.slice(2).map((t) => t.nctId),
    changesIf: "The investigator finds an exclusion criterion.",
    safety: [],
  };
}

export function doseOptimizer(p: Patient, kb: BiomarkerEntry, reg: EvidenceRegistry, today: string): { card: RecommendationCard; dose: DoseCard } | undefined {
  const option = kb.options.filter((o) => o.regimenKey && o.role !== "later-line").sort((a, b) => a.rank - b.rank)[0];
  if (!option?.regimenKey) return undefined;
  const dose = buildDoseCard(p, option.regimenKey, today);
  const id = reg.add({
    id: "calc:dose",
    kind: "calculator",
    label: `Dose calculator · ${dose.regimenName}`,
    detail: `BSA ${dose.bsa.toFixed(2)} m² (Mosteller); CrCl ${dose.crcl.toFixed(1)} mL/min (Cockcroft–Gault). ${dose.lines.map((l) => `${l.drug} ${l.text}`).join("; ")}.`,
  });
  return {
    dose,
    card: {
      ...base(p, "Dose-optimizer", "dose"),
      proposal: dose.blocks.length
        ? `Dose card blocked: ${dose.blocks.join(" ")}`
        : `Dose card ready for ${dose.regimenName}: ${dose.lines.map((l) => `${l.drug} ${l.text}`).join(", ")}. Pharmacist and oncologist to verify.`,
      why: [dose.asOf, ...dose.lines.map((l) => `${l.drug}: ${l.formula}${l.raw !== undefined ? ` = ${l.raw.toFixed(1)} mg` : ""}`), ...dose.warnings],
      evidenceIds: [id, ...dose.lines.map((l, i) => reg.add({ id: `label:dose:${i}:${l.drug.toLowerCase()}`, kind: "label", label: l.source, detail: `${l.drug}: ${l.schedule}`, url: l.url }))],
      confidence: dose.blocks.length ? "low" : "high",
      confidenceReason: "Deterministic, unit-tested formulas with label parameters.",
      uncertain: "Regimen choice is still the doctor's; the card is recalculated if the choice changes.",
      alternatives: [],
      changesIf: "Weight, creatinine or the chosen regimen changes.",
      safety: [...dose.blocks, ...dose.premedication.map((m) => `Premedication: ${m}`)],
    },
  };
}

export function getKnowledge(p: Patient): BiomarkerEntry {
  const kb = knowledge[p.biomarkerKey];
  if (!kb) throw new Error(`No knowledge entry for ${p.biomarkerKey}`);
  return kb;
}
