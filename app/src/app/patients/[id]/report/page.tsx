import { notFound } from "next/navigation";
import { getPatient, patients, testedGenes, NSCLC_PANEL } from "@/lib/data/patients";
import { assessRecist } from "@/lib/clinical/recist";
import { snapshots } from "@/lib/snapshots";
import { ReportView } from "@/components/ReportView";

export function generateStaticParams() {
  return patients.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = getPatient(id);
  return { title: p ? `Tumour-board report · ${p.displayName} · OncoAgent` : "Report · OncoAgent" };
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = getPatient(id);
  if (!p) notFound();
  const tested = testedGenes(p);
  return <ReportView patient={p} recist={assessRecist(p.recist)} stored={snapshots[p.id]} untested={NSCLC_PANEL.filter((g) => !tested.includes(g))} />;
}
