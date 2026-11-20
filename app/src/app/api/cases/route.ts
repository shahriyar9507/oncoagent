import { z } from "zod";
import { CASE_ID_PATTERN, CaseInputSchema, newCaseId } from "@/lib/caseInput";
import { listCases, upsertCase } from "@/lib/server/store";
import { fail, json, readJson, withStore } from "@/lib/server/api";
import { log } from "@/lib/server/log";

// Clinician-entered cases for the signed-in user.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withStore(req, "cases.list", async ({ user, db }) => json({ cases: await listCases(db, user.sub) }));
}

const Body = z.object({ id: z.string().regex(CASE_ID_PATTERN).optional(), input: CaseInputSchema });

export async function POST(req: Request) {
  return withStore(req, "cases.create", async ({ user, db }) => {
    let body: z.infer<typeof Body>;
    try {
      const parsed = Body.safeParse(await readJson(req));
      if (!parsed.success) return fail(400, "Invalid case", { issues: parsed.error.issues.slice(0, 8).map((i) => `${i.path.join(".")}: ${i.message}`) });
      body = parsed.data;
    } catch {
      return fail(400, "Invalid JSON body");
    }
    try {
      const row = await upsertCase(db, user.sub, body.id ?? newCaseId(), body.input);
      log("info", "case.saved", { user: user.sub, id: row.id });
      return json({ case: row }, 201);
    } catch (e) {
      if ((e as Error).message === "Case ID already in use") return fail(409, "Case ID already in use");
      throw e;
    }
  });
}
