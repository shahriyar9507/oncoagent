import { deleteRunRow } from "@/lib/server/store";
import { PATIENT_ID, fail, json, withStore } from "@/lib/server/api";

// Discard the latest live run for a patient (the stored demo run or an empty case is shown again).
export const dynamic = "force-dynamic";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!PATIENT_ID.test(id)) return fail(400, "Invalid patient ID");
  return withStore(req, "runs.delete", async ({ user, db }) => {
    await deleteRunRow(db, user.sub, id);
    return json({ ok: true });
  });
}
