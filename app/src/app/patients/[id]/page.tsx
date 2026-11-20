import { notFound } from "next/navigation";
import Link from "next/link";
import { getPatient, patients } from "@/lib/data/patients";
import { snapshots } from "@/lib/snapshots";
import { structures } from "@/lib/data/structures";
import { PatientRecord } from "@/components/PatientRecord";

export function generateStaticParams() {
  return patients.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = getPatient(id);
  return { title: p ? `${p.displayName} · OncoAgent` : "Patient · OncoAgent" };
}

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = getPatient(id);
  if (!p) notFound();
  const snap = snapshots[p.id];

  return (
    <>
      <div className="row" aria-label="Switch patient">
        {patients.map((x) => (
          <Link key={x.id} href={`/patients/${x.id}`} className={`btn sm${x.id === p.id ? " primary" : ""}`} aria-current={x.id === p.id ? "page" : undefined}>
            {x.displayName} <span style={{ opacity: 0.7 }}>{x.id}</span>
          </Link>
        ))}
        <Link href="/cases/new" className="btn sm ghost-btn">+ New case</Link>
      </div>
      <PatientRecord p={p} snapshot={snap} structure={structures[p.id]} trials={snap.evidence.filter((e) => e.kind === "trial")} mode="demo" />
    </>
  );
}
