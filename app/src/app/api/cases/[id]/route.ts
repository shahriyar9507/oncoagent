import { z } from "zod";
import { CASE_ID_PATTERN, CaseInputSchema } from "@/lib/caseInput";
import { deleteCaseRow, getCaseRow, upsertCase } from "@/lib/server/store";
import { fail, json, readJson, withStore } from "@/lib/server/api";
import { log } from "@/lib/server/log";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!CASE_ID_PATTERN.test(id)) return fail(400, "Invalid case ID");
  return withStore(req, "cases.get", async ({ user, db }) => {
    const row = await getCaseRow(db, user.sub, id);
    return row ? json({ case: row }) : fail(404, "Case not found");
  });
}

const Body = z.object({ input: CaseInputSchema });

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!CASE_ID_PATTERN.test(id)) return fail(400, "Invalid case ID");
  return withStore(req, "cases.update", async ({ user, db }) => {
    let input;
    try {
      const parsed = Body.safeParse(await readJson(req));
      if (!parsed.success) return fail(400, "Invalid case", { issues: parsed.error.issues.slice(0, 8).map((i) => `${i.path.join(".")}: ${i.message}`) });
      input = parsed.data.input;
    } catch {
      return fail(400, "Invalid JSON body");
    }
    try {
      const row = await upsertCase(db, user.sub, id, input);
      log("info", "case.updated", { user: user.sub, id });
      return json({ case: row });
    } catch (e) {
      if ((e as Error).message === "Case ID already in use") return fail(409, "Case ID already in use");
      throw e;
    }
  });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!CASE_ID_PATTERN.test(id)) return fail(400, "Invalid case ID");
  return withStore(req, "cases.delete", async ({ user, db }) => {
    const ok = await deleteCaseRow(db, user.sub, id);
    log("info", "case.deleted", { user: user.sub, id, found: ok });
    return ok ? json({ ok: true }) : fail(404, "Case not found");
  });
}
