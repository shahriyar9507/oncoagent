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
  if (!p.recist.length) {
    const imaging = p.events.filter((e) => e.kind === "imaging" || e.kind === "pathology").slice(-1)[0] ?? p.events[0];
    return {
      ...base(p, "Sentinel", "monitoring"),
      proposal: "Record baseline target-lesion measurements (RECIST 1.1) from the latest CT before treatment starts.",
      why: ["No tumour measurements are in the record, so response cannot be assessed later.", `ECOG ${p.ecog}.`],
      evidenceIds: imaging ? [`pt:${imaging.id}`] : [],
      confidence: "high",
      confidenceReason: "RECIST 1.1 needs a baseline sum of target lesions.",
      uncertain: "Whether measurable disease exists (at least one lesion ≥ 10 mm, or a lymph node ≥ 15 mm short axis).",
      alternatives: [],
      changesIf: "The radiology report already lists target lesions; enter them to enable response tracking.",
      safety: [],
    };
  }
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
      confidenceReason: last.newLesions
        ? last.changeFromNadirPct >= 20 && last.sumMm - last.nadirMm >= 5
          ? "Both RECIST criteria are met: ≥ 20% and ≥ 5 mm growth from nadir, and a new lesion."
          : "A new lesion alone meets RECIST 1.1 progression."
        : "Growth of ≥ 20% and ≥ 5 mm from nadir meets RECIST 1.1 progression.",
      uncertain: last.newLesions ? "Radiologist confirmation of the new lesion is pending in this record." : "Confirm that the same target lesions were measured on both scans.",
      alternatives: ["Repeat imaging in 4–6 weeks if the finding is equivocal"],
      changesIf: last.newLesions ? "The radiologist reclassifies the new lesion as benign and growth stays below 20%." : "Re-measurement brings growth below 20% or 5 mm from nadir.",
      safety: [],
    };
  }
  if (a.length > 1) {
    return {
      ...base(p, "Sentinel", "monitoring"),
      proposal: `Response is ${last.category} by RECIST 1.1 (${last.changeFromBaselinePct.toFixed(0)}% from baseline); continue the planned scan interval.`,
      why: [
        `Latest sum of target lesions ${last.sumMm} mm on ${last.date}; baseline ${a[0].sumMm} mm; nadir ${last.nadirMm} mm.`,
        `Best response so far: ${bestResponse(a) ?? "not assessable"}.`,
        `ECOG ${p.ecog}.`,
      ],
      evidenceIds: ev,
      confidence: "high",
      confidenceReason: "Calculated from the measurements in the record with RECIST 1.1 thresholds.",
      uncertain: "Non-target lesions and symptoms are not part of this calculation.",
      alternatives: [],
      changesIf: "A new lesion appears or growth reaches 20% and 5 mm from nadir.",
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

/** Common NSCLC co-mutations with no matched drug: prognostic, not a treatment driver. */
const CO_MUTATIONS = new Set(["TP53", "STK11", "KEAP1", "SMARCA4", "CDKN2A", "PIK3CA", "NF1", "RB1"]);

/** "EGFR L858R", but "CD74::ROS1" rather than "ROS1 CD74::ROS1". */
function variantLabel(v: { gene: string; alteration: string }): string {
  return v.alteration.toUpperCase().includes(v.gene.toUpperCase()) ? v.alteration : `${v.gene} ${v.alteration}`;
}

export function genomicInterpreter(p: Patient, civic: CivicResult[], reg: EvidenceRegistry): RecommendationCard[] {
  return p.variants.map((v) => {
    const name = variantLabel(v);
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
      proposal = `${name} is an acquired resistance alteration: record it as the cause of progression on the current ${v.gene} inhibitor.`;
    } else if (CO_MUTATIONS.has(v.gene.toUpperCase())) {
      proposal = `${name} is a co-mutation without a matched drug: record as prognostic, not actionable.`;
    } else if (sensitivity.length) {
      proposal = `${name} is the actionable driver: confirm and sign the molecular interpretation.`;
    } else if (prognostic.length) {
      proposal = `${name} is a co-mutation without a matched drug: record as prognostic, not actionable.`;
    } else {
      proposal = `${name}: review the evidence before calling it actionable.`;
    }
    return {
      ...base(p, "Genomic-interpreter", "summary"),
      proposal,
      why: [
        `${name}${v.hgvsP ? ` (${v.hgvsP})` : ""}, ${v.sample}${v.vafPercent !== undefined ? `, VAF ${v.vafPercent}%` : ""}, reported ${v.reportedOn}.`,
        r && r.source !== "none" && r.profileName
          ? `CIViC ${r.profileName}: ${r.totalEvidence} evidence items, ${r.lungEvidence.length} in lung cancer${top ? `; strongest level ${top.level}` : ""} (${r.source === "live" ? "live" : "snapshot"}).`
          : r && r.source !== "none"
            ? `CIViC has no curated profile for ${name} (${r.source === "live" ? "live" : "snapshot"}).`
            : "CIViC could not be reached and no snapshot exists for this profile.",
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

export function testAdvisor(p: Patient, kb: BiomarkerEntry | null, reg: EvidenceRegistry): RecommendationCard {
  const tested = testedGenes(p);
  const missing = NSCLC_PANEL.filter((g) => !tested.includes(g));
  const packTests = kb?.testsToConsider ?? [];
  const ids = packTests.map((t, i) => reg.add({ id: `kb:${kb!.key}:test${i}`, kind: "guideline", label: `Knowledge pack · ${t.test}`, detail: t.why, url: FDA_APPROVALS_URL }));
  // Patient-specific checks from the medication list, unless the pack entry already asks for them.
  const extra: { test: string; why: string }[] = [];
  const qtMeds = p.medications.filter((m) => m.tags.includes("qt-prolonging"));
  if (qtMeds.length && !packTests.some((t) => /ECG/i.test(t.test))) extra.push({ test: "Baseline ECG with potassium and magnesium", why: `${qtMeds.map((m) => m.name.split(" ")[0]).join(", ")} prolong${qtMeds.length > 1 ? "" : "s"} QT; several targeted drugs do too.` });
  const inducer = p.medications.find((m) => m.tags.includes("strong-cyp3a-inducer"));
  if (inducer && !packTests.some((t) => /inducer|antiseizure/i.test(t.why + t.test))) extra.push({ test: `Medication review of ${inducer.name.split(" ")[0].toLowerCase()}`, why: "Strong CYP3A inducers lower the exposure of most targeted drugs; some are contraindicated." });
  const recordIds = p.events.filter((e) => e.kind === "molecular" || e.kind === "pathology").map((e) => `pt:${e.id}`);
  const tests = [...packTests.map((t) => t.test), ...extra.map((t) => t.test), ...missing.map((g) => `${g} testing (not found in the record)`)];
  const biopsy = tests.some((t) => /biops/i.test(t));
  return {
    ...base(p, "Test-advisor", "test"),
    proposal: tests.length ? `Order: ${tests.join("; ")}.` : "No further tests needed before the decision.",
    why: [
      `Biomarker panel complete for: ${tested.join(", ")}.`,
      missing.length ? `Not found in the record: ${missing.join(", ")}.` : "All guideline biomarkers for NSCLC are present in the record.",
      ...packTests.map((t) => `${t.test}: ${t.why}`),
      ...extra.map((t) => `${t.test}: ${t.why}`),
    ],
    evidenceIds: ids.length ? [...ids, ...recordIds.slice(0, 2)] : recordIds.slice(0, 3),
    confidence: "moderate",
    confidenceReason: "Tests follow the knowledge pack and the medication list; local availability and turnaround are not known to the system.",
    uncertain: biopsy ? "Whether a re-biopsy is feasible and safe for this patient." : "Local test availability and turnaround time.",
    alternatives: biopsy ? ["Repeat plasma NGS in 4 weeks if tissue cannot be obtained"] : missing.length ? ["Plasma NGS if tissue is insufficient for the missing markers"] : [],
    changesIf: biopsy ? "The patient declines biopsy or is clinically too unwell to wait for results." : "Results arrive that change the driver or the line of therapy.",
    safety: [],
  };
}

/** Interaction rules that fire for this option given the patient's current medications. */
function optionHits(p: Patient, drugs: string[]) {
  const tags = new Set(p.medications.flatMap((m) => m.tags));
  return interactionRules.filter((r) => drugs.includes(r.drug) && tags.has(r.medTag) && r.severity !== "monitor");
}

export function guideline(p: Patient, kb: BiomarkerEntry | null, reg: EvidenceRegistry): RecommendationCard {
  if (!kb) {
    const ids = p.events.filter((e) => e.kind === "molecular" || e.kind === "pathology" || e.kind === "treatment").map((e) => `pt:${e.id}`);
    return {
      ...base(p, "Guideline", "treatment"),
      proposal: "Discuss at tumour board: the curated knowledge pack does not cover this setting, so no option is proposed automatically.",
      why: [p.knowledgeReason ?? "No knowledge-pack entry matches the driver and line of therapy.", `Variants: ${p.variants.map((v) => `${v.gene} ${v.alteration}`).join(", ") || "none reported"}.`, `Prior lines: ${p.therapyLines.map((l) => l.regimen).join("; ") || "none"}.`],
      evidenceIds: ids.slice(0, 4),
      confidence: "low",
      confidenceReason: "Outside the curated pack; the agents do not guess treatment options.",
      uncertain: "Which current NCCN/ESMO recommendation applies; check it directly.",
      alternatives: ["Clinical trial (see the Trial-matcher card)"],
      changesIf: "New biomarker results or a different line of therapy bring the case inside the pack.",
      safety: [],
    };
  }
  const current = kb.options.filter((o) => o.role !== "later-line").sort((a, b) => a.rank - b.rank);
  const ids = kb.options.map((o) =>
    reg.add({ id: `kb:${o.id}`, kind: "guideline", label: `${o.regimen} · ${o.role}`, detail: `${o.basis} ${o.notes} (${KNOWLEDGE_VERSION})`, url: o.url }),
  );
  // Rank options that clash with a current medication below safe ones and say why, so no card proposes a
  // contraindicated drug silently (the safety-critic still checks independently).
  // Only a contraindication moves an option down; "avoid" interactions keep the rank and are named on the card.
  const scored = current.map((o) => ({ o, hits: optionHits(p, o.drugs) }));
  const blocked = (x: (typeof scored)[number]) => x.hits.some((h) => h.severity === "contraindicated");
  const ordered = [...scored.filter((x) => !blocked(x)), ...scored.filter(blocked)];
  const label = (x: (typeof scored)[number]) =>
    x.hits.length ? `${x.o.regimen} (${x.hits.map((h) => `${h.severity} with current ${h.medTag.replace(/-/g, " ")}`).join("; ")})` : x.o.regimen;
  const top = ordered[0];
  const hitIds = scored.flatMap((x) => x.hits).map((h, i) => reg.add({ id: `label:${h.drug}:${h.medTag}:g${i}`, kind: "label", label: h.source, detail: h.message, url: dailymedSearch(h.drug) }));
  return {
    ...base(p, "Guideline", "treatment"),
    proposal: `Discuss ${label(top)} as the leading option${ordered.length > 1 ? `; ${ordered.slice(1).map(label).join(" or ")} as alternatives` : ""}.`,
    why: [kb.driver.meaning, `Setting: ${kb.setting}.`, ...current.map((o) => `${o.rank}. ${o.regimen}: ${o.basis}`), ...scored.flatMap((x) => x.hits.map((h) => `${x.o.regimen}: ${h.message}`))],
    evidenceIds: [...ids, ...hitIds],
    confidence: "moderate",
    confidenceReason: "Options come from the curated knowledge pack; the current NCCN/ESMO version must be checked.",
    uncertain: "Drug availability, cost and the patient's preferences are not in the record.",
    alternatives: [...ordered.slice(1).map(label), ...kb.options.filter((o) => o.role === "later-line").map((o) => `${o.regimen} (later line)`)],
    changesIf: kb.notRecommended.map((n) => `${n.regimen} is not advised: ${n.why}`).join(" "),
    safety: scored.flatMap((x) => x.hits.map((h) => `${h.drug} + ${h.medTag.replace(/-/g, " ")}: ${h.severity}`)),
  };
}

export function pharmacologySafety(p: Patient, kb: BiomarkerEntry | null, reg: EvidenceRegistry): RecommendationCard | undefined {
  const drugs = new Set<string>();
  kb?.options.filter((o) => o.role !== "later-line").forEach((o) => o.drugs.forEach((d) => drugs.add(d)));
  p.medications.forEach((m) => interactionRules.forEach((r) => m.name.toLowerCase().includes(r.drug) && drugs.add(r.drug)));
  const tags = new Set(p.medications.flatMap((m) => m.tags));
  const hits = interactionRules.filter((r) => drugs.has(r.drug) && tags.has(r.medTag));
  // Two QT-prolonging medications already together is itself a finding.
  const qtMeds = p.medications.filter((m) => m.tags.includes("qt-prolonging"));
  if (!hits.length && qtMeds.length < 2) return undefined;
  const ids = hits.map((h, i) =>
    reg.add({ id: `label:${h.drug}:${h.medTag}:${i}`, kind: "label", label: h.source, detail: h.message, url: dailymedSearch(h.drug) }),
  );
  const short = (name: string) => name.split(" ")[0].toLowerCase();
  const medWith = (tag: string) => p.medications.find((m) => m.tags.includes(tag));
  const inducer = medWith("strong-cyp3a-inducer");
  const inhibitor = medWith("strong-cyp3a-inhibitor");
  const acid = medWith("acid-reducing");
  const nsaid = medWith("nsaid");
  const contraindicated = hits.filter((h) => h.severity === "contraindicated");
  const drugsFor = (tag: string) => Array.from(new Set(hits.filter((h) => h.medTag === tag).map((h) => h.drug)));
  const owner = (indication: string) => (/seiz|epilep/i.test(indication) ? "neurology" : "the prescribing doctor");
  let proposal: string;
  if (inducer) {
    proposal = `Before choosing a drug, ask ${owner(inducer.indication)} to replace ${short(inducer.name)} (strong CYP3A inducer) with a non-inducing alternative${contraindicated.length ? `; ${contraindicated.map((c) => c.drug).join(", ")} is contraindicated while it continues` : ""}.`;
  } else if (inhibitor && drugsFor("strong-cyp3a-inhibitor").length) {
    proposal = `Review ${short(inhibitor.name)} (strong CYP3A inhibitor) before starting ${drugsFor("strong-cyp3a-inhibitor").join(" or ")}: exposure rises; avoid or adjust per label.`;
  } else if (acid && drugsFor("acid-reducing").length) {
    proposal = `Review ${short(acid.name)} (acid-reducing) before starting ${drugsFor("acid-reducing").join(" or ")}: absorption falls; follow the label's timing advice.`;
  } else if (qtMeds.length >= 2 || drugsFor("qt-prolonging").length) {
    proposal = qtMeds.length >= 2
      ? `Repeat ECG and electrolytes before the next line: ${qtMeds.map((m) => short(m.name)).join(" and ")} both prolong QT.`
      : `Check ECG and electrolytes before starting ${drugsFor("qt-prolonging").join(" or ")}: ${short(qtMeds[0].name)} also prolongs QT.`;
  } else if (nsaid && drugsFor("nsaid").length) {
    proposal = `Hold ${short(nsaid.name)} around pemetrexed doses when clearance is reduced, per label.`;
  } else {
    proposal = `Review interactions before the next line: ${hits.map((h) => `${h.drug} with ${h.medTag.replace(/-/g, " ")}`).join("; ")}.`;
  }
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

export function doseOptimizer(p: Patient, kb: BiomarkerEntry | null, reg: EvidenceRegistry, today: string): { card: RecommendationCard; dose: DoseCard } | undefined {
  if (!kb) return undefined;
  // Dose the leading option that is not contraindicated with a current medication.
  const option = kb.options
    .filter((o) => o.regimenKey && o.role !== "later-line")
    .sort((a, b) => Number(optionHits(p, a.drugs).some((h) => h.severity === "contraindicated")) - Number(optionHits(p, b.drugs).some((h) => h.severity === "contraindicated")) || a.rank - b.rank)[0];
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

export function getKnowledge(p: Patient): BiomarkerEntry | null {
  return (p.biomarkerKey && knowledge[p.biomarkerKey]) || null;
}
