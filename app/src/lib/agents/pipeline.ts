import type { AgentRunResult, Patient, RecommendationCard } from "../types";
import { interpretVariant, type CivicResult } from "../tools/civic";
import { searchTrials } from "../tools/trials";
import { interactionRules } from "../data/knowledge";
import type { DoseCard } from "../clinical/dose";
import { EvidenceRegistry, doseOptimizer, genomicInterpreter, getKnowledge, guideline, patientEvidence, pharmacologySafety, sentinel, testAdvisor, trialMatcher } from "./rules";
import { criticCheck } from "./critic";
import { hasClaude, MODEL, synthesise } from "./claude";

export type StepEvent = AgentRunResult["steps"][number];

export interface PipelineOptions {
  useClaude: boolean;
  today?: string;
  onStep?: (step: StepEvent) => void;
}

export interface PipelineResult extends AgentRunResult {
  dose?: DoseCard;
}

// Orchestrator: runs the specialist agents in order, then the synthesis agent, then the safety-critic.
export async function runPipeline(p: Patient, opts: PipelineOptions): Promise<PipelineResult> {
  const today = opts.today ?? p.asOf ?? new Date().toISOString().slice(0, 10);
  const steps: StepEvent[] = [];
  const warnings: string[] = [];
  const reg = new EvidenceRegistry();
  const cards: RecommendationCard[] = [];

  async function step<T>(agent: string, fn: () => Promise<T> | T, note: (r: T) => string): Promise<T | undefined> {
    const t0 = Date.now();
    try {
      const r = await fn();
      const s: StepEvent = { agent, status: "done", note: note(r), ms: Date.now() - t0 };
      steps.push(s);
      opts.onStep?.(s);
      return r;
    } catch (e) {
      const s: StepEvent = { agent, status: "error", note: (e as Error).message, ms: Date.now() - t0 };
      steps.push(s);
      opts.onStep?.(s);
      warnings.push(`${agent}: ${(e as Error).message}`);
      return undefined;
    }
  }

  const kb = getKnowledge(p);
  patientEvidence(p, reg);

  const s = await step("Sentinel", () => sentinel(p, reg), (c) => c.proposal);
  if (s) cards.push(s);

  const civic = await step(
    "Genomic-interpreter",
    async () => Promise.all(p.variants.map((v) => interpretVariant(v.gene, v.alteration))),
    (r: CivicResult[]) => `${r.length} variant(s) checked in CIViC (${r.map((x) => x.source).join(", ")})`,
  );
  if (civic) cards.push(...genomicInterpreter(p, civic, reg));

  const t = await step("Test-advisor", () => testAdvisor(p, kb, reg), (c) => c.proposal);
  if (t) cards.push(t);

  const g = await step("Guideline", () => guideline(p, kb, reg), (c) => c.proposal);
  if (g) cards.push(g);

  const ph = await step("Pharmacology-safety", () => pharmacologySafety(p, kb, reg), (c) => (c ? c.proposal : "No interaction found"));
  if (ph) cards.push(ph);

  const trials = await step("Trial-matcher", () => searchTrials(p.trialQuery.condition, p.trialQuery.term), (r) => `${r.total} recruiting studies (${r.source})`);
  if (trials) cards.push(trialMatcher(p, trials, reg));

  const d = await step("Dose-optimizer", () => doseOptimizer(p, kb, reg, today), (r) => (r ? r.card.proposal : "No calculable regimen"));
  if (d) cards.push(d.card);

  let mode: AgentRunResult["mode"] = "rules-only";
  let boardSummary: string | undefined;
  let model: string | undefined;
  let usage: AgentRunResult["usage"];

  if (opts.useClaude && hasClaude()) {
    const syn = await step(
      "Synthesis (Claude)",
      () => synthesise(p, reg.list(), cards),
      (r) => `${r.synthesis.cards.length} card(s) and a tumour-board summary from ${r.model}`,
    );
    if (syn) {
      mode = "claude";
      model = syn.model;
      usage = syn.usage;
      boardSummary = syn.synthesis.boardSummary;
      const claudeCards: RecommendationCard[] = syn.synthesis.cards.map((c, i) => ({
        id: `${p.id}-claude-${Date.now().toString(36)}-${i}`,
        patientId: p.id,
        agent: "Synthesis (Claude)",
        origin: "claude",
        critic: { verdict: "pass", notes: [] },
        ...c,
      }));
      cards.unshift(...claudeCards);
    }
  } else {
    steps.push({ agent: "Synthesis (Claude)", status: "skipped", note: hasClaude() ? "Rules-only run requested" : "No API key configured", ms: 0 });
    opts.onStep?.(steps[steps.length - 1]);
  }

  if (!boardSummary) {
    boardSummary = `${p.id}: ${p.age}-year-old ${p.sex === "F" ? "woman" : "man"}, ${p.histology.toLowerCase()}, stage ${p.stage}. ${p.variants.map((v) => `${v.gene} ${v.alteration}`).join(", ")}. ${p.question} Leading option from the knowledge pack: ${kb.options[0].regimen}.`;
  }

  const knownTrials = new Set((trials?.trials ?? []).map((x) => x.nctId));
  const tags = new Set(p.medications.flatMap((m) => m.tags));
  const contraindicated = new Set(interactionRules.filter((r) => r.severity === "contraindicated" && tags.has(r.medTag)).map((r) => r.drug));
  const t0 = Date.now();
  const checked = cards.map((c) => criticCheck(c, reg, { biomarkerKey: p.biomarkerKey, knownTrials, contraindicated }));
  const flagged = checked.filter((c) => c.critic.verdict === "flag").length;
  const criticStep: StepEvent = { agent: "Safety-critic", status: "done", note: `${checked.length} cards checked, ${flagged} flagged`, ms: Date.now() - t0 };
  steps.push(criticStep);
  opts.onStep?.(criticStep);

  return {
    patientId: p.id,
    ranAt: new Date().toISOString(),
    mode,
    model: mode === "claude" ? model ?? MODEL : undefined,
    steps,
    evidence: reg.list(),
    cards: checked,
    boardSummary,
    warnings,
    usage,
    dose: d?.dose,
  };
}
