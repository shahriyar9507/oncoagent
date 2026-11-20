"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { buildPatientFromInput } from "@/lib/caseInput";
import { deleteCase, useCase } from "@/lib/cases";
import { useStoredRun } from "@/lib/hooks";
import { structureForVariants } from "@/lib/data/structures";
import { assessRecist } from "@/lib/clinical/recist";
import { NSCLC_PANEL, testedGenes } from "@/lib/data/patients";
import { PatientRecord } from "./PatientRecord";
import { ReportView } from "./ReportView";
import { toast } from "./DecisionDialog";
import { IconEdit, IconX } from "./icons";

function NotFound({ id }: { id: string }) {
  return (
    <section className="panel">
      <div className="empty-state">
        <p><b>Case {id} is not in this browser.</b></p>
        <p className="sub">Clinician-entered cases are kept only in the browser where they were created. Open it there, or enter the case again.</p>
        <Link href="/cases/new" className="btn sm primary arrow" style={{ marginTop: 12 }}>New case</Link>
      </div>
    </section>
  );
}

/** A clinician-entered case, rebuilt from its saved input with the same code the server uses. */
export function CaseView({ id }: { id: string }) {
  const router = useRouter();
  const { stored, ready } = useCase(id);
  const run = useStoredRun(id);
  const p = useMemo(() => (stored ? buildPatientFromInput(stored.input, id) : null), [stored, id]);
  if (!ready) return <p className="empty">Loading case…</p>;
  if (!stored || !p) return <NotFound id={id} />;
  const structure = structureForVariants(p.variants);
  const trials = run?.evidence.filter((e) => e.kind === "trial") ?? [];

  function remove() {
    if (!window.confirm(`Delete case ${id} and its agent run from this browser? Signed audit entries are kept.`)) return;
    deleteCase(id);
    toast(`Case ${id} deleted`);
    router.push("/patients");
  }

  return (
    <PatientRecord
      p={p}
      snapshot={null}
      structure={structure}
      trials={trials}
      mode="case"
      caseInput={stored.input}
      actions={
        <>
          <Link href={`/cases/new?edit=${id}`} className="btn sm"><IconEdit /> Edit</Link>
          <button type="button" className="btn sm danger" onClick={remove}><IconX /> Delete</button>
        </>
      }
    />
  );
}

export function CaseReport({ id }: { id: string }) {
  const { stored, ready } = useCase(id);
  const p = useMemo(() => (stored ? buildPatientFromInput(stored.input, id) : null), [stored, id]);
  if (!ready) return <p className="empty">Loading case…</p>;
  if (!stored || !p) return <NotFound id={id} />;
  const tested = testedGenes(p);
  return <ReportView patient={p} recist={assessRecist(p.recist)} stored={null} untested={NSCLC_PANEL.filter((g) => !tested.includes(g))} backHref={`/cases/${id}`} />;
}
