import { getRuns } from "@/lib/server/store";
import { PATIENT_ID, fail, json, withStore } from "@/lib/server/api";

// Latest live agent runs for the signed-in user: GET /api/runs?ids=P-001,C-7K2M9Q
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length > 200 || ids.some((id) => !PATIENT_ID.test(id))) return fail(400, "Invalid ids");
  return withStore(req, "runs.list", async ({ user, db }) => json({ runs: await getRuns(db, user.sub, ids) }));
}
