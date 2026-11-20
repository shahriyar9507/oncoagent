import { PatientList } from "@/components/PatientList";
import { IconUsers } from "@/components/icons";
import { CaseList } from "@/components/CaseList";

export const metadata = { title: "Patients · OncoAgent" };

export default function PatientsPage() {
  return (
    <>
      <section className="panel hero">
        <p className="eyebrow">Patients · non-small-cell lung cancer</p>
        <h1 style={{ marginTop: 8 }}>Patients and <b>your cases</b></h1>
        <p>Three fictional demo records, each built around one hard decision, and the cases you enter yourself. Any de-identified NSCLC case with a driver in the curated pack (EGFR, ALK, ROS1, BRAF, MET, RET, NTRK, KRAS G12C, HER2) or none gets the full agent run.</p>
      </section>
      <section className="panel">
        <div className="panel-head"><h2 className="panel-title"><IconUsers /> Demo patients</h2><span className="chip amber">fictional data</span></div>
        <PatientList detailed />
      </section>
      <CaseList />
    </>
  );
}
