import { PatientList } from "@/components/PatientList";
import { patients } from "@/lib/data/patients";
import { IconUsers } from "@/components/icons";

export const metadata = { title: "Patients · OncoAgent" };

export default function PatientsPage() {
  return (
    <>
      <section className="panel hero">
        <p className="eyebrow">Patients · non-small-cell lung cancer</p>
        <h1 style={{ marginTop: 8 }}>{patients.length} fictional cases, <b>three drivers</b></h1>
        <p>Each record is written by the team to exercise one hard decision: progression on an EGFR inhibitor with a resistance mutation, a first-line KRAS G12C choice, and an ALK fusion with an interacting anti-seizure drug.</p>
      </section>
      <section className="panel">
        <div className="panel-head"><h2 className="panel-title"><IconUsers /> Case list</h2><span className="chip amber">fictional data</span></div>
        <PatientList detailed />
      </section>
    </>
  );
}
