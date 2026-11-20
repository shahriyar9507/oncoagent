import { CaseReport } from "@/components/CaseView";

export const metadata = { title: "Tumour-board report · OncoAgent" };

export default async function CaseReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CaseReport id={id} />;
}
