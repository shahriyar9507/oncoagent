import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { EvidenceItem, Patient, RecommendationCard } from "../types";
import { assessRecist } from "../clinical/recist";

export const MODEL = "claude-opus-5-5";

const CardSchema = z.object({
  kind: z.enum(["treatment", "test", "monitoring", "safety"]),
  proposal: z.string().describe("One sentence the oncologist can act on. No doses."),
  why: z.array(z.string()).describe("Patient facts used, each short."),
  evidenceIds: z.array(z.string()).describe("Only IDs from the EVIDENCE list."),
  confidence: z.enum(["high", "moderate", "low"]),
  confidenceReason: z.string(),
  uncertain: z.string(),
  alternatives: z.array(z.string()),
  changesIf: z.string(),
  safety: z.array(z.string()),
});

const SynthesisSchema = z.object({
  boardSummary: z.string().describe("Tumour-board pre-read, 90–140 words, plain clinical English."),
  cards: z.array(CardSchema).describe("One to three cards: the treatment recommendation first, then at most two others."),
});

export type Synthesis = z.infer<typeof SynthesisSchema>;

const SYSTEM = `You are the synthesis agent inside OncoAgent, a clinical decision-support tool used only by oncologists and their clinical team.
You receive a de-identified lung cancer case, an EVIDENCE list with IDs, and draft findings from deterministic agents.

Rules you must follow:
- You propose; the doctor decides. Write proposals as suggestions for the clinician, never as orders.
- Use only facts in the case and the EVIDENCE list. Every card cites evidence by its exact ID. If something is not in the evidence, say it is not verified.
- Never write a drug dose, schedule or quantity. Doses come only from the separate dose calculator.
- Never invent drug names, trial numbers or citations. Mention a trial only by an NCT ID that appears in the EVIDENCE list.
- Respect setting: an option marked "later-line" is not a first-line recommendation; anything marked contraindicated must be called contraindicated.
- Be specific and brief. State what is uncertain and what would change the advice.`;

function caseContext(p: Patient) {
  const r = assessRecist(p.recist);
  return {
    patient: `${p.id} (pseudonymous)`,
    ageBand: `${Math.floor(p.age / 10) * 10}s`,
    sex: p.sex,
    smoking: p.smoking,
    diagnosis: `${p.diagnosis}, ${p.histology}`,
    stage: p.stage,
    ecog: p.ecog,
    pdl1Tps: p.pdl1Tps,
    variants: p.variants.map((v) => `${v.gene} ${v.alteration}${v.vafPercent !== undefined ? ` VAF ${v.vafPercent}%` : ""} (${v.sample}, ${v.reportedOn})`),
    therapyLines: p.therapyLines.map((t) => `Line ${t.line}: ${t.regimen}, ${t.start} to ${t.end ?? "ongoing"}, best response ${t.bestResponse ?? "n/a"}${t.stopReason ? `, stopped for ${t.stopReason}` : ""}`),
    recist: r.map((x) => `${x.date} ${x.sumMm} mm ${x.category}`),
    ctdna: p.ctdna.map((c) => `${c.date} ${c.marker} ${c.vafPercent === null ? "not detected" : c.vafPercent + "%"}`),
    medications: p.medications.map((m) => `${m.name} (${m.tags.join(", ") || "no interaction tags"})`),
    question: p.question,
  };
}

export function hasClaude(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function synthesise(p: Patient, evidence: EvidenceItem[], drafts: RecommendationCard[]) {
  const client = new Anthropic();
  const payload = {
    CASE: caseContext(p),
    EVIDENCE: evidence.map((e) => ({ id: e.id, kind: e.kind, label: e.label, detail: e.detail })),
    DRAFT_FINDINGS: drafts.map((d) => ({ agent: d.agent, kind: d.kind, proposal: d.proposal, evidenceIds: d.evidenceIds })),
  };
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(SynthesisSchema) },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `Prepare the tumour-board synthesis for this case.\n\n${JSON.stringify(payload, null, 1)}` }],
  });
  if (response.stop_reason === "refusal") throw new Error("The model declined this request.");
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("The model returned no structured output.");
  return {
    synthesis: parsed as Synthesis,
    model: response.model,
    usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
  };
}
