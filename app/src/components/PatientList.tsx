import Link from "next/link";
import { patients } from "@/lib/data/patients";
import { snapshots } from "@/lib/snapshots";
import { assessRecist } from "@/lib/clinical/recist";
import { IconChevronRight } from "./icons";

/** Patient rows used on the overview and the patients page. Responsive grid, no horizontal scrolling. */
export function PatientList({ detailed = false }: { detailed?: boolean }) {
  return (
    <div className="plist">
      {patients.map((p) => {
        const r = assessRecist(p.recist);
        const last = r[r.length - 1];
        const snap = snapshots[p.id];
        const flags = snap.cards.filter((c) => c.critic.verdict === "flag").length;
        const driver = p.variants.filter((v) => v.gene !== "TP53").map((v) => `${v.gene} ${v.alteration}`).join(" · ");
        return (
          <Link key={p.id} href={`/patients/${p.id}`} className="prow">
            <span className="pr-av" aria-hidden="true">{p.displayName.split(" ").map((s) => s[0]).join("")}</span>
            <span className="pr-main">
              <b>{p.displayName}</b>
              <span>{p.id} · {p.age} {p.sex} · stage {p.stage.split(" ")[0]} · <span className="k">driver</span> {driver}</span>
              {detailed && <span><span className="k">now</span> {p.status} · {p.question}</span>}
            </span>
            <span className="pr-stat">
              <span className={`chip ${last.category === "PD" ? "red" : last.category === "PR" || last.category === "CR" ? "mint" : ""}`}>RECIST {last.category}</span>
              <span className="chip ghost">{snap.cards.length} cards</span>
              {flags > 0 && <span className="chip amber">{flags} critic flag</span>}
            </span>
            <IconChevronRight className="pr-go" />
          </Link>
        );
      })}
    </div>
  );
}
