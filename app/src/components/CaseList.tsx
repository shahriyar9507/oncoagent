"use client";

import Link from "next/link";
import { useCases } from "@/lib/cases";
import { useLiveRuns } from "@/lib/hooks";
import { fmtDateTime } from "@/lib/format";
import { IconChevronRight, IconEdit } from "./icons";

/** Cases entered by the clinician in this browser. */
export function CaseList() {
  const cases = useCases();
  const runs = useLiveRuns(cases.map((c) => c.id));
  return (
    <section className="panel" aria-labelledby="yc-t">
      <div className="panel-head">
        <h2 id="yc-t" className="panel-title"><IconEdit /> Your cases</h2>
        <Link href="/cases/new" className="btn sm primary">+ New case</Link>
      </div>
      {cases.length === 0 ? (
        <div className="empty-state">
          <p><b>No cases entered yet.</b></p>
          <p className="sub">Enter a de-identified NSCLC case, paste its molecular report and run the same nine agents on it. Cases stay in this browser.</p>
        </div>
      ) : (
        <div className="plist">
          {cases.map((c) => {
            const run = runs[c.id];
            const flagged = run?.cards.filter((x) => x.critic.verdict === "flag").length ?? 0;
            const driver = c.input.variants.filter((v) => !["TP53", "STK11", "KEAP1"].includes(v.gene)).map((v) => `${v.gene} ${v.alteration}`).join(" · ") || "no driver reported";
            return (
              <Link key={c.id} href={`/cases/${c.id}`} className="prow">
                <span className="pr-av" aria-hidden="true">{c.id.slice(2, 4)}</span>
                <span className="pr-main">
                  <b>{c.input.label || `Case ${c.id}`}</b>
                  <span>{c.id} · {c.input.age} {c.input.sex} · stage {c.input.stage} · <span className="k">driver</span> {driver}</span>
                  <span className="muted">Updated {fmtDateTime(c.updatedAt)}</span>
                </span>
                <span className="pr-stat">
                  {run ? <span className="chip mint">{run.cards.length} cards</span> : <span className="chip ghost">not run yet</span>}
                  {flagged > 0 && <span className="chip amber">{flagged} critic flag</span>}
                </span>
                <IconChevronRight className="pr-go" />
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
