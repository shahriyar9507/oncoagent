import { z } from "zod";
import { appendAuditRow, listAudit, verifyChain } from "@/lib/server/store";
import { PATIENT_ID, fail, json, readJson, withStore } from "@/lib/server/api";
import { log } from "@/lib/server/log";

// Append-only, hash-chained audit log for the signed-in user. The actor is always the session user;
// the client cannot choose who signed.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withStore(req, "audit.list", async ({ user, db }) => {
    const entries = await listAudit(db, user.sub);
    return json({ entries, chainOk: verifyChain(entries) });
  });
}

const Body = z.object({
  action: z.enum(["approve", "modify", "reject", "agent-run"]),
  patientId: z.string().regex(PATIENT_ID),
  cardId: z.string().max(120).optional(),
  reasonCode: z.string().max(120).optional(),
  reasonText: z.string().max(1000).optional(),
});

export async function POST(req: Request) {
  return withStore(req, "audit.append", async ({ user, db }) => {
    let body: z.infer<typeof Body>;
    try {
      const parsed = Body.safeParse(await readJson(req, 16 * 1024));
      if (!parsed.success) return fail(400, "Invalid audit entry", { issues: parsed.error.issues.slice(0, 6).map((i) => `${i.path.join(".")}: ${i.message}`) });
      body = parsed.data;
    } catch {
      return fail(400, "Invalid JSON body");
    }
    if (body.action !== "agent-run" && !body.cardId) return fail(400, "A decision needs a cardId");
    if ((body.action === "modify" || body.action === "reject") && (body.reasonText ?? "").trim().length < 5) return fail(400, "A reason of at least 5 characters is required");
    const entry = await appendAuditRow(db, user.sub, { actor: user.name, ...body });
    log("info", "audit.appended", { user: user.sub, seq: entry.seq, action: entry.action, patientId: entry.patientId });
    return json({ entry }, 201);
  });
}
