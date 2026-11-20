import { createHash } from "node:crypto";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { getPatient, patients } from "../data/patients";
import { interpretVariant } from "../tools/civic";
import { searchTrials } from "../tools/trials";
import { buildDoseCard } from "../clinical/dose";
import { regimens } from "../data/regimens";
import { assessRecist } from "../clinical/recist";
import { runPipeline } from "../agents/pipeline";
import { allow, MCP_CLAUDE_RUNS_PER_HOUR } from "../ratelimit";
import type { Patient } from "../types";

// oncoagent-mcp: the platform's tools, served over stdio and Streamable HTTP from one definition.
export const SERVER_INFO = { name: "oncoagent-mcp", version: "0.1.0" };

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}

// In-memory hash chain for decisions signed through MCP (per server instance; the web app keeps its own log).
const chain: { seq: number; at: string; cardId: string; patientId: string; action: string; reason: string; prevHash: string; hash: string }[] = [];

export function registerOncoTools(server: McpServer) {
  server.registerTool(
    "list_patients",
    { title: "List patients", description: "List the fictional NSCLC patients available in this demo with their current clinical question.", inputSchema: z.object({}) },
    async () => text(patients.map((p) => ({ id: p.id, status: p.status, stage: p.stage, drivers: p.variants.map((v) => `${v.gene} ${v.alteration}`), question: p.question }))),
  );

  server.registerTool(
    "get_case_timeline",
    {
      title: "Get case timeline",
      description: "Return a patient's de-identified timeline: events, therapy lines, RECIST 1.1 assessments and ctDNA. Fictional data only.",
      inputSchema: z.object({ patient_id: z.string().describe("Patient ID, e.g. P-001") }),
    },
    async ({ patient_id }) => {
      const p = getPatient(patient_id);
      if (!p) return { ...text(`Unknown patient ${patient_id}. Use list_patients.`), isError: true };
      return text({
        id: p.id,
        ageBand: `${Math.floor(p.age / 10) * 10}s`,
        sex: p.sex,
        histology: p.histology,
        stage: p.stage,
        ecog: p.ecog,
        pdl1Tps: p.pdl1Tps,
        variants: p.variants,
        therapyLines: p.therapyLines,
        events: p.events,
        recist: assessRecist(p.recist),
        ctdna: p.ctdna,
        medications: p.medications.map((m) => ({ name: m.name, tags: m.tags })),
      });
    },
  );

  server.registerTool(
    "interpret_variant",
    {
      title: "Interpret variant",
      description: "Look up curated clinical evidence for a tumour alteration in CIViC (CC0). Returns lung-cancer evidence items with level, significance, therapies and PubMed IDs.",
      inputSchema: z.object({ gene: z.string().describe("HGNC gene symbol, e.g. EGFR"), alteration: z.string().describe("Protein change or fusion, e.g. L858R, C797S, G12C, EML4::ALK") }),
    },
    async ({ gene, alteration }) => text(await interpretVariant(gene, alteration)),
  );

  server.registerTool(
    "search_trials",
    {
      title: "Search recruiting trials",
      description: "Search ClinicalTrials.gov (API v2) for recruiting studies by condition and biomarker. Returns NCT IDs, phases, sponsors and countries.",
      inputSchema: z.object({
        condition: z.string().default("non-small cell lung cancer"),
        biomarker: z.string().describe("Biomarker or keyword, e.g. EGFR C797S"),
        max_results: z.number().int().min(1).max(20).default(6),
      }),
    },
    async ({ condition, biomarker, max_results }) => text(await searchTrials(condition, biomarker, max_results)),
  );

  server.registerTool(
    "calculate_dose",
    {
      title: "Calculate dose",
      description: `Deterministic, unit-tested dose calculation (Mosteller BSA, Cockcroft–Gault, Calvert with GFR capped at 125). Regimens: ${Object.keys(regimens).join(", ")}. Output must be verified by a pharmacist and an oncologist.`,
      inputSchema: z.object({
        regimen: z.enum(Object.keys(regimens) as [string, ...string[]]),
        height_cm: z.number().positive(),
        weight_kg: z.number().positive(),
        age: z.number().int().min(18).max(110),
        sex: z.enum(["F", "M"]),
        serum_creatinine_mg_dl: z.number().positive(),
        creatinine_date: z.string().describe("ISO date of the creatinine result"),
        today: z.string().optional().describe("ISO date used for the freshness check; defaults to today"),
      }),
    },
    async (a) => {
      const pseudo = { id: "MCP", age: a.age, sex: a.sex, heightCm: a.height_cm, weightKg: a.weight_kg, serumCreatinineMgDl: a.serum_creatinine_mg_dl, creatinineDate: a.creatinine_date } as unknown as Patient;
      return text(buildDoseCard(pseudo, a.regimen, a.today ?? new Date().toISOString().slice(0, 10)));
    },
  );

  server.registerTool(
    "draft_recommendations",
    {
      title: "Draft recommendations",
      description: "Run the OncoAgent specialist agents and the safety-critic for a patient and return recommendation cards with evidence IDs. Cards are drafts: a clinician must approve, modify or reject each one.",
      inputSchema: z.object({ patient_id: z.string(), use_claude: z.boolean().default(false).describe("Add the Claude synthesis step (needs ANTHROPIC_API_KEY on the server)") }),
    },
    async ({ patient_id, use_claude }) => {
      const p = getPatient(patient_id);
      if (!p) return { ...text(`Unknown patient ${patient_id}.`), isError: true };
      let useClaude = use_claude;
      let note: string | undefined;
      if (useClaude && !allow("mcp:claude", MCP_CLAUDE_RUNS_PER_HOUR, 60 * 60 * 1000).ok) {
        useClaude = false;
        note = `Claude synthesis is limited to ${MCP_CLAUDE_RUNS_PER_HOUR} runs per hour on the public endpoint; this run used the rules-only agents.`;
      }
      const r = await runPipeline(p, { useClaude });
      return text({
        patientId: r.patientId,
        mode: r.mode,
        ...(note ? { note } : {}),
        boardSummary: r.boardSummary,
        cards: r.cards.map((c) => ({ id: c.id, agent: c.agent, kind: c.kind, proposal: c.proposal, evidenceIds: c.evidenceIds, confidence: c.confidence, critic: c.critic })),
        evidence: r.evidence.map((e) => ({ id: e.id, label: e.label, url: e.url })),
        dose: r.dose,
      });
    },
  );

  server.registerTool(
    "record_decision",
    {
      title: "Record clinician decision",
      description: "Sign a clinician decision (approve, modify, reject) on a card into a hash-chained log. Requires a clinician session token; an AI agent cannot sign on its own.",
      inputSchema: z.object({
        patient_id: z.string(),
        card_id: z.string(),
        action: z.enum(["approve", "modify", "reject"]),
        reason: z.string().min(5).describe("Required for modify and reject; recommended for approve"),
        clinician_token: z.string().describe("Session token issued to a signed-in clinician"),
      }),
    },
    async (a) => {
      const expected = process.env.CLINICIAN_TOKEN;
      if (!expected || a.clinician_token !== expected) {
        return { ...text("Refused: decisions can only be signed with a valid clinician session token. The AI proposes; a clinician decides."), isError: true };
      }
      const prevHash = chain.length ? chain[chain.length - 1].hash : "0".repeat(64);
      const entry = { seq: chain.length + 1, at: new Date().toISOString(), cardId: a.card_id, patientId: a.patient_id, action: a.action, reason: a.reason, prevHash };
      const hash = createHash("sha256").update(JSON.stringify(entry)).digest("hex");
      chain.push({ ...entry, hash });
      return text({ ...entry, hash });
    },
  );
}
