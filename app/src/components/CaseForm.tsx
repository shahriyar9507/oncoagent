"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CaseInputSchema, RESPONSES, STAGES, newCaseId, type CaseInput } from "@/lib/caseInput";
import { extractReport } from "@/lib/clinical/extract";
import { selectKnowledgeKey } from "@/lib/clinical/select";
import { bsaMosteller, crclCockcroftGault } from "@/lib/clinical/dose";
import { MEDICATION_CATALOGUE, tagsFor } from "@/lib/data/medications";
import { knowledge } from "@/lib/data/knowledge";
import { NSCLC_PANEL } from "@/lib/data/patients";
import { saveCase, useCase } from "@/lib/cases";
import { dataMode } from "@/lib/remote";
import type { ReportExtraction, Variant } from "@/lib/types";
import { toast } from "./DecisionDialog";
import { IconAlert, IconCalc, IconCheck, IconDna, IconFile, IconPill, IconActivity, IconUsers, IconX, IconSpark } from "./icons";

type Line = { regimen: string; start: string; end: string; bestResponse: string; progressed: boolean };
type Scan = { date: string; sumMm: string; newLesions: boolean };
type Var = { gene: string; alteration: string; kind: Variant["kind"]; vafPercent: string; sample: "tissue" | "plasma"; hgvsP?: string };
interface FormState {
  label: string; age: string; sex: "F" | "M"; smoking: "never" | "former" | "current"; ecog: string;
  histology: "adenocarcinoma" | "squamous" | "nsclc-nos"; stage: (typeof STAGES)[number]; sites: string; pdl1: string;
  weight: string; height: string; creatinine: string; creatinineDate: string;
  sample: "tissue" | "plasma"; reportDate: string; reportText: string;
  variants: Var[]; negatives: string[]; lines: Line[]; scans: Scan[]; meds: string[]; question: string;
}

function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
}

const EMPTY = (): FormState => ({
  label: "", age: "", sex: "F", smoking: "never", ecog: "1", histology: "adenocarcinoma", stage: "IVB", sites: "", pdl1: "",
  weight: "", height: "", creatinine: "", creatinineDate: today(), sample: "tissue", reportDate: today(), reportText: "",
  variants: [], negatives: [], lines: [], scans: [], meds: [], question: "",
});

const EXAMPLES: { name: string; note: string; state: () => FormState }[] = [
  {
    name: "EGFR exon 19 · new diagnosis",
    note: "Tissue NGS report to paste; first line",
    state: () => ({ ...EMPTY(), age: "58", sex: "F", smoking: "never", ecog: "1", sites: "bone, pleura", pdl1: "", weight: "52", height: "155", creatinine: "0.7", reportText: "Tissue NGS (FFPE), tumour content 40%.\nEGFR p.Glu746_Ala750del (exon 19 deletion), VAF 28%.\nTP53 p.Arg248Gln, VAF 30%.\nNegative for: ALK, ROS1, BRAF, KRAS, MET, RET, NTRK, ERBB2.\nPD-L1 (22C3) TPS 5%.", scans: [{ date: today(), sumMm: "48", newLesions: false }], meds: ["Omeprazole 20 mg daily"] }),
  },
  {
    name: "KRAS G12C · after chemo-immunotherapy",
    note: "Progression; second line",
    state: () => ({ ...EMPTY(), age: "66", sex: "M", smoking: "former", ecog: "1", sites: "liver, adrenal", weight: "68", height: "168", creatinine: "1.1", reportText: "Tissue NGS: KRAS G12C (p.Gly12Cys), VAF 22%. STK11 p.Gln37Ter. ALK negative, ROS1 negative, EGFR not detected, BRAF negative, MET negative, RET negative, NTRK negative, ERBB2 negative. PD-L1 TPS 20%.", lines: [{ regimen: "Pembrolizumab + carboplatin + pemetrexed", start: "2026-03-02", end: "2026-11-10", bestResponse: "Partial response", progressed: true }], scans: [{ date: "2026-03-01", sumMm: "70", newLesions: false }, { date: "2026-06-01", sumMm: "46", newLesions: false }, { date: "2026-11-09", sumMm: "62", newLesions: true }], meds: ["Omeprazole 20 mg daily", "Metformin 500 mg twice daily"] }),
  },
  {
    name: "ROS1 fusion · new diagnosis",
    note: "FISH report; strong CYP3A inducer on board",
    state: () => ({ ...EMPTY(), age: "41", sex: "F", smoking: "never", ecog: "0", sites: "brain, lung", weight: "49", height: "152", creatinine: "0.6", reportText: "ROS1 rearrangement detected by FISH (break-apart, 62% of nuclei). CD74-ROS1 fusion confirmed by RNA NGS.\nEGFR not detected. ALK negative. KRAS negative. BRAF negative. MET negative. RET negative. NTRK negative. ERBB2 negative.\nPD-L1 TPS <1%.", scans: [{ date: today(), sumMm: "39", newLesions: false }], meds: ["Phenytoin 100 mg three times daily"] }),
  },
  {
    name: "No driver · PD-L1 80%",
    note: "Squamous; first line",
    state: () => ({ ...EMPTY(), age: "71", sex: "M", smoking: "current", ecog: "1", histology: "squamous", sites: "mediastinal nodes, bone", weight: "60", height: "165", creatinine: "1.3", reportText: "Tissue NGS: no actionable alteration. TP53 p.Arg273His VAF 35%. EGFR, ALK, ROS1, BRAF, KRAS, MET, RET, NTRK, ERBB2: not detected.\nPD-L1 (22C3) TPS 80%.", scans: [{ date: today(), sumMm: "84", newLesions: false }], meds: ["Amlodipine 5 mg daily", "Citalopram 20 mg daily"] }),
  },
];

const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

function toInput(f: FormState): unknown {
  return {
    label: f.label.trim() || undefined,
    age: num(f.age), sex: f.sex, smoking: f.smoking, histology: f.histology, stage: f.stage, sites: f.sites.trim() || undefined, ecog: num(f.ecog),
    pdl1Tps: num(f.pdl1), weightKg: num(f.weight), heightCm: num(f.height), creatinineMgDl: num(f.creatinine), creatinineDate: f.creatinineDate,
    reportDate: f.reportDate,
    variants: f.variants.filter((v) => v.gene.trim() && v.alteration.trim()).map((v) => ({ gene: v.gene.trim().toUpperCase(), alteration: v.alteration.trim(), kind: v.kind, vafPercent: num(v.vafPercent), sample: v.sample, hgvsP: v.hgvsP || undefined })),
    testedNegative: f.negatives,
    priorLines: f.lines.filter((l) => l.regimen.trim()).map((l) => ({ regimen: l.regimen.trim(), start: l.start, end: l.end || undefined, bestResponse: l.bestResponse || undefined, progressed: l.progressed })),
    medications: f.meds,
    recist: f.scans.filter((s) => s.date && s.sumMm !== "").map((s) => ({ date: s.date, sumMm: Number(s.sumMm), newLesions: s.newLesions })),
    question: f.question.trim() || undefined,
    asOf: today(),
  };
}

function fromInput(i: CaseInput): FormState {
  return {
    label: i.label ?? "", age: String(i.age), sex: i.sex, smoking: i.smoking, ecog: String(i.ecog), histology: i.histology, stage: i.stage, sites: i.sites ?? "",
    pdl1: i.pdl1Tps !== undefined ? String(i.pdl1Tps) : "", weight: String(i.weightKg), height: String(i.heightCm), creatinine: String(i.creatinineMgDl), creatinineDate: i.creatinineDate,
    sample: i.variants[0]?.sample ?? "tissue", reportDate: i.reportDate, reportText: "",
    variants: i.variants.map((v) => ({ gene: v.gene, alteration: v.alteration, kind: v.kind, vafPercent: v.vafPercent !== undefined ? String(v.vafPercent) : "", sample: v.sample, hgvsP: v.hgvsP })),
    negatives: i.testedNegative, lines: i.priorLines.map((l) => ({ regimen: l.regimen, start: l.start, end: l.end ?? "", bestResponse: l.bestResponse ?? "", progressed: l.progressed })),
    scans: i.recist.map((r) => ({ date: r.date, sumMm: String(r.sumMm), newLesions: r.newLesions })), meds: i.medications, question: i.question ?? "",
  };
}

const REGIMEN_SUGGESTIONS = Array.from(new Set(Object.values(knowledge).flatMap((k) => k.options.filter((o) => o.drugs.length).map((o) => o.regimen))));

/** Loads the case to edit (from the server or this browser) before showing the form. */
export function CaseForm({ editId }: { editId?: string }) {
  const { stored, ready } = useCase(editId ?? "__none__");
  if (!editId) return <CaseFormInner />;
  if (!ready) return <p className="empty">Loading case {editId}…</p>;
  if (!stored) return <p className="empty">Case {editId} was not found.</p>;
  return <CaseFormInner editId={editId} initial={fromInput(stored.input)} />;
}

function CaseFormInner({ editId, initial }: { editId?: string; initial?: FormState }) {
  const router = useRouter();
  const [f, setF] = useState<FormState>(() => initial ?? EMPTY());
  const [saving, setSaving] = useState(false);
  const [extraction, setExtraction] = useState<ReportExtraction | null>(null);
  const [medQuery, setMedQuery] = useState("");
  const [tried, setTried] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  const parsed = useMemo(() => CaseInputSchema.safeParse(toInput(f)), [f]);
  const issues = parsed.success ? [] : parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
  const issueFor = (path: string) => (tried ? issues.find((i) => i.path === path || i.path.startsWith(path + "."))?.message : undefined);

  const preview = useMemo(() => {
    const w = num(f.weight), h = num(f.height), cr = num(f.creatinine), age = num(f.age);
    const bsa = w && h ? bsaMosteller(h, w) : undefined;
    const crcl = w && cr && age ? crclCockcroftGault(age, w, cr, f.sex) : undefined;
    const vs = f.variants.filter((v) => v.gene && v.alteration);
    const lastLine = f.lines.filter((l) => l.regimen).sort((a, b) => a.start.localeCompare(b.start)).at(-1);
    const sel = selectKnowledgeKey({ variants: vs.map((v) => ({ gene: v.gene.toUpperCase(), alteration: v.alteration, kind: v.kind, sample: v.sample })), priorRegimens: f.lines.filter((l) => l.regimen).map((l) => l.regimen), progressedOnCurrentLine: !!lastLine?.progressed, pdl1Tps: num(f.pdl1), histology: f.histology });
    return { bsa, crcl, sel, kb: sel.key ? knowledge[sel.key] : undefined };
  }, [f]);

  function readReport() {
    const r = extractReport(f.reportText);
    setExtraction(r);
    if (r.sample) set("sample", r.sample);
  }

  function useExtraction() {
    if (!extraction) return;
    setF((s) => ({
      ...s,
      variants: [
        ...s.variants.filter((v) => !extraction.variants.some((e) => e.gene === v.gene.toUpperCase() && e.alteration === v.alteration)),
        ...extraction.variants.map((e) => ({ gene: e.gene, alteration: e.alteration, kind: e.kind, vafPercent: e.vafPercent !== undefined ? String(e.vafPercent) : "", sample: extraction.sample ?? s.sample, hgvsP: e.hgvsP })),
      ],
      negatives: Array.from(new Set([...s.negatives, ...extraction.testedNegative.filter((g) => NSCLC_PANEL.includes(g) || g.length <= 8)])),
      pdl1: extraction.pdl1Tps !== undefined ? String(extraction.pdl1Tps) : s.pdl1,
    }));
    toast(`Added ${extraction.variants.length} alteration(s) from the report. Check each one.`);
  }

  function addMed(name: string) {
    const n = name.trim();
    if (n.length < 2 || f.meds.some((m) => m.toLowerCase() === n.toLowerCase())) return;
    set("meds", [...f.meds, n]);
    setMedQuery("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!parsed.success) {
      toast(`Check ${issues.length} field${issues.length === 1 ? "" : "s"} before saving.`, "amber");
      return;
    }
    const id = editId ?? newCaseId();
    setSaving(true);
    try {
      await saveCase(id, parsed.data);
    } catch (err) {
      toast((err as Error).message, "red");
      setSaving(false);
      return;
    }
    toast(editId ? "Case updated" : `Case ${id} saved ${dataMode() === "server" ? "to the server" : "in this browser"}`);
    router.push(`/cases/${id}`);
  }

  const medMatches = medQuery.trim().length >= 2 ? MEDICATION_CATALOGUE.filter((m) => m.name.toLowerCase().includes(medQuery.trim().toLowerCase())).slice(0, 6) : [];

  return (
    <form className="case-form" onSubmit={save} noValidate>
      <section className="panel hero">
        <p className="eyebrow">{editId ? `Edit case ${editId}` : "New case"}</p>
        <h1 style={{ marginTop: 8 }}>Enter a case. <b>The agents do the reading.</b></h1>
        <p>For de-identified or fictional lung cancer cases only. Do not enter names, hospital numbers, phone numbers or dates of birth. {dataMode() === "server" ? "The case is saved to your account on the server." : "The case is saved in this browser."} The server validates and rebuilds it for every run.</p>
        {!editId && (
          <div className="examples">
            <span className="eyebrow">Start from an example</span>
            {EXAMPLES.map((x) => (
              <button key={x.name} type="button" className="ex" onClick={() => { setF(x.state()); setExtraction(null); setTried(false); }}>
                <b>{x.name}</b><span>{x.note}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="split work">
        <div className="stack">
          <fieldset className="panel fs">
            <legend className="panel-title"><IconUsers /> Patient</legend>
            <div className="fgrid">
              <Field label="Age (years)" error={issueFor("age")}><input inputMode="numeric" value={f.age} onChange={(e) => set("age", e.target.value)} placeholder="e.g. 58" /></Field>
              <Field label="Sex"><select value={f.sex} onChange={(e) => set("sex", e.target.value as FormState["sex"])}><option value="F">Female</option><option value="M">Male</option></select></Field>
              <Field label="Smoking"><select value={f.smoking} onChange={(e) => set("smoking", e.target.value as FormState["smoking"])}><option value="never">Never</option><option value="former">Former</option><option value="current">Current</option></select></Field>
              <Field label="ECOG"><select value={f.ecog} onChange={(e) => set("ecog", e.target.value)}>{[0, 1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}</select></Field>
              <Field label="Your label (optional, no identifiers)" wide error={issueFor("label")}><input value={f.label} maxLength={40} onChange={(e) => set("label", e.target.value)} placeholder="e.g. Tumour board case 3" /></Field>
            </div>
          </fieldset>

          <fieldset className="panel fs">
            <legend className="panel-title"><IconActivity /> Diagnosis</legend>
            <div className="fgrid">
              <Field label="Histology"><select value={f.histology} onChange={(e) => set("histology", e.target.value as FormState["histology"])}><option value="adenocarcinoma">Adenocarcinoma</option><option value="squamous">Squamous cell</option><option value="nsclc-nos">NSCLC, NOS</option></select></Field>
              <Field label="Stage"><select value={f.stage} onChange={(e) => set("stage", e.target.value as FormState["stage"])}>{STAGES.map((s) => <option key={s}>{s}</option>)}</select></Field>
              <Field label="PD-L1 TPS (%)" error={issueFor("pdl1Tps")}><input inputMode="decimal" value={f.pdl1} onChange={(e) => set("pdl1", e.target.value)} placeholder="blank = not tested" /></Field>
              <Field label="Metastatic sites" wide><input value={f.sites} maxLength={80} onChange={(e) => set("sites", e.target.value)} placeholder="e.g. bone, liver, brain" /></Field>
            </div>
          </fieldset>

          <fieldset className="panel fs">
            <legend className="panel-title"><IconDna /> Molecular report</legend>
            <div className="fgrid">
              <Field label="Sample"><select value={f.sample} onChange={(e) => set("sample", e.target.value as FormState["sample"])}><option value="tissue">Tissue</option><option value="plasma">Plasma (ctDNA)</option></select></Field>
              <Field label="Report date" error={issueFor("reportDate")}><input type="date" value={f.reportDate} onChange={(e) => set("reportDate", e.target.value)} /></Field>
            </div>
            <label className="field" style={{ marginTop: 12 }}>Paste the report text (NGS, PCR, FISH, IHC)
              <textarea className="mono" rows={5} value={f.reportText} onChange={(e) => set("reportText", e.target.value)} placeholder={"EGFR p.Leu858Arg (L858R), VAF 31%\nTP53 R273H\nALK negative · PD-L1 TPS 10%"} />
            </label>
            <div className="row" style={{ marginTop: 10 }}>
              <button type="button" className="btn" onClick={readReport} disabled={!f.reportText.trim()}><IconFile /> Read report</button>
              <span className="footer-note">Deterministic reader: no AI, nothing leaves the browser.</span>
            </div>
            {extraction && (
              <div className="extract">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <b>Found {extraction.variants.length} alteration{extraction.variants.length === 1 ? "" : "s"}{extraction.pdl1Tps !== undefined ? ` · PD-L1 TPS ${extraction.pdl1Tps}%` : ""}{extraction.sample ? ` · ${extraction.sample}` : ""}</b>
                  <button type="button" className="btn sm primary" onClick={useExtraction} disabled={!extraction.variants.length && extraction.pdl1Tps === undefined && !extraction.testedNegative.length}><IconCheck /> Use these</button>
                </div>
                {extraction.variants.map((v) => (
                  <div key={v.gene + v.alteration} className="ext-row"><span className="chip mint">{v.gene} {v.alteration}</span><span className="muted">{v.kind}{v.vafPercent !== undefined ? ` · VAF ${v.vafPercent}%` : ""}</span><span className="mono muted">“{v.matched}”</span></div>
                ))}
                {extraction.testedNegative.length > 0 && <p className="sub">Negative: {extraction.testedNegative.join(", ")}</p>}
                {extraction.warnings.map((w) => <p key={w} className="critic flag" style={{ marginTop: 6 }}>{w}</p>)}
              </div>
            )}
            <div className="vlist">
              {f.variants.map((v, i) => (
                <div key={i} className="vrow">
                  <input aria-label="Gene" value={v.gene} onChange={(e) => set("variants", f.variants.map((x, j) => (j === i ? { ...x, gene: e.target.value.toUpperCase() } : x)))} placeholder="Gene" />
                  <input aria-label="Alteration" value={v.alteration} onChange={(e) => set("variants", f.variants.map((x, j) => (j === i ? { ...x, alteration: e.target.value } : x)))} placeholder="Alteration" />
                  <select aria-label="Type" value={v.kind} onChange={(e) => set("variants", f.variants.map((x, j) => (j === i ? { ...x, kind: e.target.value as Variant["kind"] } : x)))}><option value="SNV">SNV</option><option value="indel">indel</option><option value="fusion">fusion</option><option value="CNV">CNV</option></select>
                  <input aria-label="VAF %" inputMode="decimal" value={v.vafPercent} onChange={(e) => set("variants", f.variants.map((x, j) => (j === i ? { ...x, vafPercent: e.target.value } : x)))} placeholder="VAF %" />
                  <button type="button" className="icon-btn" aria-label={`Remove ${v.gene} ${v.alteration}`} onClick={() => set("variants", f.variants.filter((_, j) => j !== i))}><IconX /></button>
                </div>
              ))}
              <button type="button" className="link-btn" onClick={() => set("variants", [...f.variants, { gene: "", alteration: "", kind: "SNV", vafPercent: "", sample: f.sample }])}>+ Add alteration by hand</button>
              {issueFor("variants") && <span className="err">{issueFor("variants")}</span>}
            </div>
            <p className="eyebrow" style={{ marginTop: 14 }}>Tested and negative</p>
            <div className="panel-genes">
              {NSCLC_PANEL.filter((g) => g !== "PD-L1").map((g) => {
                const on = f.negatives.includes(g);
                return <button key={g} type="button" className={`gene as-btn${on ? " on" : ""}`} aria-pressed={on} onClick={() => set("negatives", on ? f.negatives.filter((x) => x !== g) : [...f.negatives, g])}>{g}</button>;
              })}
            </div>
          </fieldset>

          <fieldset className="panel fs">
            <legend className="panel-title"><IconSpark /> Treatment history</legend>
            <datalist id="regimens">{REGIMEN_SUGGESTIONS.map((r) => <option key={r} value={r} />)}</datalist>
            {f.lines.length === 0 && <p className="sub">No prior systemic therapy. Add a line if the patient has been treated.</p>}
            {f.lines.map((l, i) => (
              <div key={i} className="lrow">
                <Field label={`Line ${i + 1} regimen`} wide error={issueFor(`priorLines.${i}`)}><input list="regimens" value={l.regimen} onChange={(e) => set("lines", f.lines.map((x, j) => (j === i ? { ...x, regimen: e.target.value } : x)))} placeholder="e.g. Osimertinib" /></Field>
                <Field label="Start"><input type="date" value={l.start} onChange={(e) => set("lines", f.lines.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} /></Field>
                <Field label="End (if stopped)"><input type="date" value={l.end} onChange={(e) => set("lines", f.lines.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} /></Field>
                <Field label="Best response"><select value={l.bestResponse} onChange={(e) => set("lines", f.lines.map((x, j) => (j === i ? { ...x, bestResponse: e.target.value } : x)))}><option value="">—</option>{RESPONSES.map((r) => <option key={r}>{r}</option>)}</select></Field>
                <label className="ack" style={{ alignSelf: "end", paddingBottom: 10 }}><input type="checkbox" checked={l.progressed} onChange={(e) => set("lines", f.lines.map((x, j) => (j === i ? { ...x, progressed: e.target.checked } : x)))} /> Progressed or stopped</label>
                <button type="button" className="icon-btn" style={{ alignSelf: "end" }} aria-label={`Remove line ${i + 1}`} onClick={() => set("lines", f.lines.filter((_, j) => j !== i))}><IconX /></button>
              </div>
            ))}
            <button type="button" className="link-btn" onClick={() => set("lines", [...f.lines, { regimen: "", start: today(), end: "", bestResponse: "", progressed: false }])}>+ Add a line of therapy</button>
          </fieldset>

          <fieldset className="panel fs">
            <legend className="panel-title"><IconActivity /> Tumour measurements (RECIST 1.1)</legend>
            <p className="sub">Sum of target-lesion diameters from each CT, oldest first. The Sentinel agent calculates the response.</p>
            {f.scans.map((s, i) => (
              <div key={i} className="srow">
                <Field label="Scan date"><input type="date" value={s.date} onChange={(e) => set("scans", f.scans.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} /></Field>
                <Field label="Sum (mm)" error={issueFor(`recist.${i}`)}><input inputMode="decimal" value={s.sumMm} onChange={(e) => set("scans", f.scans.map((x, j) => (j === i ? { ...x, sumMm: e.target.value } : x)))} /></Field>
                <label className="ack" style={{ alignSelf: "end", paddingBottom: 10 }}><input type="checkbox" checked={s.newLesions} onChange={(e) => set("scans", f.scans.map((x, j) => (j === i ? { ...x, newLesions: e.target.checked } : x)))} /> New lesion</label>
                <button type="button" className="icon-btn" style={{ alignSelf: "end" }} aria-label={`Remove scan ${i + 1}`} onClick={() => set("scans", f.scans.filter((_, j) => j !== i))}><IconX /></button>
              </div>
            ))}
            <button type="button" className="link-btn" onClick={() => set("scans", [...f.scans, { date: today(), sumMm: "", newLesions: false }])}>+ Add a scan</button>
          </fieldset>

          <fieldset className="panel fs">
            <legend className="panel-title"><IconCalc /> Body and kidney function</legend>
            <div className="fgrid">
              <Field label="Weight (kg)" error={issueFor("weightKg")}><input inputMode="decimal" value={f.weight} onChange={(e) => set("weight", e.target.value)} /></Field>
              <Field label="Height (cm)" error={issueFor("heightCm")}><input inputMode="decimal" value={f.height} onChange={(e) => set("height", e.target.value)} /></Field>
              <Field label="Serum creatinine (mg/dL)" error={issueFor("creatinineMgDl")}><input inputMode="decimal" value={f.creatinine} onChange={(e) => set("creatinine", e.target.value)} /></Field>
              <Field label="Creatinine date" error={issueFor("creatinineDate")}><input type="date" value={f.creatinineDate} onChange={(e) => set("creatinineDate", e.target.value)} /></Field>
            </div>
          </fieldset>

          <fieldset className="panel fs">
            <legend className="panel-title"><IconPill /> Current medications</legend>
            <div className="medpick">
              <input value={medQuery} onChange={(e) => setMedQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMed(medMatches[0]?.name ?? medQuery); } }} placeholder="Type to search, e.g. omeprazole, carbamazepine, citalopram" aria-label="Add medication" />
              {medMatches.length > 0 && (
                <div className="medlist" role="listbox">
                  {medMatches.map((m) => (
                    <button key={m.name} type="button" role="option" aria-selected="false" onClick={() => addMed(m.name)}><b>{m.name}</b><span>{m.group}{m.tags.length ? ` · ${m.tags.join(", ").replace(/-/g, " ")}` : ""}</span></button>
                  ))}
                </div>
              )}
            </div>
            <div className="row" style={{ marginTop: 10, gap: 6 }}>
              {f.meds.length === 0 && <span className="sub">None entered.</span>}
              {f.meds.map((m) => {
                const tags = tagsFor(m);
                return (
                  <span key={m} className={`chip${tags.length ? " amber" : ""}`}>{m}{tags.length ? ` · ${tags.join(", ").replace(/-/g, " ")}` : ""}<button type="button" className="chip-x" aria-label={`Remove ${m}`} onClick={() => set("meds", f.meds.filter((x) => x !== m))}><IconX /></button></span>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="panel fs">
            <legend className="panel-title"><IconSpark /> Question for the agents (optional)</legend>
            <textarea rows={2} maxLength={400} value={f.question} onChange={(e) => set("question", e.target.value)} placeholder="Left blank, the question is written from the history (first line or next line)." />
          </fieldset>
        </div>

        <aside className="stack sticky-col">
          <section className="panel glow">
            <div className="panel-head"><h2 className="panel-title"><IconCalc /> Live preview</h2><span className="chip ghost">before saving</span></div>
            <div className="kv">
              <span className="k">BSA (Mosteller)</span><span>{preview.bsa ? `${preview.bsa.toFixed(2)} m²` : "—"}</span>
              <span className="k">CrCl (Cockcroft–Gault)</span><span>{preview.crcl ? `${preview.crcl.toFixed(0)} mL/min` : "—"}</span>
              <span className="k">Knowledge pack</span><span>{preview.kb ? <b style={{ color: "var(--mint-2)" }}>{preview.kb.title}</b> : <span className="muted">not covered</span>}</span>
              <span className="k">Why</span><span className="sub">{preview.sel.reason}</span>
              <span className="k">Trial search</span><span className="mono">{preview.sel.trialTerm}</span>
            </div>
            {preview.kb && (
              <ol className="opts">
                {preview.kb.options.filter((o) => o.role !== "later-line").sort((a, b) => a.rank - b.rank).map((o) => <li key={o.id}><b>{o.regimen}</b><span>{o.role} · {o.basis}</span></li>)}
              </ol>
            )}
            <p className="footer-note" style={{ marginTop: 10 }}>Options are drafts from the curated pack. The agents add interactions, trials, dose and the safety-critic after you save and run.</p>
          </section>
          {tried && issues.length > 0 && (
            <section className="panel" role="alert">
              <p className="critic flag"><IconAlert width={14} height={14} style={{ verticalAlign: -2 }} /> {issues.length} field{issues.length === 1 ? "" : "s"} to check:</p>
              <ul className="rc-why" style={{ marginTop: 8 }}>{issues.slice(0, 8).map((i) => <li key={i.path + i.message}><span className="mono">{i.path || "case"}</span>: {i.message}</li>)}</ul>
            </section>
          )}
          <div className="row">
            <button type="submit" className="btn primary" disabled={saving}><IconCheck /> {saving ? "Saving…" : editId ? "Save changes" : "Save case and open"}</button>
            <Link href={editId ? `/cases/${editId}` : "/patients"} className="btn">Cancel</Link>
          </div>
        </aside>
      </div>
    </form>
  );
}

function Field({ label, children, error, wide }: { label: string; children: React.ReactNode; error?: string; wide?: boolean }) {
  return (
    <label className={`field${wide ? " wide" : ""}${error ? " bad" : ""}`}>
      {label}
      {children}
      {error && <span className="err">{error}</span>}
    </label>
  );
}
