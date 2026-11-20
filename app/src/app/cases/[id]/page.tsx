import { CaseView } from "@/components/CaseView";

export const metadata = { title: "Case · OncoAgent" };

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CaseView id={id} />;
}
