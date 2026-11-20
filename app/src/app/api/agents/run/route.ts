import { getPatient } from "@/lib/data/patients";
import { runPipeline } from "@/lib/agents/pipeline";
import { CASE_ID_PATTERN, CaseInputSchema, buildPatientFromInput } from "@/lib/caseInput";
import type { Patient } from "@/lib/types";
import { allow, CLAUDE_RUNS_PER_IP, CLAUDE_WINDOW_MS } from "@/lib/ratelimit";
import { hasClaude } from "@/lib/agents/claude";
import { clientIp, requireUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { appendAuditRow, saveRunRow } from "@/lib/server/store";
import { log } from "@/lib/server/log";

// Runs the agent pipeline for one patient and streams each finished step as a line of JSON.
// With server storage configured, the finished run and an "agent-run" audit entry are saved for the signed-in user.
export const maxDuration = 300;

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (user instanceof Response) return user;

  let body: { patientId?: string; caseId?: string; caseInput?: unknown; useClaude?: boolean };
  try {
    const text = await req.text();
    if (text.length > 256 * 1024) return Response.json({ error: "Body too large" }, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  let p: Patient | undefined;
  if (body.caseInput !== undefined) {
    // Clinician-entered case: validate, then rebuild the record on the server (never trust a client-built record).
    if (!body.caseId || !CASE_ID_PATTERN.test(body.caseId)) return Response.json({ error: "Invalid caseId" }, { status: 400 });
    const parsed = CaseInputSchema.safeParse(body.caseInput);
    if (!parsed.success) {
      return Response.json({ error: "Invalid case", issues: parsed.error.issues.slice(0, 8).map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
    }
    p = buildPatientFromInput(parsed.data, body.caseId);
  } else {
    p = body.patientId ? getPatient(body.patientId) : undefined;
    if (!p) return Response.json({ error: "Unknown patientId" }, { status: 404 });
  }
  const patient = p;

  const useClaude = body.useClaude !== false;
  if (useClaude && hasClaude()) {
    const gate = allow(`run:${user.sub}:${clientIp(req)}`, CLAUDE_RUNS_PER_IP, CLAUDE_WINDOW_MS);
    if (!gate.ok) {
      log("warn", "run.rate_limited", { user: user.sub });
      return Response.json(
        { error: `Live Claude runs are limited to ${CLAUDE_RUNS_PER_IP} per 10 minutes. Try again in ${Math.ceil(gate.retryInS / 60)} min, or run the rules-only agents now` },
        { status: 429, headers: { "retry-after": String(gate.retryInS) } },
      );
    }
  }

  const enc = new TextEncoder();
  const t0 = Date.now();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));
      try {
        const result = await runPipeline(patient, { useClaude, onStep: (step) => send({ type: "step", step }) });
        let persisted = false;
        try {
          const db = await getDb();
          if (db) {
            await saveRunRow(db, user.sub, result);
            await appendAuditRow(db, user.sub, { actor: user.name, action: "agent-run", patientId: patient.id, reasonText: result.mode === "claude" ? "Live run with Claude synthesis" : "Live rules-only run" });
            persisted = true;
          }
        } catch (e) {
          log("error", "run.persist_failed", { user: user.sub, patientId: patient.id, message: (e as Error).message });
        }
        log("info", "run.finished", { user: user.sub, patientId: patient.id, mode: result.mode, cards: result.cards.length, flagged: result.cards.filter((c) => c.critic.verdict === "flag").length, ms: Date.now() - t0, persisted });
        send({ type: "result", result, persisted });
      } catch (e) {
        log("error", "run.failed", { user: user.sub, patientId: patient.id, message: (e as Error).message });
        send({ type: "error", message: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
