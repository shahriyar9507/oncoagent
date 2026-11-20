import { CaseForm } from "@/components/CaseForm";
import { ClientOnly } from "@/components/ClientOnly";
import { CASE_ID_PATTERN } from "@/lib/caseInput";

export const metadata = { title: "New case · OncoAgent" };

export default async function NewCasePage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const editId = edit && CASE_ID_PATTERN.test(edit) ? edit : undefined;
  return (
    <ClientOnly fallback={<p className="empty">Loading the case form…</p>}>
      <CaseForm key={editId ?? "new"} editId={editId} />
    </ClientOnly>
  );
}
